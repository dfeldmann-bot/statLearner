// The authoring pipeline: one model drafts, the other reviews, the drafter
// revises, and both independently solve every fixed question to catch wrong
// answer keys. Providers are injected, so tests run without network access.

import { validateSession } from "../app/src/schema.js";
import { defaultTolerance } from "../app/src/check.js";
import { extractJson } from "./json.mjs";
import { draftPrompt, repairPrompt, reviewPrompt, revisePrompt, solvePrompt } from "./prompts.mjs";
import { ManualStepRequired } from "./providers.mjs";

const unwrap = (obj) => (obj?.session ? obj : { session: obj, proposedExercises: [] });

// Ask, parse, validate; on schema errors send them back up to `maxRepair` times.
async function askForSession(provider, { system, prompt }, { ctx, maxRepair = 2, name, log = () => {} }) {
  let draft = unwrap(extractJson(await provider.complete({ system, prompt, name })));
  let errors = validateSession(draft.session, ctx);
  for (let attempt = 1; errors.length && attempt <= maxRepair; attempt++) {
    log(`  ${errors.length} validation error(s); asking ${provider.name} to repair (attempt ${attempt})`);
    const fixed = unwrap(extractJson(await provider.complete({ ...repairPrompt(draft, errors), name: `${name}-repair-${attempt}` })));
    draft = { ...draft, ...fixed, proposedExercises: fixed.proposedExercises?.length ? fixed.proposedExercises : draft.proposedExercises };
    errors = validateSession(draft.session, ctx);
  }
  return { ...draft, errors };
}

export async function draftSession({ brief, drafter, reference, ctx, maxRepair, log }) {
  return askForSession(drafter, draftPrompt(brief, reference), { ctx, maxRepair, name: `${brief.id}-draft`, log });
}

export async function reviewSession({ draft, brief, reviewer, round = 1 }) {
  const review = extractJson(await reviewer.complete({ ...reviewPrompt(draft, brief), name: `${brief?.id ?? draft.session.id}-review-${round}` }));
  review.issues ??= [];
  review.blocking = review.issues.filter((i) => i.severity === "critical" || i.severity === "major").length;
  return review;
}

export async function reviseSession({ draft, review, drafter, ctx, maxRepair, round = 1, log }) {
  return askForSession(drafter, revisePrompt(draft, review), { ctx, maxRepair, name: `${draft.session.id}-revise-${round}`, log });
}

export function fixedQuestions(session) {
  const out = [];
  for (const q of session.warmup ?? []) out.push({ where: "warmup", q });
  for (const b of session.blocks ?? []) if (b.type === "check") out.push({ where: "check", q: b.question });
  for (const q of session.quiz ?? []) out.push({ where: "quiz", q });
  return out.filter(({ q }) => q && q.type !== "generated");
}

export function agrees(q, answer) {
  if (q.type === "choice") return Number(answer) === q.answer;
  const a = Number(answer);
  return Number.isFinite(a) && Math.abs(a - q.answer) <= (q.tolerance ?? defaultTolerance(q.answer));
}

export async function crossCheck({ session, solvers }) {
  const rows = [];
  for (const { where, q } of fixedQuestions(session)) {
    const answers = {};
    for (const solver of solvers) {
      try {
        const reply = extractJson(await solver.complete({ ...solvePrompt(q), name: `${session.id}-solve-${q.id}-${solver.name.split(":")[0]}` }));
        answers[solver.name] = { answer: reply.answer, ok: agrees(q, reply.answer), reason: reply.reason ?? "" };
      } catch (e) {
        if (e instanceof ManualStepRequired) throw e;
        answers[solver.name] = { answer: null, ok: false, reason: `error: ${e.message}` };
      }
    }
    rows.push({ id: q.id, where, type: q.type, key: q.answer, answers, flagged: Object.values(answers).some((a) => !a.ok) });
  }
  return rows;
}

export async function runPipeline({ brief, drafter, reviewer, solvers, reference, ctx, maxRounds = 2, maxRepair = 2, log = () => {} }) {
  log(`Drafting ${brief.id} with ${drafter.name}…`);
  let draft = await draftSession({ brief, drafter, reference, ctx, maxRepair, log });
  const rounds = [];
  for (let round = 1; round <= maxRounds; round++) {
    log(`Review round ${round} with ${reviewer.name}…`);
    const review = await reviewSession({ draft, brief, reviewer, round });
    const entry = { round, verdict: review.verdict, issues: review.issues, strengths: review.strengths ?? [] };
    rounds.push(entry);
    log(`  verdict: ${review.verdict}, ${review.issues.length} issue(s), ${review.blocking} critical/major`);
    if (review.verdict === "approve" && review.blocking === 0) break;
    log(`Revising with ${drafter.name}…`);
    const revised = await reviseSession({ draft, review, drafter, ctx, maxRepair, round, log });
    entry.changelog = revised.changelog ?? [];
    draft = { ...revised, proposedExercises: revised.proposedExercises?.length ? revised.proposedExercises : draft.proposedExercises };
  }
  log(`Cross-checking answer keys with ${solvers.map((s) => s.name).join(" and ")}…`);
  const check = draft.errors.length ? [] : await crossCheck({ session: draft.session, solvers });
  return { session: draft.session, proposedExercises: draft.proposedExercises ?? [], errors: draft.errors, rounds, crossCheck: check };
}

export function renderReport(result, { brief, drafter, reviewer, solvers } = {}) {
  const lines = [`# Authoring report: ${result.session?.id ?? brief?.id} - ${result.session?.title ?? brief?.title ?? ""}`, ""];
  lines.push(`- Drafter: ${drafter ?? "?"}; reviewer: ${reviewer ?? "?"}; solvers: ${(solvers ?? []).join(", ")}`);
  lines.push(`- Schema validation: ${result.errors.length ? `**${result.errors.length} error(s)**` : "passed"}`);
  const flagged = result.crossCheck.filter((r) => r.flagged);
  lines.push(`- Answer-key cross-check: ${result.crossCheck.length} questions, ${flagged.length ? `**${flagged.length} flagged**` : "all agree"}`);
  const last = result.rounds.at(-1);
  lines.push(`- Final review verdict: ${last ? `${last.verdict} (${last.issues.filter((i) => i.severity !== "minor").length} critical/major open)` : "no review"}`, "");
  if (result.errors.length) lines.push("## Validation errors", ...result.errors.map((e) => `- ${e}`), "");
  for (const r of result.rounds) {
    lines.push(`## Review round ${r.round}: ${r.verdict}`);
    for (const i of r.issues) lines.push(`- **${i.severity}** \`${i.path ?? ""}\`: ${i.problem}${i.fix ? ` → _${i.fix}_` : ""}`);
    if (r.changelog?.length) lines.push("", "Changes by the drafter:", ...r.changelog.map((c) => `- ${c.action}: ${c.issue}${c.note ? ` (${c.note})` : ""}`));
    lines.push("");
  }
  if (result.crossCheck.length) {
    lines.push("## Answer-key cross-check", "", "| Question | Key | " + (solvers ?? Object.keys(result.crossCheck[0].answers)).join(" | ") + " |", "|---|---|" + (solvers ?? Object.keys(result.crossCheck[0].answers)).map(() => "---").join("|") + "|");
    for (const r of result.crossCheck) lines.push(`| ${r.flagged ? "⚠️ " : ""}${r.id} (${r.where}) | ${r.key} | ${Object.values(r.answers).map((a) => `${a.ok ? "✓" : "✗"} ${a.answer}`).join(" | ")} |`);
    lines.push("");
  }
  if (result.proposedExercises.length) {
    lines.push("## Proposed exercise generators (implement in app/src/exercises.js)");
    for (const e of result.proposedExercises) lines.push(`- \`${e.id}\` - ${e.title}: ${e.formula ?? ""}. Example: ${e.sampleProblem ?? ""} → ${e.sampleAnswer ?? ""}`);
    lines.push("");
  }
  lines.push(
    "## Human checklist before `promote`",
    "- [ ] Every ⚠️ answer key above resolved",
    "- [ ] Worked examples recomputed by hand or in a spreadsheet",
    "- [ ] No sentence copied from the book",
    "- [ ] Read the session once in the app (`npm run serve`)",
  );
  return lines.join("\n") + "\n";
}

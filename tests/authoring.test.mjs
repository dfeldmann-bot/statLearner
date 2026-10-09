import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { extractJson } from "../authoring/json.mjs";
import { runPipeline, renderReport, fixedQuestions, agrees } from "../authoring/pipeline.mjs";
import { draftPrompt, reviewPrompt, solvePrompt } from "../authoring/prompts.mjs";
import { manualProvider, ManualStepRequired, makeProvider } from "../authoring/providers.mjs";
import { EXERCISE_IDS } from "../app/src/exercises.js";
import { SIM_IDS } from "../app/src/sims.js";

const ctx = { exerciseIds: EXERCISE_IDS, simIds: SIM_IDS };
const s01 = JSON.parse(await readFile(new URL("../app/content/sessions/s01-describing-data.json", import.meta.url), "utf8"));
const brief = JSON.parse(await readFile(new URL("../authoring/briefs/s08-comparing-groups.json", import.meta.url), "utf8"));

// A fake session for "s08" built from s01 by renaming ids.
const fakeSession = JSON.parse(JSON.stringify(s01).replaceAll('"s01-', '"s08-').replace('"id":"s01"', '"id":"s08"'));

test("extractJson handles plain, fenced and chatty replies", () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extractJson('Here you go:\n```json\n{"a":2}\n```\nCheers'), { a: 2 });
  assert.deepEqual(extractJson('Sure! {"a":3} hope that helps'), { a: 3 });
  assert.throws(() => extractJson("no json here"), /not valid JSON/);
});

test("prompts include schema, catalog, rules and never leak answer keys to solvers", () => {
  const p = draftPrompt(brief, s01);
  assert.ok(p.prompt.includes("SCHEMA") && p.prompt.includes("se-proportion") && p.prompt.includes("ci-coverage"));
  assert.ok(p.system.includes("Originality"));
  assert.ok(reviewPrompt({ session: fakeSession }, brief).prompt.includes("recompute every number"));
  const q = { id: "x", type: "choice", prompt: "Pick", options: ["a", "b"], answer: 1, explain: "SECRET" };
  const sp = solvePrompt(q);
  assert.ok(!sp.prompt.includes("SECRET") && !sp.prompt.includes('"answer": 1'));
});

test("agrees() compares choices exactly and numbers within tolerance", () => {
  assert.ok(agrees({ type: "choice", answer: 2 }, 2));
  assert.ok(!agrees({ type: "choice", answer: 2 }, "1"));
  assert.ok(agrees({ type: "numeric", answer: 0.25 }, 0.252));
  assert.ok(!agrees({ type: "numeric", answer: 0.25, tolerance: 0.001 }, 0.252));
  assert.equal(fixedQuestions(fakeSession).length, 1 + 1 + 3);
});

function fake(name, handler) {
  const calls = [];
  return { name, calls, async complete(req) { calls.push(req); return handler(req, calls.length); } };
}

test("full pipeline: repair, review, revise, approve, cross-check, report", async () => {
  const broken = { ...fakeSession, quiz: fakeSession.quiz.slice(0, 2) }; // fails "at least 3 questions"
  const drafter = fake("claude:test", (req, n) => {
    if (n === 1) return "Here is the draft:\n```json\n" + JSON.stringify({ session: broken, proposedExercises: [{ id: "se-diff-proportions", title: "SE of a difference" }] }) + "\n```";
    if (req.system.includes("validator")) return JSON.stringify({ session: fakeSession });
    return JSON.stringify({ session: fakeSession, changelog: [{ issue: "wording", action: "fixed", note: "" }] });
  });
  const reviewer = fake("openai:test", (req, n) =>
    JSON.stringify(n === 1 ? { verdict: "revise", issues: [{ severity: "major", path: "blocks[0]", problem: "too long", fix: "split" }] } : { verdict: "approve", issues: [{ severity: "minor", problem: "polish" }] }),
  );
  // Solver A answers every key correctly; solver B gets the first choice question wrong.
  const keyFor = (prompt) => fixedQuestions(fakeSession).find(({ q }) => prompt.startsWith(q.prompt)).q;
  const solverA = fake("claude:solver", (req) => JSON.stringify({ answer: keyFor(req.prompt).answer }));
  const solverB = fake("openai:solver", (req) => {
    const q = keyFor(req.prompt);
    return JSON.stringify({ answer: q.id === "s08-w1" ? q.answer + 1 : q.answer });
  });
  const result = await runPipeline({ brief, drafter, reviewer, solvers: [solverA, solverB], reference: s01, ctx, maxRounds: 3 });
  assert.deepEqual(result.errors, []);
  assert.equal(result.rounds.length, 2);
  assert.equal(result.rounds[0].changelog.length, 1);
  assert.equal(result.proposedExercises[0].id, "se-diff-proportions", "proposals survive the repair step");
  assert.equal(result.crossCheck.filter((r) => r.flagged).map((r) => r.id).join(), "s08-w1");
  const report = renderReport(result, { brief, drafter: drafter.name, reviewer: reviewer.name, solvers: [solverA.name, solverB.name] });
  assert.ok(report.includes("⚠️ s08-w1") && report.includes("Review round 1: revise") && report.includes("se-diff-proportions"));
});

test("manual provider writes the prompt, then reads the pasted reply", async () => {
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = await mkdtemp(path.join(os.tmpdir(), "statlearner-manual-"));
  const p = manualProvider({ dir });
  await assert.rejects(p.complete({ system: "S", prompt: "P", name: "step1" }), ManualStepRequired);
  assert.ok((await readFile(path.join(dir, "step1.prompt.md"), "utf8")).includes("P"));
  await writeFile(path.join(dir, "step1.response.md"), '{"ok":true}');
  assert.equal(await p.complete({ system: "S", prompt: "P", name: "step1" }), '{"ok":true}');
  assert.throws(() => makeProvider("bard"), /Unknown provider/);
});

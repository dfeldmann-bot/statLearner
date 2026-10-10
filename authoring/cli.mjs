#!/usr/bin/env node
// statLearner authoring CLI - Claude and ChatGPT co-write course sessions.
//
//   npm run author -- run authoring/briefs/s14-clustering.json
//   npm run author -- run <brief> --drafter openai --reviewer claude   (swap roles)
//   npm run author -- run <brief> --drafter manual --reviewer manual   (no API keys: copy-paste)
//   npm run author -- prompt <brief>              print the draft prompt and exit
//   npm run author -- draft <brief>
//   npm run author -- review <session.json> [--brief <brief>]
//   npm run author -- revise <session.json> <review.json>
//   npm run author -- crosscheck <session.json>
//   npm run author -- promote <session.json>      validate and add to the course

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXERCISE_IDS } from "../app/src/exercises.js";
import { SIM_IDS } from "../app/src/sims.js";
import { validateSession } from "../app/src/schema.js";
import { makeProvider, ManualStepRequired } from "./providers.mjs";
import { draftPrompt } from "./prompts.mjs";
import { draftSession, reviewSession, reviseSession, crossCheck, runPipeline, renderReport } from "./pipeline.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { exerciseIds: EXERCISE_IDS, simIds: SIM_IDS };
const readJson = async (f) => JSON.parse(await readFile(path.resolve(f), "utf8"));
const writeJson = (f, data) => writeFile(f, JSON.stringify(data, null, 2) + "\n");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) args[key] = true;
      else args[key] = argv[++i];
    } else args._.push(argv[i]);
  }
  return args;
}

async function setup(args) {
  const config = await readJson(path.join(root, "authoring/config.json"));
  const providerConfig = { ...config.providers, outDir: config.outDir };
  const drafterName = args.drafter ?? config.roles.drafter;
  const reviewerName = args.reviewer ?? config.roles.reviewer;
  const solverNames = (args.solvers ?? config.roles.solvers.join(",")).split(",");
  return {
    config,
    drafter: makeProvider(drafterName, providerConfig),
    reviewer: makeProvider(reviewerName, providerConfig),
    solvers: solverNames.map((n) => makeProvider(n, providerConfig)),
  };
}

// A finished session from the same part as the brief serves as the style reference.
async function reference(brief = {}) {
  const course = await readJson(path.join(root, "app/content/course.json"));
  const sessions = await Promise.all(course.sessions.map((f) => readJson(path.join(root, "app/content/sessions", `${f}.json`))));
  return sessions.find((s) => s.part === brief.part && s.id !== brief.id) ?? sessions[0];
}

async function outDir(config, id) {
  const dir = path.join(root, config.outDir, id);
  await mkdir(dir, { recursive: true });
  return dir;
}

const log = (msg) => console.log(msg);

async function promote(file) {
  const session = (await readJson(file)).session ?? (await readJson(file));
  const errors = validateSession(session, ctx);
  if (errors.length) throw new Error(`Session is invalid:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  const name = `${session.id}-${session.slug ?? "session"}`;
  await writeJson(path.join(root, "app/content/sessions", `${name}.json`), session);
  const coursePath = path.join(root, "app/content/course.json");
  const course = await readJson(coursePath);
  course.sessions = [...course.sessions.filter((s) => !s.startsWith(`${session.id}-`)), name].sort();
  await writeJson(coursePath, course);
  // Keep the offline cache in sync and force clients to refresh it.
  const swPath = path.join(root, "app/sw.js");
  let sw = await readFile(swPath, "utf8");
  const entry = `"content/sessions/${name}.json"`;
  if (!sw.includes(entry)) sw = sw.replace(/("content\/course\.json",\n)/, `$1  ${entry},\n`);
  sw = sw.replace(/statlearner-v(\d+)/, (_, v) => `statlearner-v${Number(v) + 1}`);
  await writeFile(swPath, sw);
  console.log(`Promoted ${name}. Run \`npm test\` and check it in the app (\`npm run serve\`).`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [cmd, a, b] = args._;
  if (!cmd || args.help) {
    console.log((await readFile(fileURLToPath(import.meta.url), "utf8")).split("\n").slice(1, 13).join("\n").replace(/^\/\/ ?/gm, ""));
    return;
  }
  if (cmd === "promote") return promote(a);
  const { config, drafter, reviewer, solvers } = await setup(args);
  const maxRepair = config.maxRepairAttempts;

  if (cmd === "prompt") {
    const brief = await readJson(a);
    const p = draftPrompt(brief, await reference(brief));
    console.log(`=== SYSTEM ===\n${p.system}\n\n=== USER ===\n${p.prompt}`);
    return;
  }
  if (cmd === "run") {
    const brief = await readJson(a);
    const dir = await outDir(config, brief.id);
    const result = await runPipeline({ brief, drafter, reviewer, solvers, reference: await reference(brief), ctx, maxRounds: Number(args.rounds ?? config.maxReviewRounds), maxRepair, log });
    await writeJson(path.join(dir, "session.json"), { session: result.session, proposedExercises: result.proposedExercises });
    await writeJson(path.join(dir, "result.json"), result);
    const report = renderReport(result, { brief, drafter: drafter.name, reviewer: reviewer.name, solvers: solvers.map((s) => s.name) });
    await writeFile(path.join(dir, "report.md"), report);
    console.log(`\nDone. Read ${path.relative(root, path.join(dir, "report.md"))}, then: npm run author -- promote ${path.relative(root, path.join(dir, "session.json"))}`);
    return;
  }
  if (cmd === "draft") {
    const brief = await readJson(a);
    const draft = await draftSession({ brief, drafter, reference: await reference(brief), ctx, maxRepair, log });
    const file = path.join(await outDir(config, brief.id), "draft.json");
    await writeJson(file, draft);
    console.log(`Draft saved to ${path.relative(root, file)} (${draft.errors.length} validation errors).`);
    return;
  }
  if (cmd === "review") {
    const draft = await readJson(a);
    const brief = args.brief ? await readJson(args.brief) : undefined;
    const review = await reviewSession({ draft: draft.session ? draft : { session: draft }, brief, reviewer });
    const file = path.join(await outDir(config, (draft.session ?? draft).id), "review.json");
    await writeJson(file, review);
    console.log(`Verdict ${review.verdict}, ${review.issues.length} issues. Saved to ${path.relative(root, file)}.`);
    return;
  }
  if (cmd === "revise") {
    const draft = await readJson(a);
    const revised = await reviseSession({ draft: draft.session ? draft : { session: draft }, review: await readJson(b), drafter, ctx, maxRepair, log });
    const file = path.join(await outDir(config, revised.session.id), "revised.json");
    await writeJson(file, revised);
    console.log(`Revised session saved to ${path.relative(root, file)} (${revised.errors.length} validation errors).`);
    return;
  }
  if (cmd === "crosscheck") {
    const draft = await readJson(a);
    const session = draft.session ?? draft;
    const rows = await crossCheck({ session, solvers });
    for (const r of rows) console.log(`${r.flagged ? "⚠️ " : "✓ "} ${r.id}: key ${r.key} | ${Object.entries(r.answers).map(([n, x]) => `${n}: ${x.answer}`).join(" | ")}`);
    return;
  }
  throw new Error(`Unknown command "${cmd}". Run with --help.`);
}

main().catch((e) => {
  if (e instanceof ManualStepRequired) {
    console.log(`\n${e.message}`);
    process.exitCode = 2;
  } else {
    console.error(`Error: ${e.message}`);
    process.exitCode = 1;
  }
});

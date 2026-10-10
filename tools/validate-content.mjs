// Validates app/content against the schema. Usage:
//   node tools/validate-content.mjs              # the whole course
//   node tools/validate-content.mjs draft.json   # one session file (e.g. an LLM draft)
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateCourse, validateSession } from "../app/src/schema.js";
import { EXERCISE_IDS } from "../app/src/exercises.js";
import { SIM_IDS } from "../app/src/sims.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = { exerciseIds: EXERCISE_IDS, simIds: SIM_IDS };

export async function loadCourse() {
  const course = JSON.parse(await readFile(path.join(root, "app/content/course.json"), "utf8"));
  const sessions = [];
  for (const file of course.sessions) {
    sessions.push(JSON.parse(await readFile(path.join(root, "app/content/sessions", `${file}.json`), "utf8")));
  }
  return { course, sessions };
}

async function main() {
  const files = process.argv.slice(2);
  let errors;
  if (files.length) {
    errors = [];
    for (const f of files) {
      const session = JSON.parse(await readFile(f, "utf8"));
      errors.push(...validateSession(session, ctx).map((e) => `${f}: ${e}`));
    }
  } else {
    const { course, sessions } = await loadCourse();
    errors = validateCourse(course, sessions, ctx);
    if (!errors.length) {
      const cards = sessions.reduce((n, s) => n + s.cards.length, 0);
      const quiz = sessions.reduce((n, s) => n + s.quiz.length, 0);
      console.log(`OK: ${sessions.length} sessions, ${quiz} quiz questions, ${cards} flashcards, ${EXERCISE_IDS.size} exercise generators, ${SIM_IDS.size} simulations.`);
    }
  }
  for (const e of errors) console.error(`✗ ${e}`);
  process.exitCode = errors.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

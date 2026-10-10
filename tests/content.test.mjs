import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCourse } from "../tools/validate-content.mjs";
import { validateCourse, validateSession } from "../app/src/schema.js";
import { EXERCISE_IDS, EXERCISES } from "../app/src/exercises.js";
import { SIM_IDS } from "../app/src/sims.js";
import { renderMarkdown } from "../app/src/markdown.js";

const ctx = { exerciseIds: EXERCISE_IDS, simIds: SIM_IDS };
const { course, sessions } = await loadCourse();

function* strings(node) {
  if (typeof node === "string") yield node;
  else if (Array.isArray(node)) for (const v of node) yield* strings(v);
  else if (node && typeof node === "object") for (const v of Object.values(node)) yield* strings(v);
}

test("course content is valid", () => {
  assert.deepEqual(validateCourse(course, sessions, ctx), []);
});

test("every text renders and has balanced math delimiters", () => {
  for (const s of sessions) {
    for (const str of strings(s)) {
      const dollars = (str.replace(/\\\$/g, "").match(/\$/g) ?? []).length;
      assert.equal(dollars % 2, 0, `${s.id}: unbalanced $ in "${str.slice(0, 80)}"`);
      assert.ok(!renderMarkdown(str).includes("<script"), "no raw HTML");
    }
  }
});

test("every exercise generator and simulation is used by some session", () => {
  const used = new Set(JSON.stringify(sessions).match(/"(exercise|sim)":\s*"([^"]+)"/g).map((m) => m.split('"')[3]));
  for (const id of EXERCISE_IDS) assert.ok(used.has(id), `exercise "${id}" unused`);
  for (const id of SIM_IDS) assert.ok(used.has(id), `sim "${id}" unused`);
});

test("sessions build in order and practise their own topic", () => {
  sessions.forEach((s, i) => assert.equal(s.id, `s${String(i + 1).padStart(2, "0")}`));
  for (const s of sessions) {
    for (const b of s.blocks) if (b.type === "practice") assert.equal(EXERCISES[b.exercise].session, s.id, `${s.id} practises ${b.exercise}`);
  }
});

test("course is mapped to the book and every Part B session cites ITILA", () => {
  assert.match(course.book.title, /Information Theory, Inference, and Learning Algorithms/);
  assert.match(course.book.url, /^https:\/\/www\.inference\.org\.uk\//);
  for (const s of sessions) {
    assert.ok(s.bookRef, `${s.id} has a bookRef`);
    if (s.part === "B") assert.match(s.bookRef, /^ITILA ch\. \d+/, `${s.id} cites ITILA chapters`);
    for (const l of s.lectures ?? []) assert.ok(l.number >= 1 && l.number <= 16, `${s.id} lecture number`);
  }
});

test("validator catches broken content", () => {
  const broken = structuredClone(sessions[0]);
  broken.quiz[2].answer = 9;
  broken.blocks.push({ type: "sim", sim: "nope" });
  broken.cards.push({ id: "x-1", kind: "formula", front: "f" });
  broken.lectures = [{ number: 2, title: "t", url: "ftp://x" }];
  const errors = validateSession(broken, ctx);
  assert.ok(errors.some((e) => e.includes("quiz[2].answer")));
  assert.ok(errors.some((e) => e.includes('unknown simulation "nope"')));
  assert.ok(errors.some((e) => e.includes("back")));
  assert.ok(errors.some((e) => e.includes('should start with "s01-"')));
  assert.ok(errors.some((e) => e.includes("lectures[0]")));
});

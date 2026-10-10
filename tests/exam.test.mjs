import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCourse } from "../tools/validate-content.mjs";
import { buildExam, numericToChoice, scoreExam, EXAM_SIZE } from "../app/src/exam.js";
import { EXERCISES, generate } from "../app/src/exercises.js";
import { checkNumeric } from "../app/src/check.js";
import { makeRng } from "../app/src/rng.js";

const { sessions } = await loadCourse();
const asNumber = (option) => Number(option.replace("−", "-"));

test("every session's exam is multiple choice only, with one right option", () => {
  for (const s of sessions) {
    for (let seed = 1; seed <= 40; seed++) {
      const exam = buildExam(s, makeRng(`${s.id}-${seed}`));
      assert.equal(exam.length, EXAM_SIZE, `${s.id} exam size`);
      assert.equal(new Set(exam.map((q) => q.prompt)).size, exam.length, `${s.id}: no question twice`);
      for (const q of exam) {
        assert.equal(q.type, "choice", `${s.id}: ${q.prompt.slice(0, 60)}`);
        assert.ok(q.options.length >= 2 && q.options.length <= 6);
        assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);
        assert.equal(new Set(q.options).size, q.options.length, `${s.id}: duplicate options in "${q.prompt.slice(0, 60)}"`);
        assert.ok(q.explain || q.steps?.length, `${s.id}: every question explains its answer`);
      }
    }
  }
});

test("exam options are shuffled: the right answer is not always first", () => {
  const positions = [0, 0, 0, 0, 0, 0];
  for (const s of sessions) for (let seed = 1; seed <= 20; seed++) for (const q of buildExam(s, makeRng(`${s.id}/${seed}`))) positions[q.answer]++;
  const total = positions.reduce((a, b) => a + b, 0);
  assert.ok(positions[0] / total < 0.4, `answer is first in ${positions[0]} of ${total} questions`);
  assert.ok(positions[1] / total > 0.15 && positions[2] / total > 0.15, `positions ${positions}`);
});

test("numeric exercises become choice questions the checker agrees with", () => {
  const rng = makeRng(42);
  for (const id of Object.keys(EXERCISES)) {
    for (let k = 0; k < 60; k++) {
      const q = generate(id, rng);
      if (q.type !== "numeric") continue;
      const mc = numericToChoice(q, rng, () => Array.from({ length: 6 }, () => generate(id, rng).answer));
      assert.equal(mc.options.length, 4, `${id}: four options for "${q.prompt.slice(-60)}"`);
      mc.options.forEach((option, i) => {
        const ok = checkNumeric(String(asNumber(option)), q.answer, q.tolerance).ok;
        assert.equal(ok, i === mc.answer, `${id}: option "${option}" for answer ${q.answer} (tolerance ${q.tolerance})`);
      });
      assert.ok(!/Round to \d+ decimals/.test(mc.prompt), `${id}: rounding instruction removed`);
    }
  }
});

test("wrong options respect the kind of answer", () => {
  const rng = makeRng(7);
  for (let k = 0; k < 50; k++) {
    const prob = numericToChoice({ type: "numeric", prompt: "What is the probability?", answer: 0.9, tolerance: 0.001 }, rng);
    for (const o of prob.options) assert.ok(asNumber(o) >= 0 && asNumber(o) <= 1, `probability option ${o}`);
    const count = numericToChoice({ type: "numeric", prompt: "How many questions?", answer: 6, tolerance: 0 }, rng);
    for (const o of count.options) assert.ok(Number.isInteger(asNumber(o)) && asNumber(o) >= 0, `count option ${o}`);
    const z = numericToChoice({ type: "numeric", prompt: "Give the z-score.", answer: -1.5, tolerance: 0.01 }, rng);
    assert.equal(z.options[z.answer], "−1.5");
  }
});

test("scoreExam counts answers so far", () => {
  const qs = [{ answer: 1 }, { answer: 0 }, { answer: 2 }, { answer: 3 }];
  assert.deepEqual(scoreExam(qs, [1, 0, 1, 3]), { correct: 3, total: 4, score: 0.75 });
  assert.deepEqual(scoreExam(qs, [1]), { correct: 1, total: 4, score: 0.25 });
});

test("an exam survives a save and reload as JSON", () => {
  const exam = buildExam(sessions[1], makeRng(9));
  assert.deepEqual(JSON.parse(JSON.stringify(exam)).map((q) => q.options[q.answer]), exam.map((q) => q.options[q.answer]));
});

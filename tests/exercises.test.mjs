import { test } from "node:test";
import assert from "node:assert/strict";
import { EXERCISES, generate, fmt } from "../app/src/exercises.js";
import { makeRng } from "../app/src/rng.js";
import { checkNumeric } from "../app/src/check.js";
import { renderMarkdown } from "../app/src/markdown.js";

// Unescaped "$" signs must pair up, or math rendering breaks.
const dollarsBalanced = (md) => (md.replace(/\\\$/g, "").match(/\$/g) ?? []).length % 2 === 0;

for (const id of Object.keys(EXERCISES)) {
  test(`exercise "${id}" is well-formed for many seeds`, () => {
    for (let seed = 1; seed <= 300; seed++) {
      const ex = generate(id, makeRng(`${id}-${seed}`));
      assert.ok(["numeric", "choice"].includes(ex.type));
      assert.ok(ex.prompt && ex.hint && ex.steps.length > 0, "prompt, hint and steps");
      for (const md of [ex.prompt, ex.hint, ...ex.steps]) {
        assert.ok(dollarsBalanced(md), `unbalanced $ in: ${md}`);
        assert.ok(!/undefined|NaN|Infinity/.test(md), `bad value in: ${md}`);
        renderMarkdown(md);
      }
      if (ex.type === "numeric") {
        assert.ok(Number.isFinite(ex.answer), "finite answer");
        assert.ok(checkNumeric(String(ex.answer), ex.answer, ex.tolerance).ok, "own answer accepted");
        assert.ok(checkNumeric(fmt(ex.answer, 4), ex.answer, ex.tolerance).ok, "rounded answer accepted");
      } else {
        assert.equal(new Set(ex.options).size, ex.options.length, `duplicate options: ${ex.options}`);
        assert.ok(Number.isInteger(ex.answer) && ex.answer >= 0 && ex.answer < ex.options.length);
      }
    }
  });
}

test("generation is deterministic for a seed", () => {
  assert.deepEqual(generate("bayes-test", makeRng(5)), generate("bayes-test", makeRng(5)));
});

test("spot-check known answers", () => {
  // Bayes with 1% prevalence, 99% sensitivity, 95% specificity -> about 0.167.
  let found = false;
  for (let seed = 0; seed < 2000 && !found; seed++) {
    const ex = generate("bayes-test", makeRng(seed));
    if (ex.prompt.includes("affects 1% ") && ex.prompt.includes("99% of sick") && ex.prompt.includes("95% of healthy")) {
      assert.ok(Math.abs(ex.answer - 0.1667) < 0.001);
      found = true;
    }
  }
  assert.ok(found, "scenario reached");
  const ss = generate("sample-size", makeRng(1));
  assert.ok(Number.isInteger(ss.answer));
});

test("unknown exercise throws", () => assert.throws(() => generate("nope", makeRng(1))));

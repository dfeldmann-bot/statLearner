import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, formatResult } from "../app/src/calc.js";

const value = (text, opts) => {
  const r = evaluate(text, opts);
  assert.ok(r.ok, `${text}: ${r.error}`);
  return r.value;
};
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test("calculator follows the usual precedence rules", () => {
  assert.equal(value("1 + 2 * 3"), 7);
  assert.equal(value("(1 + 2) * 3"), 9);
  assert.equal(value("-2^2"), -4);
  assert.equal(value("2^3^2"), 512);
  assert.equal(value("2^-1"), 0.5);
  assert.equal(value("10 - 4 - 3"), 3);
  assert.equal(value("12 / 3 / 2"), 2);
});

test("calculator knows the functions a statistics learner needs", () => {
  close(value("sqrt(0.4*0.6/200)"), Math.sqrt(0.0012));
  assert.equal(value("C(5,2) * 0.5^5"), 0.3125);
  assert.equal(value("nCr(10, 3)"), 120);
  assert.equal(value("-log2(1/8)"), 3);
  assert.equal(value("log(1000)"), 3);
  close(value("ln(e)"), 1);
  close(value("exp(0)"), 1);
  assert.equal(value("abs(-2.5)"), 2.5);
  assert.equal(value("5!"), 120);
  assert.equal(value("√16 + 1"), 5);
  assert.equal(value("25%"), 0.25);
});

test("calculator accepts keypad symbols, implicit products and the previous answer", () => {
  assert.equal(value("12 × 3 ÷ 4 − 1"), 8);
  close(value("2pi"), 2 * Math.PI);
  assert.equal(value("3(1 + 2)"), 9);
  close(value("0.3²"), 0.09);
  assert.equal(value("ans * 2", { ans: 21 }), 42);
  assert.equal(value("1e-3 * 2"), 0.002);
});

test("calculator explains bad input instead of throwing", () => {
  for (const [text, message] of [
    ["", /Type an expression/],
    ["2 *", /ends too early/],
    ["(1 + 2", /Missing "\)"/],
    ["1 / 0", /infinite/],
    ["sqrt(-1)", /Not a number/],
    ["foo(2)", /Unknown name/],
    ["0,25", /Use "\." for decimals/],
    ["2.5!", /whole number/],
    ["alert(1)", /Unknown name/],
  ]) {
    const r = evaluate(text);
    assert.equal(r.ok, false, text);
    assert.match(r.error, message, text);
  }
});

test("calculator results are typed back as plain numbers", () => {
  assert.equal(formatResult(0.1 + 0.2), "0.3");
  assert.equal(formatResult(2 / 3), "0.6666666667");
  assert.equal(formatResult(-0), "0");
  assert.equal(formatResult(1e-7), "1e-7");
});

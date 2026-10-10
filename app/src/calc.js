// Calculator engine: evaluates expressions such as "sqrt(0.4*0.6/200)",
// "1 - 0.3^2", "C(5,2) * 0.5^5" or "-log2(1/8)" without eval().
//
// Grammar (lowest to highest precedence):
//   expr    = term (("+" | "-") term)*
//   term    = unary (("*" | "/") unary | unary)*     a bare unary is implicit "*": 2pi, 3(1+2)
//   unary   = ("-" | "+") unary | power
//   power   = postfix ("^" unary)?                   right-associative: 2^3^2 = 2^9, -2^2 = -4
//   postfix = primary ("!" | "%")*
//   primary = number | constant | name "(" expr ("," expr)* ")" | "√" postfix | "(" expr ")"

import { choose } from "./stats.js";

const FUNCTIONS = {
  sqrt: [1, Math.sqrt],
  ln: [1, Math.log],
  log: [1, Math.log10],
  log10: [1, Math.log10],
  log2: [1, Math.log2],
  exp: [1, Math.exp],
  abs: [1, Math.abs],
  C: [2, (n, k) => (isWhole(n) && isWhole(k) ? choose(n, k) : fail("C(n, k) needs whole numbers"))],
  nCr: [2, (n, k) => FUNCTIONS.C[1](n, k)],
};
const CONSTANTS = { pi: Math.PI, "π": Math.PI, e: Math.E };
const lookup = (table, name) => Object.entries(table).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
const ALIASES = { "×": "*", "·": "*", "÷": "/", "−": "-", "–": "-", "²": "^2", "³": "^3" };

const isWhole = (x) => Number.isInteger(x) && x >= 0;
function fail(message) {
  throw new Error(message);
}

function factorial(n) {
  if (!isWhole(n)) fail("! needs a whole number");
  if (n > 170) return Infinity;
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

export function tokenize(text) {
  let s = String(text);
  for (const [from, to] of Object.entries(ALIASES)) s = s.split(from).join(to);
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[\d.]/.test(ch)) {
      const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
      if (!m) fail(`Unexpected "${ch}"`);
      tokens.push({ type: "num", value: Number(m[0]) });
      i += m[0].length;
    } else if (/[a-zπ]/i.test(ch)) {
      const name = s.slice(i).match(/^(π|[a-z][a-z0-9]*)/i)[0];
      tokens.push({ type: "name", value: name });
      i += name.length;
    } else if ("+-*/^()!%,√".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
    } else {
      fail(`Unexpected "${ch}"`);
    }
  }
  return tokens;
}

// Returns { ok: true, value } or { ok: false, error }. `ans` is the previous result.
export function evaluate(text, { ans = 0 } = {}) {
  try {
    const tokens = tokenize(text);
    if (!tokens.length) return { ok: false, error: "Type an expression" };
    let pos = 0;
    const peek = () => tokens[pos];
    const isOp = (v) => peek()?.type === "op" && peek().value === v;
    const expect = (v) => (isOp(v) ? pos++ : fail(peek() ? `Expected "${v}"` : `Missing "${v}"`));
    const startsPrimary = () => peek() && (peek().type !== "op" || isOp("(") || isOp("√"));

    const expr = () => {
      let v = term();
      while (isOp("+") || isOp("-")) v = tokens[pos++].value === "+" ? v + term() : v - term();
      return v;
    };
    const term = () => {
      let v = unary();
      for (;;) {
        if (isOp("*") || isOp("/")) {
          const op = tokens[pos++].value;
          const rhs = unary();
          v = op === "*" ? v * rhs : v / rhs;
        } else if (startsPrimary()) {
          v *= unary();
        } else {
          return v;
        }
      }
    };
    const unary = () => {
      if (isOp("-")) return pos++, -unary();
      if (isOp("+")) return pos++, unary();
      return power();
    };
    const power = () => {
      const base = postfix();
      if (!isOp("^")) return base;
      pos++;
      return base ** unary();
    };
    const postfix = () => {
      let v = primary();
      for (;;) {
        if (isOp("!")) v = factorial(v);
        else if (isOp("%")) v /= 100;
        else return v;
        pos++;
      }
    };
    const primary = () => {
      const t = peek();
      if (!t) fail("The expression ends too early");
      if (t.type === "num") return pos++, t.value;
      if (isOp("(")) {
        pos++;
        const v = expr();
        expect(")");
        return v;
      }
      if (isOp("√")) return pos++, Math.sqrt(postfix());
      if (t.type === "name") {
        pos++;
        if (t.value.toLowerCase() === "ans") return ans;
        const fn = lookup(FUNCTIONS, t.value);
        if (fn) {
          expect("(");
          const args = [expr()];
          while (isOp(",")) {
            pos++;
            args.push(expr());
          }
          expect(")");
          if (args.length !== fn[0]) fail(`${t.value} takes ${fn[0]} value${fn[0] > 1 ? "s" : ""}`);
          return fn[1](...args);
        }
        const constant = lookup(CONSTANTS, t.value);
        if (constant !== undefined) return constant;
        fail(`Unknown name "${t.value}"`);
      }
      fail(`Unexpected "${t.value}"`);
    };

    const value = expr();
    if (isOp(",")) fail('Use "." for decimals (0.25); "," only separates the values in C(n, k)');
    if (pos < tokens.length) fail(`Unexpected "${tokens[pos].value}"`);
    if (Number.isNaN(value)) return { ok: false, error: "Not a number (for example the square root of a negative)" };
    if (!Number.isFinite(value)) return { ok: false, error: "Result is infinite (division by zero?)" };
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// A result as the learner should see and type it: up to 10 significant digits.
export function formatResult(x) {
  const v = Number(x.toPrecision(10));
  return Object.is(v, -0) ? "0" : String(v);
}

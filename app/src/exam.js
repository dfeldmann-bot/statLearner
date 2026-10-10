// Session exam: multiple choice only. It draws on the session's quiz and check
// questions and tops up with the session's exercise generators. Numeric
// questions become choice questions: the wrong options are typical slips
// (complement, factor of two, wrong sign) and answers to fresh versions of the
// same exercise, so they look plausible. Every question's options are shuffled.

import { EXERCISES, generate } from "./exercises.js";
import { fmt } from "./exkit.js";
import { defaultTolerance, shuffleChoice } from "./check.js";

export const EXAM_SIZE = 8;
const WRONG_OPTIONS = 3;

// Decimals to show: the prompt's "Round to N decimals", else what the tolerance can tell apart.
function decimalsFor(q, tol) {
  const stated = q.prompt.match(/Round to (\d+) decimals?/i);
  if (stated) return Number(stated[1]);
  if (tol > 0) return Math.min(4, Math.max(0, Math.ceil(-Math.log10(tol))));
  return Number.isInteger(q.answer) ? 0 : 4;
}

const display = (x, d) => fmt(x, d).replace(/^-/, "−");

// Wrong values a learner might plausibly reach for answer `a`.
function slips(a) {
  const out = [2 * a, a / 2, 1.5 * a, 0.75 * a];
  if (a !== 0) out.push(-a);
  if (a > 0 && a < 1) out.push(1 - a, a * a, Math.sqrt(a), a + 0.1, a - 0.1);
  else if (Math.abs(a) < 20) out.push(a + 1, a - 1); // off by one; meaningless for large values
  if (Math.abs(a) >= 1 && Math.abs(a) < 10) out.push(a * a, Math.sqrt(Math.abs(a))); // variance vs SD
  return out;
}

// Turn a numeric question into a choice question with one correct option.
// `alternatives` yields answers to other versions of the same exercise.
export function numericToChoice(q, rng, alternatives = () => []) {
  const a = q.answer;
  const tol = q.tolerance ?? defaultTolerance(a);
  const d = decimalsFor(q, tol);
  const others = alternatives();
  // Whole-number answers get whole-number wrong options, or the odd one out would give the answer away.
  const wholeOnly = Number.isInteger(a) && Math.abs(a) >= 2 && (d === 0 || (others.length > 0 && others.every(Number.isInteger)));
  const isProbability = a >= 0 && a <= 1 && /probab|proportion|share|p-value|P\(/i.test(q.prompt);
  const correct = display(a, d);
  const seen = new Set([correct]);
  const wrong = [];
  const consider = (x) => {
    if (wrong.length >= WRONG_OPTIONS || !Number.isFinite(x)) return;
    if (wholeOnly) x = Math.round(x);
    if (a >= 0 && x < 0) return;
    if (isProbability && x > 1) return;
    const text = display(x, d);
    // A wrong option must be wrong under the checker's tolerance and look different on screen.
    if (Math.abs(x - a) <= tol || Math.abs(Number(fmt(x, d)) - a) <= tol || seen.has(text)) return;
    seen.add(text);
    wrong.push(text);
  };
  const fromSlips = rng.shuffle(slips(a));
  const fromOthers = rng.shuffle(others);
  // Mix both kinds so neither the pattern of slips nor the spread of values gives the answer away.
  consider(fromSlips.shift());
  consider(fromOthers.shift());
  for (const x of [...fromSlips, ...fromOthers]) consider(x);
  // Fallback: step away from the answer until there are enough options.
  const step = Math.max(10 ** -d, Math.abs(a) * 0.15, tol * 2);
  for (let k = 1; wrong.length < WRONG_OPTIONS && k < 50; k++) consider(a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step);

  const options = rng.shuffle([correct, ...wrong]);
  return {
    type: "choice",
    prompt: q.prompt.replace(/\s*Round to \d+ decimals?\.?/i, ""),
    options,
    answer: options.indexOf(correct),
    explain: q.explain,
    steps: q.steps,
  };
}

// Any course question as a multiple-choice question with shuffled options.
export function asChoice(q, rng) {
  if (q.type === "generated") {
    const fresh = generate(q.exercise, rng);
    if (fresh.type === "choice") return shuffleChoice(fresh, rng.next);
    const others = () => Array.from({ length: 6 }, () => generate(q.exercise, rng).answer);
    return numericToChoice(fresh, rng, others);
  }
  if (q.type === "numeric") return numericToChoice(q, rng);
  return shuffleChoice(q, rng.next);
}

// The exam for one session: quiz and check questions, topped up with the
// session's generators (unused ones first) to `size` questions.
export function buildExam(session, rng, { size = EXAM_SIZE } = {}) {
  const pool = [...session.quiz, ...session.blocks.filter((b) => b.type === "check").map((b) => b.question)];
  const generators = Object.keys(EXERCISES).filter((k) => EXERCISES[k].session === session.id);
  const used = new Set(pool.map((q) => q.exercise));
  const extra = [...rng.shuffle(generators.filter((k) => !used.has(k))), ...rng.shuffle(generators)];
  while (pool.length < size && extra.length) pool.push({ type: "generated", exercise: extra.shift() });
  const prompts = new Set();
  return rng
    .shuffle(pool)
    .slice(0, size)
    .map((q) => {
      // A generator drawn twice may repeat its numbers; draw again so no question appears twice.
      let choice = asChoice(q, rng);
      for (let tries = 0; prompts.has(choice.prompt) && q.type === "generated" && tries < 10; tries++) choice = asChoice(q, rng);
      prompts.add(choice.prompt);
      return choice;
    });
}

// Score of a finished or partial exam: answers[i] is the option index chosen for question i.
export function scoreExam(questions, answers) {
  const correct = answers.filter((choice, i) => choice === questions[i].answer).length;
  return { correct, total: questions.length, score: questions.length ? correct / questions.length : 0 };
}

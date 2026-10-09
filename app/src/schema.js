// Content schema and validator. One source of truth used by the app, the
// content tests, `npm run validate` and the Claude/ChatGPT authoring pipeline.
// Returns a list of human-readable errors; an empty list means valid.

export const BLOCK_TYPES = ["text", "example", "sim", "check", "practice", "reflect", "callout"];
export const QUESTION_TYPES = ["choice", "numeric", "generated"];
export const CARD_KINDS = ["concept", "formula", "exercise"];
export const CALLOUT_KINDS = ["tip", "warning", "misconception"];

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);

export function validateQuestion(q, path, ctx, errors) {
  if (!q || typeof q !== "object") return errors.push(`${path}: must be an object`);
  if (!isStr(q.id)) errors.push(`${path}.id: required string`);
  if (!QUESTION_TYPES.includes(q.type)) return errors.push(`${path}.type: must be one of ${QUESTION_TYPES.join(", ")}`);
  if (q.type === "generated") {
    if (!ctx.exerciseIds.has(q.exercise)) errors.push(`${path}.exercise: unknown exercise "${q.exercise}"`);
    return;
  }
  if (!isStr(q.prompt)) errors.push(`${path}.prompt: required string`);
  if (!isStr(q.explain)) errors.push(`${path}.explain: required string (why the answer is right)`);
  if (q.type === "choice") {
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 || !q.options.every(isStr))
      errors.push(`${path}.options: 2-6 non-empty strings`);
    else if (!isInt(q.answer) || q.answer < 0 || q.answer >= q.options.length)
      errors.push(`${path}.answer: index into options (0-${q.options.length - 1})`);
    if (q.feedback !== undefined && (!Array.isArray(q.feedback) || q.feedback.length !== q.options?.length))
      errors.push(`${path}.feedback: one string per option`);
  }
  if (q.type === "numeric") {
    if (!isNum(q.answer)) errors.push(`${path}.answer: finite number`);
    if (q.tolerance !== undefined && !(isNum(q.tolerance) && q.tolerance >= 0)) errors.push(`${path}.tolerance: number >= 0`);
  }
}

function validateBlock(b, path, ctx, errors) {
  if (!b || !BLOCK_TYPES.includes(b.type)) return errors.push(`${path}.type: must be one of ${BLOCK_TYPES.join(", ")}`);
  switch (b.type) {
    case "text":
      if (!isStr(b.md)) errors.push(`${path}.md: required string`);
      break;
    case "example":
      if (!isStr(b.title)) errors.push(`${path}.title: required string`);
      if (!Array.isArray(b.steps) || !b.steps.length || !b.steps.every(isStr)) errors.push(`${path}.steps: non-empty list of strings`);
      if (b.reflect && (!isStr(b.reflect.prompt) || !isStr(b.reflect.answer))) errors.push(`${path}.reflect: needs prompt and answer`);
      break;
    case "sim":
      if (!ctx.simIds.has(b.sim)) errors.push(`${path}.sim: unknown simulation "${b.sim}"`);
      break;
    case "check":
      validateQuestion(b.question, `${path}.question`, ctx, errors);
      break;
    case "practice":
      if (!ctx.exerciseIds.has(b.exercise)) errors.push(`${path}.exercise: unknown exercise "${b.exercise}"`);
      if (!isInt(b.count) || b.count < 1 || b.count > 5) errors.push(`${path}.count: integer 1-5`);
      break;
    case "reflect":
      if (!isStr(b.prompt) || !isStr(b.answer)) errors.push(`${path}: reflect needs prompt and answer`);
      break;
    case "callout":
      if (!CALLOUT_KINDS.includes(b.kind)) errors.push(`${path}.kind: one of ${CALLOUT_KINDS.join(", ")}`);
      if (!isStr(b.md)) errors.push(`${path}.md: required string`);
      break;
  }
}

function validateCard(c, path, ctx, errors) {
  if (!c || !isStr(c.id)) return errors.push(`${path}.id: required string`);
  if (!CARD_KINDS.includes(c.kind)) errors.push(`${path}.kind: one of ${CARD_KINDS.join(", ")}`);
  if (c.kind === "exercise") {
    if (!ctx.exerciseIds.has(c.exercise)) errors.push(`${path}.exercise: unknown exercise "${c.exercise}"`);
  } else {
    if (!isStr(c.front)) errors.push(`${path}.front: required string`);
    if (!isStr(c.back)) errors.push(`${path}.back: required string`);
  }
}

export function validateSession(s, ctx) {
  const errors = [];
  if (!s || typeof s !== "object") return ["session: must be an object"];
  if (!/^s\d{2}$/.test(s.id ?? "")) errors.push('id: must look like "s01"');
  for (const key of ["title", "summary"]) if (!isStr(s[key])) errors.push(`${key}: required string`);
  if (!isNum(s.minutes) || s.minutes <= 0) errors.push("minutes: positive number");
  if (!Array.isArray(s.objectives) || !s.objectives.length || !s.objectives.every(isStr)) errors.push("objectives: non-empty list of strings");
  (s.warmup ?? []).forEach((q, i) => validateQuestion(q, `warmup[${i}]`, ctx, errors));
  if (!Array.isArray(s.blocks) || !s.blocks.length) errors.push("blocks: non-empty list");
  else s.blocks.forEach((b, i) => validateBlock(b, `blocks[${i}]`, ctx, errors));
  if (!Array.isArray(s.quiz) || s.quiz.length < 3) errors.push("quiz: at least 3 questions");
  else s.quiz.forEach((q, i) => validateQuestion(q, `quiz[${i}]`, ctx, errors));
  if (!Array.isArray(s.cards) || !s.cards.length) errors.push("cards: non-empty list");
  else s.cards.forEach((c, i) => validateCard(c, `cards[${i}]`, ctx, errors));

  const ids = collectIds(s);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`duplicate id "${id}"`);
    seen.add(id);
    if (s.id && !id.startsWith(`${s.id}-`)) errors.push(`id "${id}" should start with "${s.id}-"`);
  }
  return errors;
}

export function collectIds(s) {
  const ids = [];
  for (const q of s.warmup ?? []) ids.push(q.id);
  for (const b of s.blocks ?? []) if (b?.type === "check") ids.push(b.question?.id);
  for (const q of s.quiz ?? []) ids.push(q?.id);
  for (const c of s.cards ?? []) ids.push(c?.id);
  return ids.filter(Boolean);
}

export function validateCourse(course, sessions, ctx) {
  const errors = [];
  if (!isStr(course?.title)) errors.push("course.title: required string");
  if (!Array.isArray(course?.sessions) || !course.sessions.length) errors.push("course.sessions: non-empty list");
  const all = new Set();
  for (const s of sessions) {
    for (const e of validateSession(s, ctx)) errors.push(`${s?.id ?? "?"}: ${e}`);
    for (const id of collectIds(s)) {
      if (all.has(id)) errors.push(`duplicate id across sessions "${id}"`);
      all.add(id);
    }
  }
  return errors;
}

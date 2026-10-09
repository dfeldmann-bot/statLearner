// Prompt builders for the authoring pipeline. Every prompt carries the content
// schema, the catalog of exercise generators and simulations, and the
// learning-design rules, so Claude and ChatGPT produce the same format.

import { EXERCISES } from "../app/src/exercises.js";
import { SIMS } from "../app/src/sims.js";

export const SCHEMA = `
Session (JSON object):
{
  "id": "s08",                         // "s" + two digits
  "slug": "kebab-case-name",
  "title": string, "summary": string (one sentence),
  "bookRef": string,                   // matching book sections, e.g. "OpenIntro Statistics 4e, §6.2"
  "minutes": number,
  "objectives": [string, ...],         // 3-5, each starting with a verb
  "warmup": [Question, ...],           // 1 prediction question asked BEFORE teaching
  "blocks": [Block, ...],
  "quiz": [Question, ...],             // 6-8 questions, pass mark 80%
  "cards": [Card, ...]                 // 6-10 flashcards for spaced repetition
}
Block is one of:
  {"type":"text", "md": markdown}                                  // <= 150 words each
  {"type":"example", "title": string, "md"?: markdown, "steps": [markdown, ...], "reflect"?: {"prompt": markdown, "answer": markdown}}
  {"type":"sim", "sim": SIM_ID, "md": markdown}                    // md must ask for a prediction first
  {"type":"check", "question": Question}
  {"type":"practice", "exercise": EXERCISE_ID, "count": 1-5}       // count 3 = worked, partial, independent
  {"type":"reflect", "prompt": markdown, "answer": markdown}
  {"type":"callout", "kind": "tip" | "warning" | "misconception", "md": markdown}
Question is one of:
  {"id", "type":"choice", "prompt", "options": [2-6 strings], "answer": index, "explain", "feedback"?: [one string per option]}
  {"id", "type":"numeric", "prompt", "answer": number, "tolerance"?: number, "explain"}
  {"id", "type":"generated", "exercise": EXERCISE_ID}             // fresh random numbers every attempt
Card is one of:
  {"id", "kind": "concept" | "formula", "front": markdown, "back": markdown}
  {"id", "kind": "exercise", "exercise": EXERCISE_ID}
All ids are unique and start with the session id, e.g. "s08-q3", "s08-c2", "s08-w1", "s08-k1".
Markdown: paragraphs, ### headings, - lists, | tables |, **bold**, *italic*, $inline TeX$, $$display TeX$$.
Write a literal dollar sign as \\$. No HTML.`;

export const DESIGN_RULES = `
Learning-design rules (evidence-based; follow all of them):
1. Pretesting: open with one prediction question that most beginners get wrong; its "explain" resolves it.
2. Small steps: alternate short text blocks with something active (check, practice, sim, reflect). Never two long texts in a row.
3. Worked examples: 2 per session, 3-5 steps each, concrete numbers, original contexts. At least one has a self-explanation "reflect".
4. Faded practice: practice blocks with count 3 (worked -> partial -> independent) for each core skill.
5. Predict-observe-explain: every sim block asks for a prediction before the learner touches the sim.
6. Misconceptions: one callout per well-known misconception; choice distractors encode real misconceptions, with "feedback" explaining each.
7. Retrieval: quiz mixes generated exercises (procedures) and conceptual choice questions (understanding). Every question has an "explain".
8. Cards: atomic (one fact per card), concepts and formulas in words + symbols, plus 1-2 exercise cards for the core procedures.
9. Correctness: every number in steps, answers and explanations must be exactly right. Round only at the end and say how.
10. Originality: write in your own words with your own numbers. Never copy sentences, examples or exercises from the textbook; reference sections in "bookRef" instead.
11. Plain language: define every term at first use; one idea per paragraph; examples before abstractions.`;

const catalog = () =>
  [
    "Exercise generators (EXERCISE_ID - session - what it drills):",
    ...Object.entries(EXERCISES).map(([id, e]) => `  ${id} - ${e.session} - ${e.title}`),
    "Simulations (SIM_ID - what it shows):",
    ...Object.entries(SIMS).map(([id, s]) => `  ${id} - ${s.title}`),
  ].join("\n");

export function draftPrompt(brief, referenceSession) {
  return {
    system: `You are an expert statistics educator and instructional designer writing one session of "statLearner", a short, gamified, offline statistics course. You write precise, friendly, beginner-level material and you never make arithmetic mistakes.\n${DESIGN_RULES}`,
    prompt: `Write the session described by this brief.

BRIEF
${JSON.stringify(brief, null, 2)}

SCHEMA
${SCHEMA}

CATALOG (use only these ids in practice blocks, generated questions, exercise cards and sim blocks)
${catalog()}

If a core procedure of this session has no matching generator, do NOT invent an id. Instead describe the generator you would need in "proposedExercises" (a human will implement it), and use numeric/choice questions meanwhile.

REFERENCE: a finished session in the expected style and format:
${JSON.stringify(referenceSession)}

Reply with JSON only, in exactly this shape:
{"session": Session, "proposedExercises": [{"id": "kebab-id", "title": string, "skill": string, "formula": string, "sampleProblem": string, "sampleAnswer": string}]}`,
  };
}

export function repairPrompt(draft, errors) {
  return {
    system: "You fix JSON course content so it passes a strict validator. Change only what the errors require.",
    prompt: `The session below fails validation.

ERRORS
${errors.map((e) => `- ${e}`).join("\n")}

SCHEMA
${SCHEMA}

CATALOG
${catalog()}

SESSION
${JSON.stringify(draft.session ?? draft)}

Reply with JSON only: {"session": Session, "proposedExercises": [...]} (keep proposedExercises unchanged: ${JSON.stringify(draft.proposedExercises ?? [])}).`,
  };
}

export function reviewPrompt(draft, brief) {
  return {
    system: `You are a meticulous statistics professor and learning scientist reviewing course material written by another AI. You recompute every number yourself and you are hard to impress. Report problems; do not rewrite the session.\n${DESIGN_RULES}`,
    prompt: `Review this session against its brief.

Check, in order of importance:
1. Statistical correctness: recompute every number in examples, answers, explanations and cards; check formulas, definitions and claims.
2. Answer keys: is each "answer" right and unambiguous? Could a careful learner argue for another option?
3. Pedagogy: does it follow every learning-design rule? Are the misconceptions real and addressed?
4. Clarity for beginners: undefined jargon, long paragraphs, confusing wording.
5. Originality: anything that reads like copied textbook text.
6. Coverage of the brief's objectives.

BRIEF
${JSON.stringify(brief ?? {}, null, 2)}

SESSION
${JSON.stringify(draft.session ?? draft, null, 2)}

Reply with JSON only:
{"verdict": "approve" | "revise",
 "issues": [{"severity": "critical" | "major" | "minor", "path": "e.g. blocks[3].steps[1]", "problem": string, "fix": string}],
 "strengths": [string]}
Use "critical" for wrong statistics or wrong answer keys, "major" for pedagogy or clarity problems that would confuse learners, "minor" for polish. Verdict "approve" only if there are no critical or major issues.`,
  };
}

export function revisePrompt(draft, review) {
  return {
    system: `You are the author of this statLearner session. A reviewer checked it. Fix every critical and major issue and any minor issue you agree with. If you disagree with an issue, keep your version and explain why in the changelog.\n${DESIGN_RULES}`,
    prompt: `SCHEMA
${SCHEMA}

CATALOG
${catalog()}

CURRENT SESSION
${JSON.stringify(draft.session ?? draft)}

REVIEW
${JSON.stringify(review, null, 2)}

Reply with JSON only: {"session": Session, "proposedExercises": [...], "changelog": [{"issue": string, "action": "fixed" | "disagree", "note": string}]}`,
  };
}

// The solver never sees the answer key: it answers like a strong student.
export function solvePrompt(question) {
  const body =
    question.type === "choice"
      ? `${question.prompt}\n\nOptions:\n${question.options.map((o, i) => `${i}: ${o}`).join("\n")}\n\nReply with JSON only: {"answer": <option index>, "confidence": 0-1, "reason": "<one sentence>"}`
      : `${question.prompt}\n\nReply with JSON only: {"answer": <number>, "confidence": 0-1, "reason": "<one sentence>"}`;
  return {
    system: "You are a careful statistics expert taking a quiz. Work it out yourself, then answer exactly in the requested JSON format.",
    prompt: body,
  };
}

// FSRS-6 spaced-repetition scheduler (day-based, no fuzz).
//
// FSRS models each card's memory with two numbers:
//   stability S  - days until recall probability falls to 90%
//   difficulty D - 1 (easy) .. 10 (hard); slows stability growth
// and picks the next interval so that predicted recall equals the
// desired retention (default 0.9).
//
// Formulas follow the open-spaced-repetition reference implementation
// (py-fsrs, MIT) and the FSRS algorithm wiki:
// https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm

export const GRADE = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };

// FSRS-6 default parameters w0..w20 (trained on millions of Anki reviews).
export const DEFAULT_W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
  1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];

const DAY_MS = 86_400_000;
const RELEARN_MS = 10 * 60_000; // a failed card comes back after 10 minutes
const MIN_S = 0.001;
export const MATURE_DAYS = 21; // a card counts as "mastered" from this stability on

export function newCard(id) {
  return { id, state: "new", stability: 0, difficulty: 0, reps: 0, lapses: 0, lastReview: null, due: 0 };
}

export function createScheduler({ w = DEFAULT_W, desiredRetention = 0.9, maxInterval = 365 } = {}) {
  const DECAY = -w[20];
  const FACTOR = 0.9 ** (1 / DECAY) - 1;

  const clampD = (d) => Math.min(10, Math.max(1, d));
  const clampS = (s) => Math.max(MIN_S, s);

  const retrievability = (elapsedDays, s) => (1 + (FACTOR * elapsedDays) / s) ** DECAY;

  const initialDifficulty = (g) => w[4] - Math.exp(w[5] * (g - 1)) + 1;

  function nextDifficulty(d, g) {
    const delta = -w[6] * (g - 3);
    const damped = d + (delta * (10 - d)) / 9; // linear damping near D = 10
    return clampD(w[7] * initialDifficulty(GRADE.EASY) + (1 - w[7]) * damped); // mean reversion
  }

  function recallStability(d, s, r, g) {
    const hardPenalty = g === GRADE.HARD ? w[15] : 1;
    const easyBonus = g === GRADE.EASY ? w[16] : 1;
    return s * (1 + Math.exp(w[8]) * (11 - d) * s ** -w[9] * (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus);
  }

  function forgetStability(d, s, r) {
    const longTerm = w[11] * d ** -w[12] * ((s + 1) ** w[13] - 1) * Math.exp((1 - r) * w[14]);
    const shortTerm = s / Math.exp(w[17] * w[18]);
    return Math.min(longTerm, shortTerm);
  }

  function shortTermStability(s, g) {
    let increase = Math.exp(w[17] * (g - 3 + w[18])) * s ** -w[19];
    if (g >= GRADE.HARD) increase = Math.max(increase, 1);
    return s * increase;
  }

  function intervalDays(s) {
    const days = Math.round((s / FACTOR) * (desiredRetention ** (1 / DECAY) - 1));
    return Math.min(maxInterval, Math.max(1, days));
  }

  // Returns a new card object; the input card is left untouched.
  function review(card, grade, now = Date.now()) {
    if (![1, 2, 3, 4].includes(grade)) throw new Error(`grade must be 1..4, got ${grade}`);
    const c = { ...card };
    if (c.reps === 0 || c.lastReview == null) {
      c.stability = clampS(w[grade - 1]);
      c.difficulty = clampD(initialDifficulty(grade));
    } else {
      const elapsed = Math.floor((now - c.lastReview) / DAY_MS);
      if (elapsed < 1) {
        c.stability = clampS(shortTermStability(c.stability, grade));
      } else {
        const r = retrievability(elapsed, c.stability);
        c.stability = clampS(
          grade === GRADE.AGAIN ? forgetStability(c.difficulty, c.stability, r) : recallStability(c.difficulty, c.stability, r, grade),
        );
      }
      c.difficulty = nextDifficulty(c.difficulty, grade);
    }
    c.reps += 1;
    c.lastReview = now;
    if (grade === GRADE.AGAIN) {
      if (card.state !== "new") c.lapses += 1;
      c.state = "relearning";
      c.due = now + RELEARN_MS;
    } else {
      c.state = "review";
      c.due = now + intervalDays(c.stability) * DAY_MS;
    }
    return c;
  }

  // Interval each button would produce; used to label the grade buttons.
  function preview(card, now = Date.now()) {
    const out = {};
    for (const g of [1, 2, 3, 4]) out[g] = review(card, g, now).due - now;
    return out;
  }

  // Current recall probability, 0..1 (1 for a card never reviewed is meaningless, so 0).
  function recallProbability(card, now = Date.now()) {
    if (!card.lastReview) return 0;
    return retrievability(Math.max(0, (now - card.lastReview) / DAY_MS), card.stability);
  }

  return { review, preview, recallProbability, intervalDays, retrievability, DECAY, FACTOR };
}

export function isDue(card, now = Date.now()) {
  return card.state !== "new" && card.due <= now;
}

export function formatInterval(ms) {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min}m`;
  const days = Math.round(ms / DAY_MS);
  if (days < 31) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

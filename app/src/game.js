// Gamification: XP, levels, daily streak (with freezes), daily goal and badges.
// Rewards follow learning behaviour (retrieval, mastery, regular practice),
// never raw clicking: reviewing a card earns the same XP whatever grade you give,
// so honest "Again" grades cost nothing.

export const XP = {
  reviewCard: 5,
  correct: 10,
  warmup: 5,
  sessionComplete: 50,
  quizPass: 100,
  quizPerfect: 50,
  dailyGoal: 20,
};

export const TITLES = [
  "Curious Counter",
  "Data Rookie",
  "Mean Machine",
  "Variance Voyager",
  "Sigma Scout",
  "Interval Ranger",
  "P-value Pro",
  "Regression Wrangler",
  "Bayesian Sage",
  "Statistician",
];

export const BADGES = [
  { id: "first-steps", icon: "👣", name: "First steps", desc: "Complete your first session.", test: (g) => g.counters.sessionsDone >= 1 },
  { id: "perfect", icon: "🎯", name: "Bullseye", desc: "Score 100% on a session exam.", test: (g) => g.counters.perfectQuizzes >= 1 },
  { id: "streak-7", icon: "🔥", name: "One-week streak", desc: "Practise 7 days in a row.", test: (g) => g.streak.best >= 7 },
  { id: "streak-30", icon: "🌋", name: "Habit formed", desc: "Practise 30 days in a row.", test: (g) => g.streak.best >= 30 },
  { id: "reviews-100", icon: "🧠", name: "Memory builder", desc: "Do 100 flashcard reviews.", test: (g) => g.counters.reviews >= 100 },
  { id: "reviews-500", icon: "🏛️", name: "Memory palace", desc: "Do 500 flashcard reviews.", test: (g) => g.counters.reviews >= 500 },
  { id: "solver-50", icon: "🧮", name: "Problem solver", desc: "Solve 50 exercises correctly.", test: (g) => g.counters.correct >= 50 },
  { id: "interleaver", icon: "🔀", name: "Interleaver", desc: "Solve 20 problems in mixed practice.", test: (g) => g.counters.mixedSolved >= 20 },
  { id: "mastery", icon: "⭐", name: "Long-term memory", desc: "Reach 80% mastery in one session's cards.", test: (g, ctx) => (ctx.masteredSessions ?? 0) >= 1 },
  { id: "graduate", icon: "🎓", name: "Graduate", desc: "Pass every session exam.", test: (g, ctx) => ctx.totalSessions > 0 && g.counters.quizzesPassed >= ctx.totalSessions },
  { id: "comeback", icon: "🌱", name: "Comeback", desc: "Return after a break of 3+ days.", test: (g) => g.counters.comebacks >= 1 },
];

export function newGame() {
  return {
    xp: 0,
    xpByDay: {},
    streak: { current: 0, best: 0, lastDay: null, freezes: 0 },
    badges: {},
    counters: { reviews: 0, correct: 0, sessionsDone: 0, quizzesPassed: 0, perfectQuizzes: 0, mixedSolved: 0, comebacks: 0 },
  };
}

// Level L starts at 50 * L * (L - 1) XP: 0, 100, 300, 600, 1000, ...
export const xpForLevel = (level) => 50 * level * (level - 1);
export const levelFor = (xp) => Math.floor((1 + Math.sqrt(1 + (8 * xp) / 100)) / 2);
export const titleFor = (level) => TITLES[Math.min(level, TITLES.length) - 1];

export function levelProgress(xp) {
  const level = levelFor(xp);
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  return { level, title: titleFor(level), into: xp - start, needed: end - start, fraction: (xp - start) / (end - start) };
}

export function localDay(date = new Date()) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayDiff(fromDay, toDay) {
  const [y1, m1, d1] = fromDay.split("-").map(Number);
  const [y2, m2, d2] = toDay.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

// Register activity today. Returns events such as {type:"streak", value}.
export function touchStreak(game, today = localDay()) {
  const s = game.streak;
  const events = [];
  if (s.lastDay === today) return events;
  const gap = s.lastDay ? dayDiff(s.lastDay, today) : null;
  if (gap === null || gap < 0) {
    s.current = 1;
  } else if (gap === 1) {
    s.current += 1;
  } else {
    const missed = gap - 1;
    if (s.freezes >= missed) {
      s.freezes -= missed;
      s.current += 1;
      events.push({ type: "freeze-used", value: missed });
    } else {
      if (s.current > 0) events.push({ type: "streak-reset", value: s.current });
      s.current = 1;
    }
    if (gap >= 4) game.counters.comebacks += 1;
  }
  s.lastDay = today;
  s.best = Math.max(s.best, s.current);
  if (s.current % 7 === 0 && s.freezes < 2) {
    s.freezes += 1;
    events.push({ type: "freeze-earned", value: s.freezes });
  }
  events.push({ type: "streak", value: s.current });
  return events;
}

// Add XP, update streak and daily goal. Returns events for the UI.
export function awardXp(game, amount, { today = localDay(), dailyGoal = 50 } = {}) {
  const events = touchStreak(game, today);
  const before = levelFor(game.xp);
  const dayBefore = game.xpByDay[today] ?? 0;
  game.xp += amount;
  game.xpByDay[today] = dayBefore + amount;
  if (dayBefore < dailyGoal && dayBefore + amount >= dailyGoal) {
    game.xp += XP.dailyGoal;
    game.xpByDay[today] += XP.dailyGoal;
    events.push({ type: "daily-goal", value: XP.dailyGoal });
  }
  const after = levelFor(game.xp);
  if (after > before) events.push({ type: "level-up", value: after, title: titleFor(after) });
  events.unshift({ type: "xp", value: amount });
  return events;
}

// Award every badge whose test now passes. Returns the newly earned badges.
export function checkBadges(game, ctx = {}, now = new Date()) {
  const earned = [];
  for (const b of BADGES) {
    if (!game.badges[b.id] && b.test(game, ctx)) {
      game.badges[b.id] = now.toISOString();
      earned.push(b);
    }
  }
  return earned;
}

import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, awardXp, touchStreak, levelFor, xpForLevel, levelProgress, checkBadges, dayDiff, XP } from "../app/src/game.js";

test("level thresholds", () => {
  assert.equal(levelFor(0), 1);
  assert.equal(levelFor(99), 1);
  assert.equal(levelFor(100), 2);
  assert.equal(levelFor(299), 2);
  assert.equal(levelFor(300), 3);
  for (let l = 1; l < 15; l++) assert.equal(levelFor(xpForLevel(l)), l);
  const p = levelProgress(150);
  assert.equal(p.level, 2);
  assert.equal(p.into, 50);
  assert.equal(p.needed, 200);
});

test("dayDiff across months and DST-free", () => {
  assert.equal(dayDiff("2026-03-31", "2026-04-01"), 1);
  assert.equal(dayDiff("2026-12-31", "2027-01-02"), 2);
});

test("streak grows on consecutive days and resets after a gap", () => {
  const g = newGame();
  touchStreak(g, "2026-10-01");
  touchStreak(g, "2026-10-01");
  assert.equal(g.streak.current, 1);
  touchStreak(g, "2026-10-02");
  assert.equal(g.streak.current, 2);
  const ev = touchStreak(g, "2026-10-05");
  assert.equal(g.streak.current, 1);
  assert.ok(ev.some((e) => e.type === "streak-reset"));
  assert.equal(g.streak.best, 2);
});

test("a 7-day streak earns a freeze that covers one missed day", () => {
  const g = newGame();
  for (let d = 1; d <= 7; d++) touchStreak(g, `2026-10-0${d}`);
  assert.equal(g.streak.freezes, 1);
  const ev = touchStreak(g, "2026-10-09"); // missed the 8th
  assert.ok(ev.some((e) => e.type === "freeze-used"));
  assert.equal(g.streak.current, 8);
  assert.equal(g.streak.freezes, 0);
});

test("comeback counted after a break of 3+ days", () => {
  const g = newGame();
  touchStreak(g, "2026-10-01");
  touchStreak(g, "2026-10-06");
  assert.equal(g.counters.comebacks, 1);
});

test("awardXp adds daily-goal bonus once and reports level-ups", () => {
  const g = newGame();
  const ev1 = awardXp(g, 40, { today: "2026-10-01", dailyGoal: 50 });
  assert.ok(!ev1.some((e) => e.type === "daily-goal"));
  const ev2 = awardXp(g, 20, { today: "2026-10-01", dailyGoal: 50 });
  assert.ok(ev2.some((e) => e.type === "daily-goal"));
  assert.equal(g.xp, 60 + XP.dailyGoal);
  const ev3 = awardXp(g, 20, { today: "2026-10-01", dailyGoal: 50 });
  assert.ok(!ev3.some((e) => e.type === "daily-goal"));
  assert.ok(ev2.concat(ev3).some((e) => e.type === "level-up"));
});

test("badges are awarded once", () => {
  const g = newGame();
  g.counters.sessionsDone = 1;
  const first = checkBadges(g, { totalSessions: 7 });
  assert.deepEqual(first.map((b) => b.id), ["first-steps"]);
  assert.equal(checkBadges(g, { totalSessions: 7 }).length, 0);
  g.counters.quizzesPassed = 7;
  assert.ok(checkBadges(g, { totalSessions: 7 }).some((b) => b.id === "graduate"));
});

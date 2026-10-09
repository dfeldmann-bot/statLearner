import { test } from "node:test";
import assert from "node:assert/strict";
import { createScheduler, newCard, DEFAULT_W, GRADE, formatInterval, isDue } from "../app/src/fsrs.js";

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 0, 1, 12);

test("recall probability is 90% after exactly S days", () => {
  const s = createScheduler();
  for (const S of [1, 3.7, 20, 100]) assert.ok(Math.abs(s.retrievability(S, S) - 0.9) < 1e-9);
});

test("interval equals stability at 90% desired retention", () => {
  const s = createScheduler();
  assert.equal(s.intervalDays(10), 10);
  assert.equal(s.intervalDays(0.2), 1, "never shorter than a day");
  assert.equal(s.intervalDays(10_000), 365, "capped at maxInterval");
});

test("higher desired retention gives shorter intervals", () => {
  const strict = createScheduler({ desiredRetention: 0.95 });
  const loose = createScheduler({ desiredRetention: 0.8 });
  assert.ok(strict.intervalDays(30) < 30);
  assert.ok(loose.intervalDays(30) > 30);
});

test("first review sets initial stability from w0..w3", () => {
  const s = createScheduler();
  for (const g of [1, 2, 3, 4]) {
    const c = s.review(newCard("x"), g, t0);
    assert.equal(c.stability, DEFAULT_W[g - 1]);
    assert.ok(c.difficulty >= 1 && c.difficulty <= 10);
    assert.equal(c.reps, 1);
  }
  const easy = s.review(newCard("x"), GRADE.EASY, t0);
  const again = s.review(newCard("x"), GRADE.AGAIN, t0);
  assert.ok(easy.difficulty < again.difficulty, "easier first answer means lower difficulty");
});

test("Again schedules a 10-minute relearn; others at least a day", () => {
  const s = createScheduler();
  const again = s.review(newCard("x"), GRADE.AGAIN, t0);
  assert.equal(again.due - t0, 10 * 60_000);
  assert.equal(again.state, "relearning");
  const good = s.review(newCard("x"), GRADE.GOOD, t0);
  assert.ok(good.due - t0 >= DAY);
});

test("repeated Good reviews on time grow the interval", () => {
  const s = createScheduler();
  let c = s.review(newCard("x"), GRADE.GOOD, t0);
  let prev = 0;
  // Expected with default weights: 2d, 11d, 46d, 163d, then the 365d cap.
  for (let i = 0; i < 4; i++) {
    const interval = c.due - c.lastReview;
    assert.ok(interval > prev, `interval ${i} should grow`);
    prev = interval;
    c = s.review(c, GRADE.GOOD, c.due);
  }
  assert.ok(c.stability > 30);
  assert.equal(c.due - c.lastReview, 365 * DAY);
});

test("a lapse lowers stability and counts a lapse", () => {
  const s = createScheduler();
  let c = s.review(newCard("x"), GRADE.GOOD, t0);
  c = s.review(c, GRADE.GOOD, c.due);
  const before = c.stability;
  const failed = s.review(c, GRADE.AGAIN, c.due);
  assert.ok(failed.stability < before);
  assert.equal(failed.lapses, 1);
});

test("same-day review uses short-term stability and keeps Good >= current", () => {
  const s = createScheduler();
  const c = s.review(newCard("x"), GRADE.AGAIN, t0);
  const again = s.review(c, GRADE.GOOD, t0 + 10 * 60_000);
  assert.ok(again.stability >= c.stability);
});

test("difficulty stays inside [1, 10]", () => {
  const s = createScheduler();
  let c = s.review(newCard("x"), GRADE.AGAIN, t0);
  for (let i = 0; i < 30; i++) c = s.review(c, GRADE.AGAIN, c.due + DAY);
  assert.ok(c.difficulty <= 10 && c.difficulty >= 1);
  let e = s.review(newCard("y"), GRADE.EASY, t0);
  for (let i = 0; i < 30; i++) e = s.review(e, GRADE.EASY, e.due);
  assert.ok(e.difficulty >= 1);
});

test("review does not mutate its input and rejects bad grades", () => {
  const s = createScheduler();
  const c = newCard("x");
  s.review(c, GRADE.GOOD, t0);
  assert.equal(c.reps, 0);
  assert.throws(() => s.review(c, 5, t0));
});

test("preview labels and helpers", () => {
  const s = createScheduler();
  const p = s.preview(newCard("x"), t0);
  assert.ok(p[1] < p[2] && p[2] <= p[3] && p[3] < p[4]);
  assert.equal(formatInterval(10 * 60_000), "10m");
  assert.equal(formatInterval(3 * DAY), "3d");
  assert.equal(isDue(newCard("x"), t0), false);
});

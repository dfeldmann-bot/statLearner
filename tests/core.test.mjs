import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNumber, checkNumeric, checkChoice } from "../app/src/check.js";
import { renderMarkdown, escapeHtml } from "../app/src/markdown.js";
import { buildDailyReminderIcs, shouldNotify } from "../app/src/reminders.js";
import { mean, median, variance, sd, normalCdf, binomPmf, choose, correlation, linearFit } from "../app/src/stats.js";
import { makeRng } from "../app/src/rng.js";
import { buildQueue, introduceCards, mastery, forecast } from "../app/src/srs.js";

test("parseNumber handles decimals, commas, percents and fractions", () => {
  assert.equal(parseNumber("0.25"), 0.25);
  assert.equal(parseNumber(".25"), 0.25);
  assert.equal(parseNumber("0,25"), 0.25);
  assert.equal(parseNumber("25%"), 0.25);
  assert.equal(parseNumber("1/4"), 0.25);
  assert.equal(parseNumber(" -3 "), -3);
  assert.equal(parseNumber("−1.5"), -1.5);
  assert.ok(Number.isNaN(parseNumber("abc")));
  assert.ok(Number.isNaN(parseNumber("")));
});

test("checkNumeric tolerance and percent rescue", () => {
  assert.ok(checkNumeric("3.14", Math.PI, 0.01).ok);
  assert.ok(!checkNumeric("3.2", Math.PI, 0.01).ok);
  const r = checkNumeric("25", 0.25);
  assert.ok(r.ok && r.note);
  assert.ok(!checkNumeric("hello", 1).ok);
  assert.ok(checkChoice("2", 2).ok);
});

test("markdown escapes HTML and renders basics", () => {
  const html = renderMarkdown("Hello <script>alert(1)</script> **bold** and *it*\n\n- a\n- b\n\n### Head");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("<strong>bold</strong>"));
  assert.ok(html.includes("<em>it</em>"));
  assert.ok(html.includes("<ul><li>a</li><li>b</li></ul>"));
  assert.ok(html.includes("<h4>Head</h4>"));
  assert.equal(escapeHtml(`"'`), "&quot;&#39;");
});

test("markdown passes raw TeX to the math renderer and protects it from formatting", () => {
  const seen = [];
  const html = renderMarkdown("Mean $\\bar x = \\frac{1}{n}\\sum x_i$ and $$s^2 = \\frac{\\sum (x_i-\\bar x)^2}{n-1}$$ cost \\$5", {
    renderMath: (tex, display) => (seen.push([tex, display]), `[${display ? "D" : "I"}]`),
  });
  assert.deepEqual(seen[0], ["s^2 = \\frac{\\sum (x_i-\\bar x)^2}{n-1}", true]);
  assert.deepEqual(seen[1], ["\\bar x = \\frac{1}{n}\\sum x_i", false]);
  assert.ok(html.includes("[I]") && html.includes("[D]") && html.includes("cost $5"));
});

test("markdown tables, links, callouts", () => {
  const html = renderMarkdown("| A | B |\n|---|---|\n| 1 | 2 |\n\n> note\n\n[OpenIntro](https://www.openintro.org) [bad](javascript:alert(1))");
  assert.ok(html.includes("<table>") && html.includes("<td>2</td>"));
  assert.ok(html.includes("<blockquote>"));
  assert.ok(html.includes('href="https://www.openintro.org"'));
  assert.ok(!html.includes('href="javascript'));
});

test("ICS reminder is a valid daily recurring event", () => {
  const ics = buildDailyReminderIcs({ time: "07:30", minutes: 10, startDate: new Date(2026, 9, 10), now: new Date(Date.UTC(2026, 9, 9, 8)) });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.includes("DTSTART:20261010T073000"));
  assert.ok(ics.includes("RRULE:FREQ=DAILY"));
  assert.ok(ics.includes("BEGIN:VALARM"));
  assert.ok(ics.includes("DTSTAMP:20261009T080000Z"));
  for (const line of ics.split("\r\n")) assert.ok(line.length <= 75, `line too long: ${line}`);
  assert.throws(() => buildDailyReminderIcs({ time: "25:00" }));
});

test("shouldNotify only after the reminder time, once a day, with due cards", () => {
  const base = { time: "19:00", lastNotifiedDay: null, today: "2026-10-09", dueCount: 3 };
  assert.equal(shouldNotify({ ...base, nowMinutes: 18 * 60 }), false);
  assert.equal(shouldNotify({ ...base, nowMinutes: 19 * 60 + 1 }), true);
  assert.equal(shouldNotify({ ...base, nowMinutes: 20 * 60, lastNotifiedDay: "2026-10-09" }), false);
  assert.equal(shouldNotify({ ...base, nowMinutes: 20 * 60, dueCount: 0 }), false);
});

test("descriptive statistics", () => {
  const xs = [2, 4, 4, 4, 5, 5, 7, 9];
  assert.equal(mean(xs), 5);
  assert.equal(median(xs), 4.5);
  assert.ok(Math.abs(variance(xs) - 32 / 7) < 1e-12);
  assert.ok(Math.abs(sd([1, 2, 3, 4]) - Math.sqrt(5 / 3)) < 1e-12);
  assert.equal(median([3, 1, 2]), 2);
});

test("normal CDF and binomial", () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-4);
  assert.ok(Math.abs(normalCdf(-1) - 0.1587) < 1e-4);
  assert.equal(choose(5, 2), 10);
  assert.equal(choose(10, 0), 1);
  assert.ok(Math.abs(binomPmf(3, 10, 0.5) - 120 / 1024) < 1e-12);
});

test("correlation and least squares", () => {
  const xs = [1, 2, 3, 4, 5];
  const ys = xs.map((x) => 3 + 2 * x);
  assert.ok(Math.abs(correlation(xs, ys) - 1) < 1e-12);
  const { b0, b1 } = linearFit(xs, ys);
  assert.ok(Math.abs(b0 - 3) < 1e-9 && Math.abs(b1 - 2) < 1e-9);
});

test("seeded RNG is reproducible", () => {
  const a = makeRng(42);
  const b = makeRng(42);
  for (let i = 0; i < 5; i++) assert.equal(a.next(), b.next());
  assert.notEqual(makeRng("x").next(), makeRng("y").next());
  const r = makeRng(1);
  for (let i = 0; i < 100; i++) {
    const v = r.int(3, 5);
    assert.ok(v >= 3 && v <= 5 && Number.isInteger(v));
  }
});

test("review queue interleaves sessions and respects due dates", () => {
  const now = Date.UTC(2026, 9, 9, 12);
  const sessions = [
    { id: "s01", cards: [{ id: "s01-c1" }, { id: "s01-c2" }, { id: "s01-c3" }] },
    { id: "s02", cards: [{ id: "s02-c1" }, { id: "s02-c2" }] },
  ];
  const states = {};
  introduceCards(states, sessions[0], now);
  introduceCards(states, sessions[1], now);
  assert.equal(introduceCards(states, sessions[1], now), 0, "idempotent");
  const all = sessions.flatMap((s) => s.cards.map((c) => ({ ...c, sessionId: s.id })));
  const q = buildQueue(all, states, { now, seed: 7 });
  assert.equal(q.length, 5);
  for (let i = 1; i < 4; i++) assert.notEqual(q[i].sessionId, q[i - 1].sessionId, "round-robin mixing");
  states["s01-c1"] = { ...states["s01-c1"], state: "review", due: now + 86_400_000 * 2, stability: 30 };
  assert.equal(buildQueue(all, states, { now }).length, 4);
  assert.ok(Math.abs(mastery(sessions[0], states) - 1 / 3) < 1e-12);
  const f = forecast(all, states, { now, days: 7 });
  assert.equal(f[2], 1);
});

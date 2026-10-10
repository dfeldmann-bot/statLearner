// Review queue: which flashcards are due, in which order.
// Cards enter spaced repetition when their session is completed. The queue
// interleaves sessions (round-robin) because mixing topics forces you to
// choose the right method, which improves transfer (interleaving effect).

import { newCard, isDue, MATURE_DAYS } from "./fsrs.js";
import { makeRng } from "./rng.js";

export function cardsOf(sessions) {
  const out = [];
  for (const s of sessions) for (const c of s.cards) out.push({ ...c, sessionId: s.id });
  return out;
}

// Create FSRS state for every card of a session that has none yet.
export function introduceCards(states, session, now = Date.now()) {
  let added = 0;
  for (const c of session.cards) {
    if (!states[c.id]) {
      states[c.id] = { ...newCard(c.id), due: now };
      added++;
    }
  }
  return added;
}

const ready = (st, now) => st && (st.state === "new" || isDue(st, now));

export function dueCards(allCards, states, now = Date.now()) {
  return allCards.filter((c) => ready(states[c.id], now));
}

export function buildQueue(allCards, states, { now = Date.now(), limit = 40, seed = now } = {}) {
  const due = dueCards(allCards, states, now).sort((a, b) => states[a.id].due - states[b.id].due).slice(0, limit);
  const rng = makeRng(seed);
  const groups = new Map();
  for (const c of rng.shuffle(due)) {
    if (!groups.has(c.sessionId)) groups.set(c.sessionId, []);
    groups.get(c.sessionId).push(c);
  }
  const queue = [];
  const lists = [...groups.values()];
  while (lists.some((l) => l.length)) for (const l of lists) if (l.length) queue.push(l.shift());
  return queue;
}

// Share of a session's cards whose memory is stable for at least MATURE_DAYS.
export function mastery(session, states) {
  if (!session.cards.length) return 0;
  const mature = session.cards.filter((c) => (states[c.id]?.stability ?? 0) >= MATURE_DAYS).length;
  return mature / session.cards.length;
}

// Count of due cards per day for the next `days` days (review forecast).
export function forecast(allCards, states, { now = Date.now(), days = 7 } = {}) {
  const counts = new Array(days).fill(0);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  for (const c of allCards) {
    const st = states[c.id];
    if (!st || st.state === "new") continue;
    const d = Math.floor((st.due - start.getTime()) / 86_400_000);
    if (d < days) counts[Math.max(0, d)] += 1; // overdue cards count for today
  }
  return counts;
}

// Progress persistence in localStorage, plus export/import so learners can
// move progress between devices. Everything stays on the learner's device.

import { newGame } from "./game.js";

const KEY = "statlearner:v1";

export function defaultState(now = new Date()) {
  return {
    version: 1,
    createdAt: now.toISOString(),
    onboarded: false,
    settings: {
      dailyGoal: 50,
      reminderTime: "19:00",
      reminderMinutes: 15,
      notifications: false,
      desiredRetention: 0.9,
    },
    game: newGame(),
    cards: {}, // FSRS state per card id
    // Per session: { startedAt, completedAt, quizBest, quizPassedAt, perfectAt } (quiz* fields hold
    // exam results), plus resume: { block, at } for a lesson left half-way and
    // exam: { questions, answers, at } for an exam left half-way.
    sessions: {},
    log: [], // review log [{ t, id, g }] kept for future FSRS parameter fitting
    lastNotifiedDay: null,
  };
}

// Fill in fields added in later versions so old saves keep working.
function upgrade(saved) {
  const base = defaultState();
  return {
    ...base,
    ...saved,
    settings: { ...base.settings, ...saved.settings },
    game: { ...base.game, ...saved.game, counters: { ...base.game.counters, ...saved.game?.counters }, streak: { ...base.game.streak, ...saved.game?.streak } },
  };
}

let memory = null; // fallback when storage is blocked (private mode, previews)

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return upgrade(JSON.parse(raw));
  } catch {
    if (memory) return memory;
  }
  return memory ?? defaultState();
}

export function save(state) {
  if (state.log.length > 5000) state.log = state.log.slice(-5000);
  memory = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exportJson(state) {
  return JSON.stringify({ app: "statlearner", exportedAt: new Date().toISOString(), state }, null, 2);
}

export function importJson(text) {
  const data = JSON.parse(text);
  const state = data?.state ?? data;
  if (!state || typeof state !== "object" || !state.game || !state.cards || !state.settings) throw new Error("This file does not look like a statLearner export.");
  return upgrade(state);
}

export function reset() {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  return defaultState();
}

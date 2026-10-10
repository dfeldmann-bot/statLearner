// statLearner app: routing and views. Runs fully offline; no LLM at runtime.

import { h, md, mdInline, toast, download } from "./dom.js";
import { questionView } from "./question.js";
import { createScheduler, formatInterval, GRADE } from "./fsrs.js";
import { awardXp, checkBadges, levelProgress, localDay, BADGES, XP } from "./game.js";
import { cardsOf, introduceCards, buildQueue, dueCards, mastery, forecast } from "./srs.js";
import { generate, EXERCISES } from "./exercises.js";
import { SIMS } from "./sims.js";
import { makeRng } from "./rng.js";
import { load, save, exportJson, importJson, reset } from "./store.js";
import { buildDailyReminderIcs, shouldNotify, requestNotificationPermission, notify } from "./reminders.js";

const app = { course: null, sessions: [], byId: {}, state: null, rng: makeRng(Date.now()) };
const main = () => document.getElementById("main");
const scheduler = () => createScheduler({ desiredRetention: app.state.settings.desiredRetention });
const persist = () => save(app.state);

// ---------- content ----------
async function loadContent() {
  const course = await (await fetch("content/course.json")).json();
  const sessions = await Promise.all(course.sessions.map(async (f) => (await fetch(`content/sessions/${f}.json`)).json()));
  app.course = course;
  app.sessions = sessions;
  app.byId = Object.fromEntries(sessions.map((s) => [s.id, s]));
}

const progressOf = (id) => (app.state.sessions[id] ??= {});
// Each part opens with its first session; inside a part, pass a quiz to unlock the next session.
function isUnlocked(i) {
  if (app.state.settings.unlockAll || i === 0) return true;
  const prev = app.sessions[i - 1];
  if (app.sessions[i].part !== prev.part) return true;
  return !!app.state.sessions[prev.id]?.quizPassedAt;
}
const allCards = () => cardsOf(app.sessions);
const dueCount = () => dueCards(allCards(), app.state.cards).length;

// ---------- rewards ----------
function award(amount) {
  const events = awardXp(app.state.game, amount, { dailyGoal: app.state.settings.dailyGoal });
  const quiet = events.length === 1 || (events.length === 2 && events[1].type === "streak" && events[1].value <= 1);
  for (const e of events) {
    if (e.type === "xp" && quiet) toast(`+${e.value} XP`, "xp", 1200);
    if (e.type === "level-up") toast(`⬆️ Level ${e.value}: ${e.title}!`, "big", 4000);
    if (e.type === "daily-goal") toast(`🎯 Daily goal reached! +${e.value} XP bonus`, "big", 3500);
    if (e.type === "streak" && e.value > 1) toast(`🔥 ${e.value}-day streak`, "streak", 2500);
    if (e.type === "freeze-earned") toast("🧊 Streak freeze earned: it covers one missed day", "streak", 3500);
    if (e.type === "freeze-used") toast(`🧊 A streak freeze saved your streak`, "streak", 3500);
    if (e.type === "streak-reset") toast("Welcome back! A new streak starts today.", "info", 3500);
  }
  checkAllBadges();
  persist();
  renderHeader();
}

function checkAllBadges() {
  const masteredSessions = app.sessions.filter((s) => mastery(s, app.state.cards) >= 0.8).length;
  for (const b of checkBadges(app.state.game, { totalSessions: app.sessions.length, masteredSessions })) toast(`${b.icon} Badge unlocked: ${b.name}`, "badge", 4500);
}

// ---------- header ----------
function renderHeader() {
  const g = app.state.game;
  const lp = levelProgress(g.xp);
  const today = g.xpByDay[localDay()] ?? 0;
  const goal = app.state.settings.dailyGoal;
  const due = dueCount();
  const nav = [
    ["#/", "Learn"],
    ["#/review", `Review${due ? ` (${due})` : ""}`],
    ["#/practice", "Practice"],
    ["#/progress", "Progress"],
    ["#/book", "Book"],
    ["#/settings", "Settings"],
  ];
  const route = location.hash || "#/";
  document.getElementById("header").replaceChildren(
    h("a", { class: "brand", href: "#/" }, h("img", { src: "icon.svg", alt: "", width: 28, height: 28 }), h("span", {}, "statLearner")),
    h("nav", { class: "nav" }, nav.map(([href, label]) => h("a", { href, class: route === href || (href !== "#/" && route.startsWith(href)) ? "active" : "" }, label))),
    h(
      "div",
      { class: "chips" },
      h("span", { class: "chip", title: `${lp.into} / ${lp.needed} XP to level ${lp.level + 1}` }, `Lv ${lp.level}`, h("span", { class: "mini-bar" }, h("span", { style: `width:${Math.round(lp.fraction * 100)}%` }))),
      h("span", { class: "chip", title: `Streak; best ${g.streak.best} days${g.streak.freezes ? `; ${g.streak.freezes} freeze(s)` : ""}` }, `🔥 ${g.streak.lastDay === localDay() || g.streak.lastDay === localDay(Date.now() - 864e5) ? g.streak.current : 0}`),
      h("span", { class: "chip", title: "Today's XP / daily goal" }, `🎯 ${Math.min(today, goal)}/${goal}`),
    ),
  );
}

// ---------- views ----------
function viewHome() {
  const root = h("div", { class: "stack" });
  if (!app.state.onboarded) root.append(onboardingCard());
  const due = dueCount();
  const next = app.sessions.find((s, i) => isUnlocked(i) && !app.state.sessions[s.id]?.quizPassedAt);
  const lp = levelProgress(app.state.game.xp);
  root.append(
    h(
      "section",
      { class: "card hero" },
      h("div", {}, h("div", { class: "eyebrow" }, `Level ${lp.level} · ${lp.title}`), h("h1", {}, app.course.title), h("p", { class: "muted" }, app.course.subtitle)),
      h(
        "div",
        { class: "hero-actions" },
        due ? h("a", { class: "btn primary", href: "#/review" }, `Review ${due} due card${due === 1 ? "" : "s"}`) : h("span", { class: "pill ok" }, "No reviews due ✓"),
        next ? h("a", { class: `btn ${due ? "" : "primary"}`, href: `#/s/${next.id}` }, app.state.sessions[next.id]?.completedAt ? `Quiz: ${next.title}` : `Continue: ${next.title}`) : h("a", { class: "btn", href: "#/practice" }, "Mixed practice"),
      ),
    ),
  );
  const list = h("section", { class: "sessions" });
  const parts = Object.fromEntries((app.course.parts ?? []).map((p) => [p.id, p]));
  app.sessions.forEach((s, i) => {
    if (parts[s.part] && s.part !== app.sessions[i - 1]?.part) {
      list.append(h("div", { class: "part-head" }, h("h2", {}, parts[s.part].title), h("p", { class: "muted small" }, parts[s.part].description)));
    }
    const p = app.state.sessions[s.id] ?? {};
    const unlocked = isUnlocked(i);
    const m = mastery(s, app.state.cards);
    const status = p.quizPassedAt ? "passed" : p.completedAt ? "quiz" : unlocked ? "open" : "locked";
    const badge = { passed: "✓ Passed", quiz: "Quiz ready", open: "Start", locked: "🔒 Locked" }[status];
    list.append(
      h(
        unlocked ? "a" : "div",
        { class: `session-card ${status}`, href: unlocked ? `#/s/${s.id}` : null, "aria-disabled": unlocked ? null : "true" },
        h("div", { class: "session-num" }, String(i + 1)),
        h(
          "div",
          { class: "session-body" },
          h("div", { class: "session-title" }, s.title),
          h("div", { class: "muted small" }, s.summary),
          h("div", { class: "session-meta" }, h("span", {}, `${s.minutes} min`), p.quizBest != null ? h("span", {}, `Quiz best ${Math.round(p.quizBest * 100)}%`) : null, p.completedAt ? h("span", { title: "Share of this session's cards remembered for 21+ days" }, `Mastery ${Math.round(m * 100)}%`) : null),
          p.completedAt ? h("div", { class: "bar" }, h("span", { style: `width:${Math.round(m * 100)}%` })) : null,
        ),
        h("div", { class: "session-status" }, badge),
      ),
    );
  });
  root.append(list);
  root.append(h("p", { class: "muted small center" }, "Based on ", h("a", { href: app.course.book.url, target: "_blank", rel: "noopener" }, app.course.book.title), ` by ${app.course.book.authors} · `, h("a", { href: "#/book" }, "book, lectures and other resources")));
  return root;
}

function onboardingCard() {
  const goal = h("select", {}, [20, 50, 100, 150].map((v) => h("option", { value: v, selected: v === app.state.settings.dailyGoal }, `${v} XP/day (${{ 20: "~5", 50: "~10", 100: "~20", 150: "~30" }[v]} min)`)));
  const time = h("input", { type: "time", value: app.state.settings.reminderTime });
  return h(
    "section",
    { class: "card welcome" },
    h("h2", {}, "Welcome! Here is how this course works"),
    h(
      "ul",
      { class: "how" },
      h("li", {}, h("strong", {}, "Predict, then learn. "), "Each session starts with a question before the explanation; guessing first makes the explanation stick."),
      h("li", {}, h("strong", {}, "Examples that fade. "), "You first study a worked example, then finish a half-solved one, then solve alone."),
      h("li", {}, h("strong", {}, "Retrieval, spaced out. "), "Key concepts and formulas become flashcards scheduled with FSRS, a modern memory model, right before you would forget them."),
      h("li", {}, h("strong", {}, "Little and often. "), "10-15 minutes a day beats an hour a week. Streaks and a daily goal help you keep the habit."),
    ),
    h("div", { class: "form-row" }, h("label", {}, "Daily goal ", goal), h("label", {}, "Reminder time ", time)),
    h(
      "div",
      { class: "actions" },
      h(
        "button",
        {
          class: "btn primary",
          onclick: () => {
            app.state.settings.dailyGoal = Number(goal.value);
            app.state.settings.reminderTime = time.value || "19:00";
            app.state.onboarded = true;
            persist();
            route();
          },
        },
        "Let's start",
      ),
      h(
        "button",
        {
          class: "btn",
          onclick: () => download("statlearner-reminder.ics", buildDailyReminderIcs({ time: time.value || "19:00", minutes: app.state.settings.reminderMinutes, url: location.href.split("#")[0] }), "text/calendar"),
        },
        "📅 Add daily reminder to my calendar",
      ),
    ),
  );
}

// ----- session (lesson) -----
function viewSession(id) {
  const s = app.byId[id];
  const idx = app.sessions.indexOf(s);
  if (!s) return h("p", {}, "Session not found.");
  if (!isUnlocked(idx)) return h("section", { class: "card" }, h("h2", {}, "🔒 Locked"), h("p", {}, "Pass the previous session's mastery quiz to unlock this one (or unlock everything in Settings)."));
  const p = progressOf(id);
  p.startedAt ??= new Date().toISOString();
  persist();
  const root = h("div", { class: "stack lesson" });
  root.append(
    h(
      "section",
      { class: "card" },
      h("div", { class: "eyebrow" }, `Session ${idx + 1} · ${s.minutes} min`),
      h("h1", {}, s.title),
      h(
        "div",
        { class: "refs small" },
        s.bookRef ? h("div", {}, "📖 ", h("a", { href: app.course.book.url, target: "_blank", rel: "noopener" }, "Book"), `: ${s.bookRef}`) : null,
        s.companionRef ? h("div", {}, "📘 ", h("a", { href: app.course.companions?.[0]?.url, target: "_blank", rel: "noopener" }, "Companion"), `: ${s.companionRef}`) : null,
        (s.lectures ?? []).map((l) => h("div", {}, "🎥 ", h("a", { href: l.url, target: "_blank", rel: "noopener" }, `MacKay lecture ${l.number}`), `: ${l.title}`)),
      ),
      h("div", { class: "objectives" }, h("strong", {}, "You will be able to:"), h("ul", {}, s.objectives.map((o) => h("li", {}, mdInline(o))))),
      p.completedAt ? h("div", { class: "actions" }, h("a", { class: "btn", href: `#/quiz/${id}` }, "Skip to the mastery quiz")) : null,
    ),
  );
  const flow = h("div", { class: "stack" });
  root.append(flow);

  const steps = [];
  // Retrieval warm-up: one fresh problem from each of up to two earlier sessions.
  const earlier = app.sessions.slice(0, idx).filter((x) => app.state.sessions[x.id]?.completedAt);
  for (const e of app.rng.shuffle(earlier).slice(0, 2)) {
    const exIds = Object.keys(EXERCISES).filter((k) => EXERCISES[k].session === e.id);
    steps.push({ kind: "recall", exercise: app.rng.pick(exIds), from: e.title });
  }
  for (const q of s.warmup ?? []) steps.push({ kind: "warmup", question: q });
  for (const b of s.blocks) steps.push({ kind: "block", block: b });

  const bar = h("div", { class: "progress-line" }, h("span"));
  root.prepend(bar);
  let i = 0;
  const advance = () => {
    bar.firstChild.style.width = `${Math.round((i / steps.length) * 100)}%`;
    if (i >= steps.length) return flow.append(completion(s));
    const step = steps[i++];
    const node = renderStep(step, advance);
    flow.append(node);
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  advance();
  return root;
}

function renderStep(step, next) {
  const wrap = h("section", { class: "card step" });
  if (step.kind === "recall") {
    wrap.append(
      questionView(generate(step.exercise, app.rng), {
        label: `🔁 Quick recall from "${step.from}"`,
        onDone: (r) => {
          if (r.ok) award(r.hinted ? XP.correct / 2 : XP.correct);
          if (r.ok) app.state.game.counters.correct++;
          next();
        },
      }),
    );
    return wrap;
  }
  if (step.kind === "warmup") {
    wrap.append(
      questionView(step.question, {
        label: "🤔 Predict first: a wrong guess is fine",
        continueLabel: "Start the lesson",
        onDone: () => {
          award(XP.warmup);
          next();
        },
      }),
    );
    return wrap;
  }
  const b = step.block;
  const cont = (label = "Continue") => h("div", { class: "actions" }, h("button", { class: "btn primary", onclick: (e) => (e.target.closest(".actions").remove(), next()) }, label));
  switch (b.type) {
    case "text":
      wrap.append(md(b.md), cont());
      break;
    case "callout":
      wrap.classList.add("callout", b.kind);
      wrap.append(h("div", { class: "callout-label" }, { tip: "💡 Tip", warning: "⚠️ Watch out", misconception: "🚫 Common misconception" }[b.kind]), md(b.md), cont());
      break;
    case "sim": {
      const sim = SIMS[b.sim];
      wrap.classList.add("sim");
      wrap.append(h("h3", {}, `🧪 ${sim.title}`));
      if (b.md) wrap.append(md(b.md));
      const host = h("div", { class: "sim-host" });
      wrap.append(host, cont("I made my prediction and checked it"));
      requestAnimationFrame(() => sim.mount(host, app.rng));
      break;
    }
    case "example": {
      wrap.classList.add("example");
      wrap.append(h("h3", {}, `📝 Worked example: ${b.title}`));
      if (b.md) wrap.append(md(b.md));
      const list = h("ol", { class: "steps" });
      wrap.append(list);
      let k = 0;
      const btnRow = h("div", { class: "actions" });
      const reveal = () => {
        list.append(h("li", { class: "fade-in" }, mdInline(b.steps[k++])));
        if (k < b.steps.length) return;
        btnRow.replaceChildren();
        if (b.reflect) wrap.append(reflectBox(b.reflect.prompt, b.reflect.answer, next));
        else btnRow.append(h("button", { class: "btn primary", onclick: () => (btnRow.remove(), next()) }, "Continue"));
      };
      btnRow.append(h("button", { class: "btn", onclick: reveal }, "Next step ▸"));
      wrap.append(btnRow);
      reveal();
      break;
    }
    case "reflect":
      wrap.append(reflectBox(b.prompt, b.answer, next));
      break;
    case "check":
      wrap.append(
        questionView(b.question, {
          label: "✅ Check your understanding",
          onDone: (r) => {
            if (r.ok) {
              app.state.game.counters.correct++;
              award(XP.correct);
            }
            next();
          },
        }),
      );
      break;
    case "practice":
      wrap.append(practiceSet(b, next));
      break;
  }
  return wrap;
}

function reflectBox(prompt, answer, next) {
  const box = h("div", { class: "reflect" }, h("div", { class: "q-label" }, "✍️ Explain it in your own words"), md(prompt));
  const ta = h("textarea", { rows: 3, placeholder: "Type or just think your answer, then compare. (Not saved.)" });
  const actions = h("div", { class: "actions" });
  actions.append(
    h(
      "button",
      {
        class: "btn",
        onclick: () => {
          box.append(h("div", { class: "model-answer" }, h("strong", {}, "Model answer: "), mdInline(answer)));
          actions.replaceChildren(h("button", { class: "btn primary", onclick: () => (actions.remove(), next()) }, "Continue"));
        },
      },
      "Compare with model answer",
    ),
  );
  box.append(ta, actions);
  return box;
}

function practiceSet(block, next) {
  const ex = EXERCISES[block.exercise];
  const n = block.count;
  const modes = n >= 3 ? ["worked", "partial", ...Array(n - 2).fill("independent")] : n === 2 ? ["partial", "independent"] : ["independent"];
  const box = h("div", { class: "practice" }, h("h3", {}, `🏋️ Practice: ${ex.title}`));
  if (block.md) box.append(md(block.md));
  const holder = h("div");
  box.append(holder);
  let k = 0;
  const one = () => {
    if (k >= modes.length) return next();
    const mode = modes[k];
    const label = `${k + 1} / ${modes.length} · ${{ worked: "study the example", partial: "finish the solution", independent: "your turn" }[mode]}`;
    k++;
    holder.replaceChildren(
      questionView(generate(block.exercise, app.rng), {
        mode,
        label,
        continueLabel: k < modes.length ? "Next problem" : "Continue",
        onDone: (r) => {
          if (!r.worked && r.ok) {
            app.state.game.counters.correct++;
            award(mode === "partial" || r.hinted ? XP.correct / 2 : XP.correct);
          }
          one();
        },
      }),
    );
  };
  one();
  return box;
}

function completion(s) {
  const p = progressOf(s.id);
  const first = !p.completedAt;
  if (first) {
    p.completedAt = new Date().toISOString();
    app.state.game.counters.sessionsDone++;
    introduceCards(app.state.cards, s);
    award(XP.sessionComplete);
  }
  persist();
  return h(
    "section",
    { class: "card done" },
    h("h2", {}, "🎉 Session complete"),
    h("p", {}, first ? `${s.cards.length} flashcards from this session joined your review deck. They will come back just before you would forget them.` : "You revisited this session. Your flashcards keep their schedule."),
    h("div", { class: "actions" }, h("a", { class: "btn primary", href: `#/quiz/${s.id}` }, "Take the mastery quiz"), h("a", { class: "btn", href: "#/review" }, "Review cards")),
  );
}

// ----- quiz -----
function viewQuiz(id) {
  const s = app.byId[id];
  if (!s) return h("p", {}, "Quiz not found.");
  const pass = app.course.passMark ?? 0.8;
  const root = h("div", { class: "stack" });
  const head = h("section", { class: "card" }, h("div", { class: "eyebrow" }, "Mastery quiz"), h("h1", {}, s.title), h("p", { class: "muted" }, `${s.quiz.length} questions · pass mark ${Math.round(pass * 100)}% · numbers change on every attempt`));
  const stage = h("section", { class: "card" });
  const bar = h("div", { class: "progress-line" }, h("span"));
  root.append(bar, head, stage);
  const questions = app.rng.shuffle(s.quiz).map((q) => (q.type === "generated" ? generate(q.exercise, app.rng) : q));
  let i = 0;
  let correct = 0;
  const show = () => {
    bar.firstChild.style.width = `${Math.round((i / questions.length) * 100)}%`;
    if (i >= questions.length) return finish();
    const q = questions[i];
    stage.replaceChildren(
      questionView(q, {
        label: `Question ${i + 1} of ${questions.length}`,
        continueLabel: i + 1 < questions.length ? "Next question" : "See result",
        onDone: (r) => {
          if (r.ok) {
            correct++;
            app.state.game.counters.correct++;
            award(XP.correct);
          }
          i++;
          show();
        },
      }),
    );
  };
  const finish = () => {
    const score = correct / questions.length;
    const p = progressOf(id);
    p.quizBest = Math.max(p.quizBest ?? 0, score);
    const passed = score >= pass;
    if (passed && !p.quizPassedAt) {
      p.quizPassedAt = new Date().toISOString();
      app.state.game.counters.quizzesPassed++;
      if (!p.completedAt) {
        p.completedAt = p.quizPassedAt;
        app.state.game.counters.sessionsDone++;
        introduceCards(app.state.cards, s);
      }
      award(XP.quizPass);
    }
    if (score === 1 && !p.perfectAt) {
      p.perfectAt = new Date().toISOString();
      app.state.game.counters.perfectQuizzes++;
      award(XP.quizPerfect);
    }
    persist();
    const idx = app.sessions.indexOf(s);
    const nextS = app.sessions[idx + 1];
    stage.replaceChildren(
      h("div", { class: "center" }, h("div", { class: `score ${passed ? "ok" : "bad"}` }, `${Math.round(score * 100)}%`), h("h2", {}, passed ? (score === 1 ? "Perfect! 🎯" : "Passed ✓") : score >= 0.6 ? "Almost there" : "Not yet"), h("p", { class: "muted" }, passed ? "You have mastered this session's core skills. Your flashcards will keep them fresh." : `You need ${Math.round(pass * 100)}% to unlock the next session. Re-read the worked examples, then retry: you will get new numbers.`)),
      h("div", { class: "actions center" }, h("button", { class: "btn", onclick: () => route() }, "Retake with new numbers"), passed && nextS ? h("a", { class: "btn primary", href: `#/s/${nextS.id}` }, `Next: ${nextS.title}`) : null, h("a", { class: "btn", href: "#/" }, "Home")),
    );
    renderHeader();
  };
  show();
  return root;
}

// ----- spaced-repetition review -----
function viewReview() {
  const root = h("div", { class: "stack" });
  const queue = buildQueue(allCards(), app.state.cards, { seed: Date.now() });
  const total = queue.length;
  const requeued = {};
  const stage = h("section", { class: "card review" });
  const info = h("div", { class: "muted small" });
  root.append(h("section", { class: "card" }, h("div", { class: "eyebrow" }, "Spaced repetition"), h("h1", {}, "Review"), info), stage);
  if (!total) {
    const introduced = Object.keys(app.state.cards).length;
    stage.append(
      h("h2", {}, introduced ? "All caught up ✓" : "No cards yet"),
      h("p", {}, introduced ? `Next card due ${nextDueText()}. Come back then, or keep practising.` : "Complete a session and its flashcards will appear here."),
      h("div", { class: "actions" }, h("a", { class: "btn primary", href: "#/practice" }, "Mixed practice"), h("a", { class: "btn", href: "#/" }, "Home")),
    );
    return root;
  }
  let done = 0;
  const grade = (card, g) => {
    const now = Date.now();
    const st = app.state.cards[card.id];
    app.state.cards[card.id] = scheduler().review(st, g, now);
    app.state.log.push({ t: now, id: card.id, g });
    app.state.game.counters.reviews++;
    award(XP.reviewCard);
    if (g === GRADE.AGAIN && (requeued[card.id] ?? 0) < 2) {
      requeued[card.id] = (requeued[card.id] ?? 0) + 1;
      queue.push(card);
    }
    done++;
    showNext();
  };
  const gradeButtons = (card, allowed = [1, 2, 3, 4], suggested = 3) => {
    const preview = scheduler().preview(app.state.cards[card.id]);
    const names = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };
    const row = h("div", { class: "grades" });
    for (const g of allowed) row.append(h("button", { class: `btn grade g${g} ${g === suggested ? "suggested" : ""}`, onclick: () => grade(card, g) }, h("span", {}, names[g]), h("small", {}, formatInterval(preview[g]))));
    return row;
  };
  const showNext = () => {
    info.textContent = `${Math.max(0, queue.length)} left · ${done} reviewed this round`;
    if (!queue.length) {
      stage.replaceChildren(h("h2", {}, "Round complete ✓"), h("p", {}, `You reviewed ${done} card${done === 1 ? "" : "s"}. Next card due ${nextDueText()}.`), h("div", { class: "actions" }, h("a", { class: "btn primary", href: "#/" }, "Home"), h("a", { class: "btn", href: "#/practice" }, "Mixed practice")));
      return;
    }
    const card = queue.shift();
    const session = app.byId[card.sessionId];
    const tag = h("div", { class: "q-label" }, `${card.kind === "formula" ? "∑ Formula" : card.kind === "exercise" ? "🧮 Apply it" : "💭 Concept"} · ${session.title}`);
    if (card.kind === "exercise") {
      const q = generate(card.exercise, app.rng);
      stage.replaceChildren(
        tag,
        questionView(q, {
          continueLabel: "Rate it",
          onDone: (r) => {
            if (!r.ok) return grade(card, GRADE.AGAIN);
            app.state.game.counters.correct++;
            stage.replaceChildren(tag, h("p", {}, "✓ Correct. How hard was it?"), gradeButtons(card, [2, 3, 4], r.hinted ? 2 : 3));
          },
        }),
      );
      return;
    }
    const front = md(card.front, "prose card-front");
    const reveal = h("button", { class: "btn primary", onclick: () => showBack() }, "Show answer");
    const hintText = h("p", { class: "muted small" }, "Recall the answer in your head (or say it aloud) before revealing.");
    stage.replaceChildren(tag, front, hintText, h("div", { class: "actions" }, reveal));
    const showBack = () => {
      stage.replaceChildren(tag, front, h("hr"), md(card.back, "prose card-back"), h("p", { class: "muted small" }, "Be honest: Again costs nothing and schedules the card sooner."), gradeButtons(card));
    };
    reveal.focus({ preventScroll: true });
  };
  showNext();
  return root;
}

function nextDueText() {
  const next = Object.values(app.state.cards).filter((c) => c.state !== "new").map((c) => c.due).sort((a, b) => a - b)[0];
  if (!next) return "soon";
  const ms = next - Date.now();
  return ms <= 0 ? "now" : `in ${formatInterval(ms)}`;
}

// ----- mixed practice (interleaving) -----
function viewPractice() {
  const available = app.sessions.filter((s, i) => app.state.sessions[s.id]?.completedAt || (isUnlocked(i) && i === 0));
  const chosen = new Set(available.map((s) => s.id));
  const root = h("div", { class: "stack" });
  const chips = h("div", { class: "topic-chips" });
  const score = h("div", { class: "muted small" });
  let solved = 0;
  let tried = 0;
  const stage = h("section", { class: "card" });
  for (const s of available) {
    const chip = h("button", { class: "chip toggle on", type: "button" }, s.title);
    chip.addEventListener("click", () => {
      if (chosen.has(s.id) && chosen.size > 1) chosen.delete(s.id);
      else chosen.add(s.id);
      chip.classList.toggle("on", chosen.has(s.id));
    });
    chips.append(chip);
  }
  root.append(
    h("section", { class: "card" }, h("div", { class: "eyebrow" }, "Interleaved practice"), h("h1", {}, "Mixed practice"), h("p", { class: "muted" }, "Problems from different sessions, shuffled. Deciding which method fits is half the skill, and mixing builds exactly that."), chips, score),
    stage,
  );
  const one = () => {
    const pool = Object.keys(EXERCISES).filter((k) => chosen.has(EXERCISES[k].session));
    const id = app.rng.pick(pool);
    score.textContent = tried ? `${solved} / ${tried} correct this round` : "";
    stage.replaceChildren(
      questionView(generate(id, app.rng), {
        label: `${EXERCISES[id].title} · from "${app.byId[EXERCISES[id].session].title}"`,
        continueLabel: "Next problem",
        onDone: (r) => {
          tried++;
          if (r.ok) {
            solved++;
            app.state.game.counters.correct++;
            app.state.game.counters.mixedSolved++;
            award(r.hinted ? XP.correct / 2 : XP.correct);
          }
          one();
        },
      }),
    );
  };
  one();
  return root;
}

// ----- progress -----
function viewProgress() {
  const g = app.state.game;
  const lp = levelProgress(g.xp);
  const root = h("div", { class: "stack" });
  const totalReviews = app.state.log.length;
  const recalled = app.state.log.filter((l) => l.g > 1).length;
  root.append(
    h(
      "section",
      { class: "card" },
      h("div", { class: "eyebrow" }, "Your progress"),
      h("h1", {}, `Level ${lp.level} · ${lp.title}`),
      h("div", { class: "bar big" }, h("span", { style: `width:${Math.round(lp.fraction * 100)}%` })),
      h("p", { class: "muted small" }, `${g.xp} XP · ${lp.needed - lp.into} XP to level ${lp.level + 1}`),
      h(
        "div",
        { class: "stats" },
        stat("🔥", g.streak.current, "day streak"),
        stat("🏆", g.streak.best, "best streak"),
        stat("🧊", g.streak.freezes, "streak freezes"),
        stat("🧠", totalReviews, "card reviews"),
        stat("🎯", totalReviews ? `${Math.round((100 * recalled) / totalReviews)}%` : "-", "recall rate"),
        stat("🧮", g.counters.correct, "problems solved"),
      ),
    ),
  );
  const fc = forecast(allCards(), app.state.cards, { days: 7 });
  const maxF = Math.max(1, ...fc);
  const days = ["Today", "+1", "+2", "+3", "+4", "+5", "+6"];
  root.append(h("section", { class: "card" }, h("h2", {}, "Reviews coming up"), h("div", { class: "bars" }, fc.map((v, i) => h("div", { class: "bar-col" }, h("div", { class: "bar-v", style: `height:${(v / maxF) * 100}%`, title: `${v} cards` }), h("small", {}, `${v}`), h("small", { class: "muted" }, days[i]))))));
  const xpDays = Array.from({ length: 14 }, (_, i) => localDay(Date.now() - (13 - i) * 864e5));
  const maxX = Math.max(1, ...xpDays.map((d) => g.xpByDay[d] ?? 0));
  root.append(h("section", { class: "card" }, h("h2", {}, "XP, last 14 days"), h("div", { class: "bars" }, xpDays.map((d) => h("div", { class: "bar-col" }, h("div", { class: "bar-v alt", style: `height:${((g.xpByDay[d] ?? 0) / maxX) * 100}%`, title: `${d}: ${g.xpByDay[d] ?? 0} XP` }), h("small", { class: "muted" }, d.slice(8)))))));
  root.append(
    h(
      "section",
      { class: "card" },
      h("h2", {}, "Mastery by session"),
      h("p", { class: "muted small" }, "Share of each session's flashcards your memory holds for 21+ days."),
      app.sessions.map((s) => {
        const m = mastery(s, app.state.cards);
        return h("div", { class: "mastery-row" }, h("span", {}, s.title), h("div", { class: "bar" }, h("span", { style: `width:${Math.round(m * 100)}%` })), h("small", {}, `${Math.round(m * 100)}%`));
      }),
    ),
  );
  root.append(h("section", { class: "card" }, h("h2", {}, "Badges"), h("div", { class: "badges" }, BADGES.map((b) => h("div", { class: `badge ${g.badges[b.id] ? "earned" : "locked"}`, title: b.desc }, h("div", { class: "badge-icon" }, g.badges[b.id] ? b.icon : "🔒"), h("div", { class: "badge-name" }, b.name), h("div", { class: "muted small" }, b.desc))))));
  return root;
}
const stat = (icon, value, label) => h("div", { class: "stat" }, h("div", { class: "stat-v" }, `${icon} ${value}`), h("div", { class: "muted small" }, label));

// ----- book, lectures and resources -----
function viewBook() {
  const { book, lectures, companions = [], authorPages = [] } = app.course;
  const ext = (href, text) => h("a", { href, target: "_blank", rel: "noopener" }, text);
  const local = h("span", { class: "muted small" });
  // A personal copy downloaded with `npm run fetch-book` lives at app/book/itila.pdf (never committed).
  fetch("book/itila.pdf", { method: "HEAD" })
    .then((r) => r.ok && local.replaceChildren(h("a", { class: "btn", href: "book/itila.pdf", target: "_blank" }, "📄 Open your local copy")))
    .catch(() => {});
  const byLecture = {};
  for (const s of app.sessions) for (const l of s.lectures ?? []) (byLecture[l.number] ??= []).push(s);
  return h(
    "div",
    { class: "stack" },
    h(
      "section",
      { class: "card hero" },
      h("div", { class: "eyebrow" }, "The book this course follows"),
      h("h1", {}, book.title),
      h("p", {}, `${book.authors} · ${book.edition}`),
      h("div", { class: "hero-actions" }, h("a", { class: "btn primary", href: book.url, target: "_blank", rel: "noopener" }, "📖 Read the book (PDF, author's site)"), h("a", { class: "btn", href: book.home, target: "_blank", rel: "noopener" }, "Book home page"), local),
      h("p", { class: "muted small" }, book.license, " This app links to the author's copy instead of bundling it. To keep a personal copy for offline reading, run ", h("code", {}, "npm run fetch-book"), "."),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "🎥 MacKay's lectures"),
      h("p", {}, `${lectures.title}. `, ext(lectures.url, "VideoLectures.net"), " · ", ext(lectures.youtube, "YouTube playlist"), " · ", ext(lectures.home, "course page with slides")),
      h(
        "ol",
        { class: "lectures" },
        lectures.list.map((l) =>
          h(
            "li",
            {},
            ext(l.url, l.title),
            byLecture[l.number] ? h("span", { class: "muted small" }, " → ", byLecture[l.number].map((s, k) => [k ? ", " : "", h("a", { href: `#/s/${s.id}` }, `session ${app.sessions.indexOf(s) + 1}`)])) : null,
          ),
        ),
      ),
      h("p", { class: "muted small" }, lectures.note),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "How the sessions map to the book"),
      h(
        "table",
        { class: "map" },
        h("thead", {}, h("tr", {}, h("th", {}, "#"), h("th", {}, "Session"), h("th", {}, "Book"), h("th", {}, "Lectures"))),
        h(
          "tbody",
          {},
          app.sessions.map((s, i) => h("tr", {}, h("td", {}, String(i + 1)), h("td", {}, h("a", { href: `#/s/${s.id}` }, s.title)), h("td", {}, s.bookRef ?? ""), h("td", {}, (s.lectures ?? []).map((l) => l.number).join(", ")))),
        ),
      ),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "More from David MacKay"),
      h("ul", {}, authorPages.map((a) => h("li", {}, ext(a.url, a.title)))),
      companions.map((c) => h("p", { class: "small" }, "📘 Companion for Part A: ", ext(c.url, `${c.title} (${c.edition})`), ` by ${c.authors}, ${c.license}. ${c.use}`)),
    ),
  );
}

// ----- settings -----
function viewSettings() {
  const st = app.state.settings;
  const set = (k, v) => {
    st[k] = v;
    persist();
    renderHeader();
    toast("Saved", "info", 1000);
  };
  const goal = h("select", { onchange: (e) => set("dailyGoal", Number(e.target.value)) }, [20, 50, 100, 150].map((v) => h("option", { value: v, selected: v === st.dailyGoal }, `${v} XP`)));
  const time = h("input", { type: "time", value: st.reminderTime, onchange: (e) => set("reminderTime", e.target.value || "19:00") });
  const minutes = h("select", { onchange: (e) => set("reminderMinutes", Number(e.target.value)) }, [5, 10, 15, 20, 30].map((v) => h("option", { value: v, selected: v === st.reminderMinutes }, `${v} min`)));
  const retention = h("select", { onchange: (e) => set("desiredRetention", Number(e.target.value)) }, [0.8, 0.85, 0.9, 0.95].map((v) => h("option", { value: v, selected: v === st.desiredRetention }, `${Math.round(v * 100)}%`)));
  const unlock = h("input", { type: "checkbox", checked: st.unlockAll, onchange: (e) => set("unlockAll", e.target.checked) });
  const fileInput = h("input", { type: "file", accept: "application/json", hidden: true });
  fileInput.addEventListener("change", async () => {
    try {
      app.state = importJson(await fileInput.files[0].text());
      persist();
      toast("Progress imported ✓", "big");
      route();
    } catch (e) {
      toast(e.message, "bad", 4000);
    }
  });
  const notifStatus = h("span", { class: "muted small" }, typeof Notification === "undefined" ? "Not supported in this browser." : `Permission: ${Notification.permission}`);
  return h(
    "div",
    { class: "stack" },
    h("section", { class: "card" }, h("h1", {}, "Settings")),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "Habit & reminders"),
      h("div", { class: "form-grid" }, h("label", {}, "Daily XP goal", goal), h("label", {}, "Reminder time", time), h("label", {}, "Session length", minutes)),
      h("p", { class: "muted small" }, "The calendar reminder works on every device your calendar syncs to, with no account or server. Browser notifications only fire while the app is open or installed."),
      h(
        "div",
        { class: "actions" },
        h("button", { class: "btn primary", onclick: () => download("statlearner-reminder.ics", buildDailyReminderIcs({ time: st.reminderTime, minutes: st.reminderMinutes, url: location.href.split("#")[0] }), "text/calendar") }, "📅 Download calendar reminder (.ics)"),
        h(
          "button",
          {
            class: "btn",
            onclick: async () => {
              const perm = await requestNotificationPermission();
              set("notifications", perm === "granted");
              notifStatus.textContent = `Permission: ${perm}`;
              if (perm === "granted") notify("statLearner", "Notifications are on. We'll nudge you when cards are due.");
            },
          },
          "🔔 Enable browser notifications",
        ),
        notifStatus,
      ),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "Learning"),
      h("div", { class: "form-grid" }, h("label", {}, "Target recall (FSRS desired retention)", retention), h("label", { class: "check" }, unlock, " Unlock all sessions (skip mastery gating)")),
      h("p", { class: "muted small" }, "Higher target recall means more frequent reviews. 90% is the usual sweet spot between effort and memory."),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "Your data"),
      h("p", { class: "muted small" }, "Progress lives only in this browser. Export it to back up or move to another device."),
      h(
        "div",
        { class: "actions" },
        h("button", { class: "btn", onclick: () => download(`statlearner-progress-${localDay()}.json`, exportJson(app.state), "application/json") }, "⬇️ Export progress"),
        h("button", { class: "btn", onclick: () => fileInput.click() }, "⬆️ Import progress"),
        fileInput,
        h(
          "button",
          {
            class: "btn danger",
            onclick: () => {
              if (confirm("Delete all progress on this device? This cannot be undone.")) {
                app.state = reset();
                route();
              }
            },
          },
          "Reset progress",
        ),
      ),
    ),
    h("p", { class: "muted small center" }, "statLearner · GPL-3.0 · course text is original and follows ", h("a", { href: "#/book" }, app.course.book.title), "."),
  );
}

// ---------- router ----------
function route() {
  const hash = location.hash || "#/";
  const [, view, arg] = hash.split("/");
  const views = { "": viewHome, s: () => viewSession(arg), quiz: () => viewQuiz(arg), review: viewReview, practice: viewPractice, progress: viewProgress, book: viewBook, settings: viewSettings };
  const render = views[view] ?? viewHome;
  main().replaceChildren(render());
  window.scrollTo(0, 0);
  renderHeader();
}

function checkReminder() {
  const st = app.state;
  const now = new Date();
  if (!st.settings.notifications) return;
  if (shouldNotify({ time: st.settings.reminderTime, lastNotifiedDay: st.lastNotifiedDay, today: localDay(now), nowMinutes: now.getHours() * 60 + now.getMinutes(), dueCount: dueCount() })) {
    st.lastNotifiedDay = localDay(now);
    persist();
    notify("statLearner", `${dueCount()} card(s) are due. A 10-minute review keeps them fresh.`);
  }
}

async function boot() {
  app.state = load();
  try {
    await loadContent();
  } catch (e) {
    main().replaceChildren(h("section", { class: "card" }, h("h2", {}, "Could not load the course"), h("p", {}, "Open the app through a web server (for example `npm run serve`), not as a file:// page."), h("pre", {}, String(e))));
    return;
  }
  window.addEventListener("hashchange", route);
  route();
  checkReminder();
  setInterval(checkReminder, 5 * 60_000);
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
}

boot();

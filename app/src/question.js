// One question widget used everywhere: warm-ups, checks, practice, quizzes, reviews.
// Modes implement faded worked examples:
//   "worked"      - full solution shown, learner studies it
//   "partial"     - first half of the solution shown, learner finishes
//   "independent" - learner solves alone (hint available)

import { h, md, mdInline } from "./dom.js";
import { checkQuestion } from "./check.js";
import { fmt } from "./exercises.js";

export function questionView(q, { onDone, mode = "independent", label = "", continueLabel = "Continue" } = {}) {
  const root = h("div", { class: `question ${mode}` });
  if (label) root.append(h("div", { class: "q-label" }, label));
  root.append(md(q.prompt, "prose q-prompt"));

  const steps = q.steps ?? [];
  if (mode === "worked" && steps.length) {
    root.append(h("div", { class: "worked" }, h("div", { class: "worked-title" }, "Worked example: study each step"), h("ol", {}, steps.map((s) => h("li", {}, mdInline(s))))));
    const next = h("button", { class: "btn primary", onclick: () => onDone?.({ ok: true, worked: true }) }, "Got it: my turn");
    root.append(h("div", { class: "actions" }, next));
    return root;
  }
  const shown = mode === "partial" ? Math.max(1, Math.floor(steps.length / 2)) : 0;
  if (shown > 0 && steps.length > 1) {
    root.append(h("div", { class: "worked partial" }, h("div", { class: "worked-title" }, "Start of the solution: finish it yourself"), h("ol", {}, steps.slice(0, shown).map((s) => h("li", {}, mdInline(s))))));
  }

  let hinted = false;
  let answered = false;
  const feedback = h("div", { class: "feedback", "aria-live": "polite" });
  const actions = h("div", { class: "actions" });

  const finish = (result) => {
    answered = true;
    root.classList.add(result.ok ? "is-right" : "is-wrong");
    const correctText = q.type === "choice" ? q.options[q.answer] : fmt(q.answer, 4);
    feedback.append(
      h("div", { class: `verdict ${result.ok ? "ok" : "bad"}` }, result.ok ? "✓ Correct" : "✗ Not quite", result.ok ? "" : h("span", { class: "answer-was" }, " - answer: ", mdInline(String(correctText)))),
    );
    if (result.note) feedback.append(h("div", { class: "note" }, result.note));
    if (q.type === "choice" && q.feedback?.[result.value] && result.value !== q.answer) feedback.append(md(q.feedback[result.value], "prose why-wrong"));
    if (q.explain) feedback.append(md(q.explain, "prose explain"));
    if (steps.length) {
      const det = h("details", { class: "solution", open: !result.ok }, h("summary", {}, "Worked solution"), h("ol", {}, steps.map((s) => h("li", {}, mdInline(s)))));
      feedback.append(det);
    }
    actions.replaceChildren(h("button", { class: "btn primary", onclick: () => onDone?.({ ...result, hinted }) }, continueLabel));
    root.append(actions); // move the Continue button below the feedback
    actions.querySelector("button").focus({ preventScroll: true });
  };

  if (q.type === "choice") {
    const list = h("div", { class: "options", role: "group" });
    q.options.forEach((opt, i) => {
      const b = h(
        "button",
        {
          class: "option",
          type: "button",
          onclick: () => {
            if (answered) return;
            const result = checkQuestion(q, i);
            list.querySelectorAll("button").forEach((x, j) => {
              x.disabled = true;
              if (j === q.answer) x.classList.add("correct");
              else if (j === i) x.classList.add("chosen-wrong");
            });
            finish(result);
          },
        },
        mdInline(opt),
      );
      list.append(b);
    });
    root.append(list);
  } else {
    const input = h("input", { type: "text", inputmode: "decimal", autocomplete: "off", placeholder: "Your answer", "aria-label": "Your answer", class: "num-input" });
    const submit = () => {
      if (answered || !input.value.trim()) return;
      const result = checkQuestion(q, input.value);
      if (Number.isNaN(result.value)) {
        feedback.replaceChildren(h("div", { class: "note" }, result.note));
        return;
      }
      input.disabled = true;
      feedback.replaceChildren();
      finish(result);
    };
    input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
    actions.append(h("button", { class: "btn primary", onclick: submit }, "Check"));
    root.append(h("div", { class: "num-row" }, input));
    setTimeout(() => input.focus({ preventScroll: true }), 0);
  }
  if (q.hint && mode !== "worked") {
    const hintBox = h("div", { class: "hint", hidden: true }, mdInline(q.hint));
    const hb = h("button", {
      class: "btn ghost small",
      type: "button",
      onclick: () => {
        hinted = true;
        hintBox.hidden = false;
        hb.remove();
      },
    }, "💡 Hint");
    actions.append(hb);
    root.append(hintBox);
  }
  root.append(actions, feedback);
  return root;
}

import { h, md, mdInline } from "./dom.js";
import { deepDiveView } from "./deep-dive.js";

// Reading only: opening a reference must never advance a lesson or award XP.
export function showLessonReview(session) {
  const trigger = document.activeElement;
  const reading = h("div", { class: "lesson-review-reading stack" });
  for (const block of session.blocks) {
    if (block.type === "text" || block.type === "callout") {
      reading.append(md(block.md));
    } else if (block.type === "example") {
      reading.append(h("section", {}, h("h3", {}, block.title), block.md ? md(block.md) : null,
        h("ol", {}, block.steps.map((step) => h("li", {}, mdInline(step))))));
    }
  }
  const dialog = h("dialog", { class: "lesson-review", "aria-labelledby": "lesson-review-title" },
    h("div", { class: "lesson-review-header" },
      h("h2", { id: "lesson-review-title" }, session.title),
      h("button", { type: "button", class: "btn primary", autofocus: true, onclick: () => dialog.close() }, "Back to question")),
    h("p", { class: "muted small" }, "Review the explanations and worked examples. Your answer and place in the activity stay unchanged."),
    deepDiveView(session),
    reading);
  const close = () => dialog.close();
  dialog.addEventListener("close", () => {
    window.removeEventListener("hashchange", close);
    dialog.remove();
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  }, { once: true });
  window.addEventListener("hashchange", close);
  document.body.append(dialog);
  dialog.showModal();
}

// Calculator panel for numeric answer fields: type or tap an expression, watch
// the result update live, then put it into the answer field with one tap.

import { h } from "./dom.js";
import { evaluate, formatResult } from "./calc.js";

// [label, text inserted at the caret, extra class]
const FUNCTION_KEYS = [
  ["ln", "ln("],
  ["log", "log("],
  ["log₂", "log2("],
  ["eˣ", "exp("],
  ["x²", "^2"],
  ["C(n,k)", "C("],
  [",", ","],
  ["%", "%"],
  ["e", "e"],
  ["x⁻¹", "^(-1)"],
];
const KEYPAD = [
  ["C", "clear", "fn"], ["⌫", "back", "fn"], ["(", "("], [")", ")"], ["÷", "/", "op"],
  ["7", "7"], ["8", "8"], ["9", "9"], ["^", "^"], ["×", "*", "op"],
  ["4", "4"], ["5", "5"], ["6", "6"], ["√", "√"], ["−", "-", "op"],
  ["1", "1"], ["2", "2"], ["3", "3"], ["!", "!"], ["+", "+", "op"],
  ["0", "0"], [".", "."], ["ans", "ans"], ["π", "π"], ["=", "equals", "eq"],
];

let lastAnswer = 0; // "ans" survives from one question to the next

export function calculatorPanel({ onUse, onClose } = {}) {
  const finePointer = typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;
  const expr = h("input", { type: "text", class: "calc-expr", autocomplete: "off", spellcheck: "false", "aria-label": "Calculator expression", placeholder: "e.g. sqrt(0.4*0.6/200)" });
  const preview = h("div", { class: "calc-preview", "aria-live": "polite" });
  const history = h("div", { class: "calc-history muted small" });

  const update = (strict = false) => {
    const r = evaluate(expr.value, { ans: lastAnswer });
    preview.classList.toggle("error", !r.ok && strict);
    preview.textContent = r.ok ? `= ${formatResult(r.value)}` : strict ? r.error : "";
    return r;
  };
  const insert = (text) => {
    const start = expr.selectionStart ?? expr.value.length;
    const end = expr.selectionEnd ?? start;
    expr.value = expr.value.slice(0, start) + text + expr.value.slice(end);
    expr.setSelectionRange(start + text.length, start + text.length);
    if (finePointer) expr.focus();
    update();
  };
  const backspace = () => {
    const start = expr.selectionStart ?? expr.value.length;
    const end = expr.selectionEnd ?? start;
    const from = start === end ? Math.max(0, start - 1) : start;
    expr.value = expr.value.slice(0, from) + expr.value.slice(end);
    expr.setSelectionRange(from, from);
    update();
  };
  const equals = () => {
    const r = update(true);
    if (!r.ok) return r;
    const shown = formatResult(r.value);
    history.textContent = `${expr.value} = ${shown}`;
    lastAnswer = r.value;
    expr.value = shown;
    preview.textContent = "";
    return r;
  };
  const press = (action) => {
    if (action === "clear") {
      expr.value = "";
      update();
    } else if (action === "back") backspace();
    else if (action === "equals") equals();
    else insert(action);
  };

  expr.addEventListener("input", () => update());
  expr.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      equals();
    }
    if (e.key === "Escape") onClose?.();
  });

  const key = ([label, action, cls = ""]) =>
    h("button", { type: "button", class: `calc-key ${cls}`, "aria-label": label === "⌫" ? "Delete" : label === "C" ? "Clear" : null, onclick: () => press(action) }, label);

  const panel = h(
    "div",
    { class: "calc", role: "group", "aria-label": "Calculator" },
    history,
    expr,
    preview,
    h("div", { class: "calc-fns" }, FUNCTION_KEYS.map(key)),
    h("div", { class: "calc-pad" }, KEYPAD.map(key)),
  );
  if (onUse) {
    const use = () => {
      if (!expr.value.trim()) return (preview.textContent = "Type or tap a calculation first");
      const r = update(true);
      if (!r.ok) return;
      lastAnswer = r.value;
      onUse(formatResult(r.value));
    };
    panel.append(h("div", { class: "actions" }, h("button", { type: "button", class: "btn primary small", onclick: use }, "Use result in answer"), onClose ? h("button", { type: "button", class: "btn ghost small", onclick: onClose }, "Close") : null));
  }
  // On touch screens the keypad replaces the on-screen keyboard, so focus only with a mouse.
  panel.focusInput = () => finePointer && expr.focus({ preventScroll: true });
  return panel;
}

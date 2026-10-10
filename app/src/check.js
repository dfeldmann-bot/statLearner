// Answer parsing and checking for numeric and multiple-choice questions.

// Accepts "0.25", "0,25", ".25", "25%", "1/4", "-3", "1e-3".
export function parseNumber(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/\s+/g, "").replace(/−/g, "-");
  if (!s) return NaN;
  let scale = 1;
  if (s.endsWith("%")) {
    scale = 0.01;
    s = s.slice(0, -1);
  }
  if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", "."); // decimal comma
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac) return (Number(frac[1]) / Number(frac[2])) * scale;
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN;
  return Number(s) * scale;
}

export const defaultTolerance = (answer) => Math.max(Math.abs(answer) * 0.01, 0.005);

// Returns { ok, value, note } for a typed numeric answer.
export function checkNumeric(raw, answer, tolerance) {
  const value = parseNumber(raw);
  if (Number.isNaN(value)) return { ok: false, value, note: "Enter a number such as 0.25, 25% or 1/4." };
  const tol = tolerance ?? defaultTolerance(answer);
  if (Math.abs(value - answer) <= tol) return { ok: true, value };
  // A proportion typed as a percentage without the % sign.
  if (answer > 0 && answer <= 1 && value > 1 && value <= 100 && Math.abs(value / 100 - answer) <= tol) {
    return { ok: true, value: value / 100, note: `Read ${value} as ${value}% = ${value / 100}. Proportions are usually written as decimals.` };
  }
  return { ok: false, value };
}

export function checkChoice(selected, answer) {
  return { ok: Number(selected) === Number(answer), value: Number(selected) };
}

export function checkQuestion(question, raw) {
  return question.type === "numeric" ? checkNumeric(raw, question.answer, question.tolerance) : checkChoice(raw, question.answer);
}

// Shared helpers for exercise generators.

export const fmt = (x, d = 2) => {
  const v = Number(Number(x).toFixed(d));
  return Object.is(v, -0) ? "0" : String(v);
};

export const pct = (p) => `${fmt(p * 100, 1)}%`; // for prose, not inside $math$

// Scientific notation for TeX: 0.000977 -> "9.77 \times 10^{-4}".
export function sci(x, digits = 3) {
  if (x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e <= 3) return fmt(x, Math.max(0, digits - 1 - e));
  return `${fmt(x / 10 ** e, digits - 1)} \\times 10^{${e}}`;
}

export const numeric = (o) => ({ type: "numeric", ...o });
export const choice = (o) => ({ type: "choice", ...o });

// Shuffle options and track where the correct one lands.
export function shuffled(rng, correct, wrong) {
  const options = rng.shuffle([correct, ...wrong]);
  return { options, answer: options.indexOf(correct) };
}

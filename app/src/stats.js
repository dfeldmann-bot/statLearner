// Small statistics toolkit used by exercises, simulations and tests.

export const sum = (xs) => xs.reduce((a, b) => a + b, 0);

export const mean = (xs) => sum(xs) / xs.length;

export function median(xs) {
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Sample variance: divides by n - 1.
export function variance(xs) {
  const m = mean(xs);
  return sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1);
}

export const sd = (xs) => Math.sqrt(variance(xs));

export function correlation(xs, ys) {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

// Least-squares line y = b0 + b1 x.
export function linearFit(xs, ys) {
  const b1 = correlation(xs, ys) * (sd(ys) / sd(xs));
  const b0 = mean(ys) - b1 * mean(xs);
  return { b0, b1 };
}

// Error function, Abramowitz & Stegun 7.1.26 (absolute error < 1.5e-7).
export function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

// P(Z <= z) for a standard normal Z.
export const normalCdf = (z, mu = 0, sigma = 1) =>
  0.5 * (1 + erf((z - mu) / (sigma * Math.SQRT2)));

export const normalPdf = (x, mu = 0, sigma = 1) =>
  Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

export function choose(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return c;
}

export const binomPmf = (k, n, p) => choose(n, k) * p ** k * (1 - p) ** (n - k);

// Critical values z* for common confidence levels.
export const Z_STAR = { 90: 1.645, 95: 1.96, 99: 2.576 };

export function histogram(values, bins, min, max) {
  const counts = new Array(bins).fill(0);
  const width = (max - min) / bins;
  for (const v of values) {
    let i = Math.floor((v - min) / width);
    if (i === bins) i = bins - 1;
    if (i >= 0 && i < bins) counts[i]++;
  }
  return { counts, width };
}

// log Γ(z) via the Lanczos approximation (relative error ~1e-15).
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];
export function lgamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = LANCZOS[0];
  for (let i = 1; i < 9; i++) x += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

export const logChoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);

// Beta(a, b) density, used for the posterior of a bent coin's bias.
export function betaPdf(x, a, b) {
  if (x <= 0 || x >= 1) return 0;
  return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - (lgamma(a) + lgamma(b) - lgamma(a + b)));
}

// Entropy in bits of a probability vector.
export const entropy = (ps) => ps.reduce((h, p) => (p > 0 ? h + p * Math.log2(1 / p) : h), 0);

// Evidence ratio P(D | p uniform) / P(D | p = 1/2) for h heads in n tosses.
export const bayesFactorCoin = (n, h) => Math.exp(-Math.log(n + 1) - logChoose(n, h) + n * Math.log(2));

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

// ---------- clustering (ITILA ch. 20, 22) ----------
// Points and means are arrays of coordinates ([x] in 1-D, [x, y] in 2-D).

// MacKay's distance: half the squared Euclidean distance, d(x, m) = ½ Σᵢ (xᵢ − mᵢ)².
export function halfSqDist(x, m) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (x[i] - m[i]) ** 2;
  return s / 2;
}

// Responsibilities r[n][k] of each mean for each point: softmax of −β·d over the means.
// beta = Infinity gives hard K-means (1 for the nearest mean, ties go to the lower k).
export function responsibilities(points, means, beta = Infinity) {
  return points.map((x) => {
    const d = means.map((m) => halfSqDist(x, m));
    if (beta === Infinity) {
      let best = 0;
      for (let k = 1; k < d.length; k++) if (d[k] < d[best]) best = k;
      return d.map((_, k) => (k === best ? 1 : 0));
    }
    const a = d.map((dk) => -beta * dk);
    const top = Math.max(...a);
    const e = a.map((v) => Math.exp(v - top)); // log-sum-exp trick: no underflow for large β
    const z = e.reduce((s, v) => s + v, 0);
    return e.map((v) => v / z);
  });
}

// Update step: each mean moves to the responsibility-weighted average of the points.
// A mean with no responsibility at all stays where it is.
export function updateMeans(points, r, means) {
  return means.map((m, k) => {
    let total = 0;
    const acc = m.map(() => 0);
    points.forEach((x, n) => {
      total += r[n][k];
      x.forEach((xi, i) => (acc[i] += r[n][k] * xi));
    });
    return total > 1e-12 ? acc.map((v) => v / total) : m.slice();
  });
}

// Σₙ Σₖ r[n][k]·d(xₙ, mₖ). With hard responsibilities this is the K-means objective J.
export function clusterObjective(points, means, r) {
  let J = 0;
  points.forEach((x, n) => means.forEach((m, k) => (J += r[n][k] ? r[n][k] * halfSqDist(x, m) : 0)));
  return J;
}

// Log-likelihood of an equal-weight mixture of K Gaussians with variance σ² = 1/β on every axis:
// P(x) = (1/K) Σₖ (β/2π)^(D/2) exp(−β·d(x, mₖ)). Soft K-means updates never decrease it.
export function mixtureLogLik(points, means, beta) {
  const K = means.length;
  let L = 0;
  for (const x of points) {
    const a = means.map((m) => -beta * halfSqDist(x, m));
    const top = Math.max(...a);
    const lse = top + Math.log(a.reduce((s, v) => s + Math.exp(v - top), 0));
    L += lse - Math.log(K) + (x.length / 2) * Math.log(beta / (2 * Math.PI));
  }
  return L;
}

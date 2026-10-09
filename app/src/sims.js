// Interactive simulations (canvas, no libraries). Each sim follows
// "predict, then observe": the lesson asks for a prediction first, the sim
// shows what really happens. mount(el, rng) builds controls + canvas inside el.

import { mean, median, sd, normalPdf, normalCdf, binomPmf, histogram, correlation, linearFit, Z_STAR } from "./stats.js";
import { makeRng } from "./rng.js";

const css = (name, fallback) =>
  (typeof getComputedStyle !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;
const colors = () => ({
  text: css("--text", "#1d2433"),
  muted: css("--muted", "#6b7280"),
  grid: css("--border", "#e5e7eb"),
  a: css("--accent", "#4f46e5"),
  b: css("--accent-2", "#f59e0b"),
  ok: css("--ok", "#16a34a"),
  bad: css("--danger", "#dc2626"),
});

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const k of kids) n.append(k);
  return n;
}

// Builds controls and a canvas. Returns { ctl, draw helpers, readout }.
function frame(root, controls, height = 240) {
  const values = {};
  const panel = el("div", { class: "sim-controls" });
  const listeners = [];
  for (const c of controls) {
    if (c.type === "range") {
      const out = el("output", {}, "");
      const input = el("input", { type: "range", min: c.min, max: c.max, step: c.step ?? 1, value: c.value, "aria-label": c.label });
      const sync = () => {
        values[c.id] = Number(input.value);
        out.textContent = c.format ? c.format(values[c.id]) : input.value;
      };
      input.addEventListener("input", () => {
        sync();
        listeners.forEach((f) => f(c.id));
      });
      sync();
      panel.append(el("label", { class: "sim-range" }, el("span", {}, c.label), input, out));
    } else if (c.type === "select") {
      const sel = el("select", { "aria-label": c.label });
      for (const [v, label] of c.options) sel.append(el("option", { value: v }, label));
      sel.value = c.value;
      values[c.id] = c.value;
      sel.addEventListener("change", () => {
        values[c.id] = sel.value;
        listeners.forEach((f) => f(c.id));
      });
      panel.append(el("label", { class: "sim-range" }, el("span", {}, c.label), sel));
    } else if (c.type === "checkbox") {
      const box = el("input", { type: "checkbox" });
      box.checked = !!c.value;
      values[c.id] = !!c.value;
      box.addEventListener("change", () => {
        values[c.id] = box.checked;
        listeners.forEach((f) => f(c.id));
      });
      panel.append(el("label", { class: "sim-check" }, box, el("span", {}, c.label)));
    } else if (c.type === "button") {
      panel.append(el("button", { class: "btn small", type: "button", onclick: () => listeners.forEach((f) => f(c.id)) }, c.label));
    }
  }
  const canvas = el("canvas", { class: "sim-canvas", role: "img", "aria-label": "simulation plot" });
  const readout = el("div", { class: "sim-readout", "aria-live": "polite" });
  root.append(panel, canvas, readout);
  const width = Math.min(680, Math.max(280, root.clientWidth || 600));
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = "100%";
  canvas.style.maxWidth = `${width}px`;
  canvas.style.aspectRatio = `${width} / ${height}`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const pad = { l: 40, r: 12, t: 12, b: 28 };
  const plot = makePlot(ctx, width, height, pad);
  return { values, onChange: (f) => listeners.push(f), plot, readout };
}

function makePlot(ctx, W, H, pad) {
  let xr = [0, 1];
  let yr = [0, 1];
  const X = (x) => pad.l + ((x - xr[0]) / (xr[1] - xr[0])) * (W - pad.l - pad.r);
  const Y = (y) => H - pad.b - ((y - yr[0]) / (yr[1] - yr[0])) * (H - pad.t - pad.b);
  return {
    ctx,
    X,
    Y,
    clear(xRange, yRange, { xTicks = 5, yTicks = 0, xLabel = "", integerStep = 0 } = {}) {
      const c = colors();
      xr = xRange;
      yr = yRange;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = c.grid;
      ctx.fillStyle = c.muted;
      ctx.font = "11px system-ui, sans-serif";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, H - pad.b);
      ctx.lineTo(W - pad.r, H - pad.b);
      ctx.stroke();
      ctx.textAlign = "center";
      if (integerStep) {
        for (let v = Math.ceil(xr[0]); v <= xr[1]; v += integerStep) ctx.fillText(String(v), X(v), H - pad.b + 14);
      } else {
        for (let i = 0; i <= xTicks; i++) {
          const v = xr[0] + ((xr[1] - xr[0]) * i) / xTicks;
          ctx.fillText(niceNum(v), X(v), H - pad.b + 14);
        }
      }
      if (xLabel) ctx.fillText(xLabel, (pad.l + W - pad.r) / 2, H - 2);
      ctx.textAlign = "right";
      for (let i = 1; i <= yTicks; i++) {
        const v = yr[0] + ((yr[1] - yr[0]) * i) / yTicks;
        ctx.fillText(niceNum(v), pad.l - 4, Y(v) + 4);
        ctx.beginPath();
        ctx.moveTo(pad.l, Y(v));
        ctx.lineTo(W - pad.r, Y(v));
        ctx.stroke();
      }
    },
    bars(values, x0, width, color, alpha = 0.85) {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      values.forEach((v, i) => {
        const left = X(x0 + i * width);
        const right = X(x0 + (i + 1) * width);
        ctx.fillRect(left + 0.5, Y(v), Math.max(1, right - left - 1), Y(yr[0]) - Y(v));
      });
      ctx.globalAlpha = 1;
    },
    dots(points, color, r = 4) {
      ctx.fillStyle = color;
      for (const [x, y] of points) {
        ctx.beginPath();
        ctx.arc(X(x), Y(y), r, 0, 2 * Math.PI);
        ctx.fill();
      }
    },
    vline(x, color, label) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X(x), pad.t);
      ctx.lineTo(X(x), H - pad.b);
      ctx.stroke();
      if (label) {
        ctx.fillStyle = color;
        ctx.font = "bold 11px system-ui, sans-serif";
        const nearRight = X(x) > W - pad.r - 80;
        ctx.textAlign = nearRight ? "right" : "left";
        ctx.fillText(label, X(x) + (nearRight ? -4 : 4), pad.t + 10);
      }
    },
    curve(f, color, from = xr[0], to = xr[1], width = 2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = from + ((to - from) * i) / 200;
        const px = X(x);
        const py = Y(f(x));
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    },
    segment(x1, y1, x2, y2, color, width = 2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(X(x1), Y(y1));
      ctx.lineTo(X(x2), Y(y2));
      ctx.stroke();
    },
    fillUnder(f, from, to, color) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(X(from), Y(0));
      for (let i = 0; i <= 120; i++) {
        const x = from + ((to - from) * i) / 120;
        ctx.lineTo(X(x), Y(f(x)));
      }
      ctx.lineTo(X(to), Y(0));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    },
  };
}

function niceNum(v) {
  const a = Math.abs(v);
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(0);
  if (a >= 1) return Number(v.toFixed(1)).toString();
  return Number(v.toFixed(2)).toString();
}

const f2 = (x) => Number(x).toFixed(2);

// Draws a sample from a named population shape (mean/SD known exactly).
const POPULATIONS = {
  uniform: { label: "Uniform 0–10", draw: (r) => 10 * r.next(), mu: 5, sigma: 10 / Math.sqrt(12), range: [0, 10] },
  skewed: { label: "Right-skewed (exponential, mean 2)", draw: (r) => -2 * Math.log(1 - r.next()), mu: 2, sigma: 2, range: [0, 12] },
  bimodal: {
    label: "Two-humped",
    draw: (r) => (r.next() < 0.5 ? r.normal(3, 0.8) : r.normal(8, 0.8)),
    mu: 5.5,
    sigma: Math.sqrt(0.64 + 6.25),
    range: [0, 11],
  },
};

export const SIMS = {
  "mean-median": {
    title: "Mean vs. median: drag the outlier",
    mount(root) {
      const base = [22, 25, 27, 28, 30, 31, 33, 35];
      const f = frame(root, [{ type: "range", id: "big", label: "Largest value", min: 36, max: 200, value: 40 }], 200);
      const draw = () => {
        const c = colors();
        const xs = [...base, f.values.big];
        const m = mean(xs);
        const md = median(xs);
        f.plot.clear([0, 210], [0, 1], { xTicks: 7, xLabel: "salary (k€)" });
        f.plot.dots(xs.map((x) => [x, 0.25]), c.text, 6);
        f.plot.vline(m, c.a, `mean ${f2(m)}`);
        f.plot.vline(md, c.b, "median");
        f.readout.textContent = `Mean = ${f2(m)}, median = ${f2(md)}. One extreme value moves the mean by ${f2(m - mean([...base, 36]))}; the median does not move.`;
      };
      f.onChange(draw);
      draw();
    },
  },

  "sd-explorer": {
    title: "What standard deviation measures",
    mount(root, rng) {
      const z = Array.from({ length: 30 }, () => rng.normal());
      const f = frame(root, [{ type: "range", id: "spread", label: "Spread", min: 0.2, max: 3, step: 0.1, value: 1, format: (v) => `×${v}` }], 200);
      const draw = () => {
        const c = colors();
        const xs = z.map((v) => 50 + 8 * f.values.spread * v);
        const m = mean(xs);
        const s = sd(xs);
        f.plot.clear([0, 100], [0, 1], { xTicks: 5 });
        f.plot.ctx.fillStyle = c.a;
        f.plot.ctx.globalAlpha = 0.12;
        f.plot.ctx.fillRect(f.plot.X(m - s), 12, f.plot.X(m + s) - f.plot.X(m - s), 200 - 40);
        f.plot.ctx.globalAlpha = 1;
        f.plot.dots(xs.map((x, i) => [x, 0.15 + (i % 6) * 0.13]), c.text, 4);
        f.plot.vline(m, c.a, "mean");
        const inside = xs.filter((x) => Math.abs(x - m) <= s).length;
        f.readout.textContent = `SD = ${f2(s)}. The shaded band is mean ± 1 SD and holds ${inside} of ${xs.length} points (${Math.round((100 * inside) / xs.length)}%).`;
      };
      f.onChange(draw);
      draw();
    },
  },

  "law-large-numbers": {
    title: "Law of large numbers: flip a coin",
    mount(root, rng) {
      let flips = [];
      const f = frame(root, [
        { type: "button", id: "f10", label: "Flip 10" },
        { type: "button", id: "f100", label: "Flip 100" },
        { type: "button", id: "f1000", label: "Flip 1000" },
        { type: "button", id: "reset", label: "Reset" },
      ]);
      const draw = () => {
        const c = colors();
        const n = flips.length;
        f.plot.clear([0, Math.max(10, n)], [0, 1], { xTicks: 5, yTicks: 4, xLabel: "number of flips" });
        f.plot.segment(0, 0.5, Math.max(10, n), 0.5, c.b, 1.5);
        let heads = 0;
        const pts = flips.map((h, i) => ((heads += h), [i + 1, heads / (i + 1)]));
        f.plot.ctx.strokeStyle = c.a;
        f.plot.ctx.lineWidth = 2;
        f.plot.ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? f.plot.ctx.lineTo(f.plot.X(x), f.plot.Y(y)) : f.plot.ctx.moveTo(f.plot.X(x), f.plot.Y(y))));
        f.plot.ctx.stroke();
        f.readout.textContent = n ? `${n} flips, ${heads} heads: proportion ${f2(heads / n)}. The proportion settles near 0.5, but the count of heads minus n/2 (${heads - n / 2}) need not shrink.` : "Flip to start.";
      };
      f.onChange((id) => {
        if (id === "reset") flips = [];
        else {
          const k = { f10: 10, f100: 100, f1000: 1000 }[id];
          for (let i = 0; i < k; i++) flips.push(rng.next() < 0.5 ? 1 : 0);
        }
        draw();
      });
      draw();
    },
  },

  "bayes-grid": {
    title: "1000 people take a test",
    mount(root) {
      const f = frame(
        root,
        [
          { type: "range", id: "prev", label: "Prevalence", min: 0.5, max: 30, step: 0.5, value: 2, format: (v) => `${v}%` },
          { type: "range", id: "sens", label: "Sensitivity", min: 50, max: 100, step: 1, value: 95, format: (v) => `${v}%` },
          { type: "range", id: "spec", label: "Specificity", min: 50, max: 100, step: 1, value: 95, format: (v) => `${v}%` },
        ],
        260,
      );
      const draw = () => {
        const c = colors();
        const N = 1000;
        const sick = Math.round((N * f.values.prev) / 100);
        const tp = Math.round((sick * f.values.sens) / 100);
        const fp = Math.round(((N - sick) * (100 - f.values.spec)) / 100);
        const ctx = f.plot.ctx;
        f.plot.clear([0, 1], [0, 1], { xTicks: 0 });
        const cols = 50;
        const cell = Math.min(12, (ctx.canvas.width / (window.devicePixelRatio || 1) - 20) / cols);
        const kinds = [
          ...Array(tp).fill(c.bad),
          ...Array(sick - tp).fill(c.b),
          ...Array(fp).fill(c.a),
          ...Array(N - sick - fp).fill(c.grid),
        ];
        kinds.forEach((col, i) => {
          ctx.fillStyle = col;
          ctx.fillRect(10 + (i % cols) * cell, 10 + Math.floor(i / cols) * cell, cell - 1.5, cell - 1.5);
        });
        const post = tp + fp ? tp / (tp + fp) : 0;
        f.readout.innerHTML = `<span class="key" style="background:${c.bad}"></span>sick &amp; positive: ${tp} &nbsp; <span class="key" style="background:${c.a}"></span>healthy but positive: ${fp} &nbsp; <span class="key" style="background:${c.b}"></span>sick, missed: ${sick - tp}<br><strong>P(sick | positive) = ${tp} / ${tp + fp} = ${f2(post)}</strong>`;
      };
      f.onChange(draw);
      draw();
    },
  },

  "normal-explorer": {
    title: "Areas under the normal curve",
    mount(root) {
      const f = frame(root, [
        { type: "range", id: "mu", label: "Mean μ", min: 40, max: 60, value: 50 },
        { type: "range", id: "sigma", label: "SD σ", min: 2, max: 12, value: 8 },
        { type: "range", id: "cut", label: "Cut-off x", min: 20, max: 80, value: 58 },
      ]);
      const draw = () => {
        const c = colors();
        const { mu, sigma, cut } = f.values;
        const pdf = (x) => normalPdf(x, mu, sigma);
        f.plot.clear([20, 80], [0, 0.21], { xTicks: 6 });
        f.plot.fillUnder(pdf, 20, cut, c.a);
        f.plot.curve(pdf, c.text);
        f.plot.vline(cut, c.b, "x");
        const z = (cut - mu) / sigma;
        f.readout.textContent = `z = (x − μ)/σ = (${cut} − ${mu})/${sigma} = ${f2(z)}.  P(X < ${cut}) = Φ(${f2(z)}) = ${normalCdf(z).toFixed(4)}.`;
      };
      f.onChange(draw);
      draw();
    },
  },

  "binomial-explorer": {
    title: "Binomial distribution",
    mount(root) {
      const f = frame(root, [
        { type: "range", id: "n", label: "Trials n", min: 1, max: 60, value: 10 },
        { type: "range", id: "p", label: "Success prob. p", min: 0.05, max: 0.95, step: 0.05, value: 0.3 },
      ]);
      const draw = () => {
        const c = colors();
        const { n, p } = f.values;
        const probs = Array.from({ length: n + 1 }, (_, k) => binomPmf(k, n, p));
        const top = Math.max(...probs);
        f.plot.clear([-0.5, n + 0.5], [0, top * 1.15], { integerStep: Math.max(1, Math.ceil(n / 10)), yTicks: 3, xLabel: "number of successes k" });
        f.plot.bars(probs, -0.5, 1, c.a);
        const mu = n * p;
        const s = Math.sqrt(n * p * (1 - p));
        f.plot.vline(mu, c.b, "np");
        if (n * p >= 10 && n * (1 - p) >= 10) f.plot.curve((x) => normalPdf(x, mu, s), c.text, -0.5, n + 0.5, 1.5);
        f.readout.textContent = `Mean np = ${f2(mu)}, SD √(np(1−p)) = ${f2(s)}. ${n * p >= 10 && n * (1 - p) >= 10 ? "np ≥ 10 and n(1−p) ≥ 10: the normal curve fits well." : "Increase n until np ≥ 10 and n(1−p) ≥ 10 to see the normal approximation."}`;
      };
      f.onChange(draw);
      draw();
    },
  },

  clt: {
    title: "Central limit theorem: the distribution of sample means",
    mount(root, rng) {
      const f = frame(
        root,
        [
          { type: "select", id: "pop", label: "Population", value: "skewed", options: Object.entries(POPULATIONS).map(([k, v]) => [k, v.label]) },
          { type: "range", id: "n", label: "Sample size n", min: 1, max: 50, value: 2 },
          { type: "button", id: "go", label: "Draw 2000 samples" },
        ],
        250,
      );
      const draw = () => {
        const c = colors();
        const pop = POPULATIONS[f.values.pop];
        const n = f.values.n;
        const means = Array.from({ length: 2000 }, () => {
          let s = 0;
          for (let i = 0; i < n; i++) s += pop.draw(rng);
          return s / n;
        });
        const [lo, hi] = pop.range;
        const bins = 40;
        const { counts, width } = histogram(means, bins, lo, hi);
        const dens = counts.map((k) => k / (means.length * width));
        const se = pop.sigma / Math.sqrt(n);
        const peak = Math.max(...dens, normalPdf(pop.mu, pop.mu, se));
        f.plot.clear([lo, hi], [0, peak * 1.1], { xTicks: 5, xLabel: "sample mean" });
        f.plot.bars(dens, lo, width, c.a, 0.7);
        f.plot.curve((x) => normalPdf(x, pop.mu, se), c.b);
        f.readout.textContent = `SD of the 2000 sample means = ${f2(sd(means))}; theory σ/√n = ${f2(pop.sigma)}/√${n} = ${f2(se)}. Orange curve: normal with that SE.`;
      };
      f.onChange(draw);
      draw();
    },
  },

  "ci-coverage": {
    title: "What '95% confidence' means",
    mount(root, rng) {
      let total = 0;
      let hits = 0;
      const p = 0.4;
      const f = frame(
        root,
        [
          { type: "range", id: "n", label: "Sample size n", min: 20, max: 500, step: 10, value: 100 },
          { type: "select", id: "level", label: "Confidence", value: "95", options: [["90", "90%"], ["95", "95%"], ["99", "99%"]] },
          { type: "button", id: "go", label: "Draw 40 more intervals" },
        ],
        300,
      );
      const draw = (id) => {
        if (id && id !== "go") {
          total = 0;
          hits = 0;
        }
        const c = colors();
        const { n } = f.values;
        const z = Z_STAR[f.values.level];
        f.plot.clear([0.1, 0.7], [0, 41], { xTicks: 6, xLabel: "true p = 0.4 (orange line)" });
        f.plot.segment(p, 0, p, 41, c.b, 2);
        for (let i = 1; i <= 40; i++) {
          let x = 0;
          for (let j = 0; j < n; j++) x += rng.next() < p ? 1 : 0;
          const ph = x / n;
          const me = z * Math.sqrt((ph * (1 - ph)) / n);
          const hit = ph - me <= p && p <= ph + me;
          total++;
          hits += hit ? 1 : 0;
          f.plot.segment(ph - me, i, ph + me, i, hit ? c.a : c.bad, 2);
        }
        f.readout.textContent = `${hits} of ${total} intervals so far contain the true p (${Math.round((100 * hits) / total)}%). Red intervals missed. The method is right ${f.values.level}% of the time in the long run; any single interval either contains p or not.`;
      };
      f.onChange(draw);
      draw();
    },
  },

  "null-sim": {
    title: "A p-value by simulation",
    mount(root, rng) {
      const f = frame(
        root,
        [
          { type: "range", id: "n", label: "Flips n", min: 10, max: 100, value: 50 },
          { type: "range", id: "k", label: "Observed heads", min: 0, max: 100, value: 33 },
          { type: "button", id: "go", label: "Simulate 2000 fair coins" },
        ],
        250,
      );
      const draw = () => {
        const c = colors();
        const n = f.values.n;
        const k = Math.min(f.values.k, n);
        const counts = new Array(n + 1).fill(0);
        let extreme = 0;
        for (let i = 0; i < 2000; i++) {
          let h = 0;
          for (let j = 0; j < n; j++) h += rng.next() < 0.5 ? 1 : 0;
          counts[h]++;
          if (Math.abs(h - n / 2) >= Math.abs(k - n / 2)) extreme++;
        }
        const top = Math.max(...counts);
        f.plot.clear([-0.5, n + 0.5], [0, top * 1.1], { integerStep: Math.max(1, Math.ceil(n / 10)), xLabel: "heads in n flips of a FAIR coin" });
        counts.forEach((cnt, h) => {
          const isExtreme = Math.abs(h - n / 2) >= Math.abs(k - n / 2);
          f.plot.bars([cnt], h - 0.5, 1, isExtreme ? c.bad : c.a);
        });
        f.plot.vline(k, c.b, "observed");
        f.readout.textContent = `If the coin were fair, ${extreme} of 2000 simulated experiments (${(extreme / 2000).toFixed(3)}) were at least as far from ${n / 2} as ${k}. That share is the (two-sided) p-value.`;
      };
      f.onChange(draw);
      draw();
    },
  },

  regression: {
    title: "Least squares and outliers",
    mount(root, rng) {
      let seed = rng.int(1, 1e9);
      const f = frame(
        root,
        [
          { type: "range", id: "rho", label: "Strength", min: -0.95, max: 0.95, step: 0.05, value: 0.7 },
          { type: "checkbox", id: "outlier", label: "Add an outlier at x = 9.5", value: false },
          { type: "button", id: "go", label: "New data" },
        ],
        260,
      );
      const draw = (id) => {
        if (id === "go") seed = rng.int(1, 1e9);
        const c = colors();
        const local = makeRng(seed); // same points while you move the sliders
        const normal = () => local.normal();
        const rho = f.values.rho;
        const xs = [];
        const ys = [];
        for (let i = 0; i < 30; i++) {
          const zx = normal();
          const zy = rho * zx + Math.sqrt(1 - rho * rho) * normal();
          xs.push(5 + 1.5 * zx);
          ys.push(50 + 10 * zy);
        }
        if (f.values.outlier) {
          xs.push(9.5);
          ys.push(rho >= 0 ? 15 : 85);
        }
        const r = correlation(xs, ys);
        const { b0, b1 } = linearFit(xs, ys);
        f.plot.clear([0, 10], [0, 100], { xTicks: 5, yTicks: 4 });
        f.plot.dots(xs.slice(0, 30).map((x, i) => [x, ys[i]]), c.text, 3.5);
        if (f.values.outlier) f.plot.dots([[9.5, ys[30]]], c.bad, 5);
        f.plot.curve((x) => b0 + b1 * x, c.a, 0, 10);
        f.readout.textContent = `r = ${f2(r)}, R² = ${f2(r * r)}, fitted line ŷ = ${f2(b0)} + ${f2(b1)}x. ${f.values.outlier ? "One high-leverage point (red) pulls the line and changes r." : "Tick the box to see one point's influence."}`;
      };
      f.onChange(draw);
      draw();
    },
  },
};

export const SIM_IDS = new Set(Object.keys(SIMS));

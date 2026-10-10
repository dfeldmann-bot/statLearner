// Simulations for Part B (MacKay's ITILA). Same "predict, then observe" contract as sims.js.

import { entropy, betaPdf, binomPmf, choose, normalPdf, histogram, bayesFactorCoin, responsibilities, updateMeans, clusterObjective, mixtureLogLik } from "./stats.js";
import { colors, frame, f2 } from "./simkit.js";

const f3 = (x) => Number(x).toFixed(3);
// Compact number for readouts: 0.000123 -> "1.23e-4", 26817356775 -> "2.68e+10".
const num = (x) => (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e4) ? x.toExponential(2) : Number(x.toPrecision(3)).toString());

const argmax = (row) => row.reduce((best, v, k) => (v > row[best] ? k : best), 0);
const BETAS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20]; // stiffness choices for the K-means sim
// "#4f46e5" or "#abc" -> [r, g, b]; null for anything else (then points get their top cluster's colour).
function toRgb(color) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((ch) => ch + ch).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

// Central 95% interval of a Beta(a, b) by numeric integration on a grid.
function betaInterval(a, b, mass = 0.95) {
  const n = 2000;
  const dens = Array.from({ length: n }, (_, i) => betaPdf((i + 0.5) / n, a, b));
  const total = dens.reduce((s, d) => s + d, 0);
  let acc = 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < n; i++) {
    const prev = acc;
    acc += dens[i] / total;
    if (prev < (1 - mass) / 2 && acc >= (1 - mass) / 2) lo = (i + 0.5) / n;
    if (prev < 1 - (1 - mass) / 2 && acc >= 1 - (1 - mass) / 2) hi = (i + 0.5) / n;
  }
  return [lo, hi];
}

export const SIMS_BOOK = {
  "entropy-explorer": {
    title: "Surprise and entropy of a bent coin",
    mount(root) {
      const f = frame(root, [{ type: "range", id: "p", label: "P(heads)", min: 0.01, max: 0.99, step: 0.01, value: 0.1 }], 230);
      const draw = () => {
        const c = colors();
        const p = f.values.p;
        const H = (q) => entropy([q, 1 - q]);
        f.plot.clear([0, 1], [0, 1.1], { xTicks: 10, yTicks: 2, xLabel: "P(heads)" });
        f.plot.curve(H, c.a, 0.001, 0.999);
        f.plot.dots([[p, H(p)]], c.b, 6);
        f.plot.vline(p, c.b);
        f.readout.textContent = `h(heads) = log₂(1/${f2(p)}) = ${f2(Math.log2(1 / p))} bits, h(tails) = ${f2(Math.log2(1 / (1 - p)))} bits. Average surprise H₂(p) = ${f3(H(p))} bits (maximum 1 bit at p = 0.5).`;
      };
      f.onChange(draw);
      draw();
    },
  },

  "bent-coin": {
    title: "Learning a bent coin's bias, one toss at a time",
    mount(root, rng) {
      let h = 0;
      let t = 0;
      const f = frame(
        root,
        [
          { type: "range", id: "truth", label: "True P(heads)", min: 0.05, max: 0.95, step: 0.05, value: 0.7 },
          { type: "checkbox", id: "reveal", label: "Show the true value", value: false },
          { type: "button", id: "one", label: "Toss once" },
          { type: "button", id: "ten", label: "Toss 10" },
          { type: "button", id: "reset", label: "Reset" },
        ],
        240,
      );
      const draw = (id) => {
        if (id === "reset" || id === "truth") h = t = 0;
        if (id === "one" || id === "ten") {
          for (let i = 0; i < (id === "one" ? 1 : 10); i++) rng.next() < f.values.truth ? h++ : t++;
        }
        const c = colors();
        const n = h + t;
        const pdf = (x) => betaPdf(x, h + 1, t + 1);
        let top = 1.2;
        for (let i = 1; i < 200; i++) top = Math.max(top, pdf(i / 200) * 1.1);
        f.plot.clear([0, 1], [0, top], { xTicks: 10, xLabel: "bias p" });
        f.plot.fillUnder(pdf, 0.001, 0.999, c.a);
        f.plot.curve(pdf, c.a, 0.001, 0.999);
        const laplace = (h + 1) / (n + 2);
        f.plot.vline(laplace, c.b, "posterior mean");
        if (f.values.reveal) f.plot.vline(f.values.truth, c.ok, "truth");
        const [lo, hi] = betaInterval(h + 1, t + 1);
        f.readout.textContent = n
          ? `${h} heads, ${t} tails. Maximum likelihood h/n = ${f3(h / n)}; posterior mean (h+1)/(n+2) = ${f3(laplace)}; 95% of the posterior lies in [${f2(lo)}, ${f2(hi)}].`
          : "No data yet: the uniform prior says every bias is equally plausible. Toss the coin.";
      };
      f.onChange(draw);
      draw();
    },
  },

  occam: {
    title: "Occam's razor: what each model predicts",
    mount(root) {
      const f = frame(root, [
        { type: "range", id: "n", label: "Tosses n", min: 2, max: 40, value: 10 },
        { type: "range", id: "h", label: "Observed heads", min: 0, max: 40, value: 7 },
      ]);
      const draw = () => {
        const c = colors();
        const n = f.values.n;
        const h = Math.min(f.values.h, n);
        const fair = Array.from({ length: n + 1 }, (_, k) => binomPmf(k, n, 0.5));
        const flat = 1 / (n + 1);
        const top = Math.max(...fair, flat) * 1.15;
        f.plot.clear([-0.5, n + 0.5], [0, top], { integerStep: Math.max(1, Math.ceil(n / 10)), yTicks: 2, xLabel: "number of heads" });
        f.plot.bars(fair, -0.5, 1, c.a, 0.55);
        f.plot.segment(-0.5, flat, n + 0.5, flat, c.b, 3);
        f.plot.vline(h, c.text, "observed");
        const B = bayesFactorCoin(n, h);
        f.readout.textContent = `Blue bars: fair coin H₀. Orange line: bent coin H₁ with uniform prior, which spreads its predictions evenly (1/${n + 1} each). At ${h} heads: P(h|H₁)/P(h|H₀) = ${num(flat)}/${num(fair[h])} = Bayes factor ${num(B)}, so the data favour ${B > 1 ? "H₁" : "H₀"}.`;
      };
      f.onChange(draw);
      draw();
    },
  },

  likelihood: {
    title: "Likelihood, its peak and Laplace's Gaussian",
    mount(root) {
      const f = frame(root, [
        { type: "range", id: "h", label: "Heads", min: 0, max: 60, value: 3 },
        { type: "range", id: "t", label: "Tails", min: 0, max: 60, value: 1 },
      ]);
      const draw = () => {
        const c = colors();
        const { h, t } = f.values;
        const n = h + t;
        const post = (x) => betaPdf(x, h + 1, t + 1);
        let top = 1.2;
        for (let i = 1; i < 300; i++) top = Math.max(top, post(i / 300) * 1.1);
        f.plot.clear([0, 1], [0, top], { xTicks: 10, xLabel: "bias p" });
        f.plot.curve(post, c.a, 0.001, 0.999);
        if (n > 0 && h > 0 && t > 0) {
          const ph = h / n;
          const s = Math.sqrt((ph * (1 - ph)) / n);
          f.plot.curve((x) => normalPdf(x, ph, s), c.b, 0.001, 0.999, 1.5);
          f.plot.vline(ph, c.text, "ML");
          f.readout.textContent = `Blue: exact normalised likelihood (posterior with flat prior). Orange: Laplace's Gaussian at the peak p̂ = ${f3(ph)} with error bar σ = √(p̂(1−p̂)/n) = ${f3(s)}. Increase the counts: the approximation becomes excellent.`;
        } else {
          f.readout.textContent = n
            ? `With ${h === 0 ? "no heads" : "no tails"} the likelihood peaks at the edge p = ${h === 0 ? 0 : 1}: maximum likelihood claims certainty, and the Gaussian approximation breaks down.`
            : "Add some heads and tails.";
        }
      };
      f.onChange(draw);
      draw();
    },
  },

  metropolis: {
    title: "The Metropolis method on a two-humped target",
    mount(root, rng) {
      const target = (x) => 0.5 * normalPdf(x, -2, 0.6) + 0.5 * normalPdf(x, 2, 0.6);
      let samples = [];
      let x = -2;
      let accepted = 0;
      let proposed = 0;
      const f = frame(
        root,
        [
          { type: "range", id: "eps", label: "Step size ε", min: 0.05, max: 6, step: 0.05, value: 0.3 },
          { type: "button", id: "run", label: "Run 2000 steps" },
          { type: "button", id: "reset", label: "Reset" },
        ],
        240,
      );
      const draw = (id) => {
        if (id === "reset" || id === "eps") {
          samples = [];
          x = -2;
          accepted = proposed = 0;
        }
        if (id === "run") {
          for (let i = 0; i < 2000; i++) {
            const y = x + f.values.eps * rng.normal();
            proposed++;
            if (rng.next() < Math.min(1, target(y) / target(x))) {
              x = y;
              accepted++;
            }
            samples.push(x);
          }
        }
        const c = colors();
        const { counts, width } = histogram(samples, 60, -5, 5);
        const dens = counts.map((k) => (samples.length ? k / (samples.length * width) : 0));
        f.plot.clear([-5, 5], [0, Math.max(0.42, ...dens) * 1.1], { xTicks: 10, xLabel: "x" });
        f.plot.bars(dens, -5, width, c.a, 0.6);
        f.plot.curve(target, c.b);
        const right = samples.filter((s) => s > 0).length;
        f.readout.textContent = samples.length
          ? `${samples.length} samples, acceptance rate ${Math.round((100 * accepted) / proposed)}%, share in the right hump ${Math.round((100 * right) / samples.length)}% (truth 50%). Tiny steps are accepted but crawl; huge steps are mostly rejected.`
          : "The chain starts in the left hump. Predict: with ε = 0.3, will 2000 steps find the right hump? Then try ε = 2 and ε = 6.";
      };
      f.onChange(draw);
      draw();
    },
  },

  "mc-pi": {
    title: "Monte Carlo: estimate π with random points",
    mount(root, rng) {
      let pts = [];
      let inside = 0;
      const f = frame(root, [
        { type: "button", id: "a", label: "+100 points" },
        { type: "button", id: "b", label: "+1,000" },
        { type: "button", id: "c", label: "+10,000" },
        { type: "button", id: "reset", label: "Reset" },
      ], 280);
      const draw = (id) => {
        if (id === "reset") {
          pts = [];
          inside = 0;
        }
        const k = { a: 100, b: 1000, c: 10000 }[id] ?? 0;
        for (let i = 0; i < k; i++) {
          const p = [rng.next(), rng.next()];
          const hit = p[0] ** 2 + p[1] ** 2 <= 1;
          inside += hit ? 1 : 0;
          pts.push([p[0], p[1], hit]);
        }
        const c = colors();
        f.plot.clear([0, 1], [0, 1], { xTicks: 4, yTicks: 4 });
        f.plot.curve((x) => Math.sqrt(Math.max(0, 1 - x * x)), c.text, 0, 1, 1.5);
        const shown = pts.slice(-4000);
        f.plot.dots(shown.filter((p) => p[2]), c.a, 1.6);
        f.plot.dots(shown.filter((p) => !p[2]), c.b, 1.6);
        const R = pts.length;
        if (!R) return (f.readout.textContent = "Predict: how many points do you need for 2 correct decimals of π? Then add points.");
        const est = (4 * inside) / R;
        const se = 4 * Math.sqrt(((Math.PI / 4) * (1 - Math.PI / 4)) / R);
        f.readout.textContent = `R = ${R.toLocaleString()} points, estimate 4 × ${inside}/${R} = ${est.toFixed(4)} (error ${Math.abs(est - Math.PI).toFixed(4)}). Theory: standard error = ${se.toFixed(4)}, shrinking like 1/√R.`;
      };
      f.onChange(draw);
      draw();
    },
  },

  "stopping-rule": {
    title: "Same data, different p-values: the stopping rule",
    mount(root) {
      const f = frame(root, [
        {
          type: "select",
          id: "design",
          label: "Experimenter's plan",
          value: "binom",
          options: [
            ["binom", "Toss exactly 12 times"],
            ["negbin", "Toss until the 3rd tail"],
          ],
        },
      ]);
      const binom = Array.from({ length: 13 }, (_, h) => choose(12, h) / 4096);
      const negbin = Array.from({ length: 21 }, (_, h) => choose(h + 2, 2) / 2 ** (h + 3));
      const pBinom = binom.slice(9).reduce((a, b) => a + b, 0);
      const pNeg = 1 - negbin.slice(0, 9).reduce((a, b) => a + b, 0);
      const draw = () => {
        const c = colors();
        const dist = f.values.design === "binom" ? binom : negbin;
        const top = Math.max(...dist) * 1.15;
        f.plot.clear([-0.5, dist.length - 0.5], [0, top], { integerStep: 2, xLabel: "number of heads, if the coin is fair" });
        dist.forEach((p, h) => f.plot.bars([p], h - 0.5, 1, h >= 9 ? c.bad : c.a));
        f.plot.vline(9, c.text, "observed: 9 heads");
        f.readout.textContent = `Observed: 9 heads and 3 tails. One-sided p-value if the plan was 12 tosses: ${f3(pBinom)}; if the plan was "stop at the 3rd tail": ${f3(pNeg)}. Only the second is below 0.05. The likelihood, p⁹(1−p)³, is the same in both cases, so a Bayesian reaches the same conclusion either way.`;
      };
      f.onChange(draw);
      draw();
    },
  },

  // K-means and soft K-means (ITILA ch. 20, 22), with MacKay's distance d = ½·(squared distance).
  kmeans: {
    title: "K-means and soft K-means on three blobs",
    mount(root, rng) {
      const H = 320;
      const f = frame(
        root,
        [
          { type: "range", id: "K", label: "Clusters K", min: 1, max: 6, value: 3 },
          { type: "button", id: "assign", label: "Assign" },
          { type: "button", id: "update", label: "Update" },
          { type: "button", id: "run", label: "Run to the end" },
          { type: "button", id: "start", label: "New start" },
          { type: "button", id: "unlucky", label: "Unlucky start" },
          { type: "button", id: "data", label: "New data" },
          { type: "checkbox", id: "soft", label: "Soft", value: false },
          { type: "range", id: "b", label: "Stiffness β", min: 0, max: BETAS.length - 1, value: BETAS.indexOf(0.5), format: (i) => String(BETAS[i]) },
        ],
        H,
      );
      // Same scale on both axes, so the nearest mean also looks nearest.
      const W = f.plot.ctx.canvas.width / (window.devicePixelRatio || 1);
      const yMax = 10;
      const xMax = (yMax * (W - 52)) / (H - 40);
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
      let pts = [];
      let centres = [];
      let blobs = []; // indices of the points in each blob
      let means = [];
      let trail = [];
      let r = null; // responsibilities r[n][k] for the current means, or null before the first Assign
      let rounds = 0;
      let converged = false;
      let best = {}; // lowest converged hard-K-means J for each K on these data
      let msg = "";
      const K = () => f.values.K;
      const soft = () => f.values.soft;
      const beta = () => BETAS[f.values.b];

      // Three Gaussian blobs (sd 0.7) of different sizes: two fairly close (centres at least 3.4 apart),
      // the third at least 1.8 times as far. That layout guarantees K = 3 has a bad local optimum.
      const makeData = () => {
        let score = -1;
        for (let t = 0; t < 5000 && score < 1; t++) {
          const c = [0, 1, 2].map(() => [1.4 + rng.next() * (xMax - 2.8), 1.4 + rng.next() * (yMax - 2.8)]);
          const ds = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => Math.hypot(c[i][0] - c[j][0], c[i][1] - c[j][1])).sort((p, q) => p - q);
          const s = Math.min(ds[0] / 3.4, ds[1] / (1.8 * ds[0]));
          if (s > score) [centres, score] = [c, s];
        }
        pts = [];
        blobs = centres.map((c, i) =>
          Array.from({ length: [44, 24, 16][i] }, () => pts.push([clamp(c[0] + 0.7 * rng.normal(), 0.1, xMax - 0.1), clamp(c[1] + 0.7 * rng.normal(), 0.1, yMax - 0.1)]) - 1),
        );
        best = {};
      };
      // A start puts the K means on K different data points.
      const startAt = (indices) => {
        means = indices.map((n) => pts[n].slice());
        trail = means.map((m) => [m.slice()]);
        r = null;
        rounds = 0;
        converged = false;
      };
      const newStart = () => startAt(rng.shuffle(pts.map((_, n) => n)).slice(0, K()));
      // Unlucky: K − 1 means inside the far blob, one mean in one of the two close blobs. For K = 3
      // this almost always ends with the far blob split in two and the close pair merged.
      const unluckyStart = () => {
        const dist = (i, j) => Math.hypot(centres[i][0] - centres[j][0], centres[i][1] - centres[j][1]);
        const [b, , a] = [[0, 1, 2], [0, 2, 1], [1, 2, 0]].reduce((p, q) => (dist(q[0], q[1]) < dist(p[0], p[1]) ? q : p));
        const inA = rng.shuffle(blobs[a]).slice(0, Math.max(1, K() - 1));
        startAt(K() === 1 ? inA : [...inA, rng.pick(blobs[b])]);
      };
      const shiftOf = (next) => Math.max(...next.map((m, k) => Math.hypot(m[0] - means[k][0], m[1] - means[k][1])));
      const assign = () => {
        const old = r;
        r = responsibilities(pts, means, soft() ? beta() : Infinity);
        // Converged when an update would no longer move any mean.
        converged = shiftOf(updateMeans(pts, r, means)) < (soft() ? 1e-4 : 1e-9);
        if (converged && !soft()) best[K()] = Math.min(best[K()] ?? Infinity, clusterObjective(pts, means, r));
        return old ? r.filter((row, n) => argmax(row) !== argmax(old[n])).length : pts.length;
      };
      const update = () => {
        const next = updateMeans(pts, r, means);
        const moved = shiftOf(next) > 1e-12;
        means = next;
        if (moved) {
          means.forEach((m, k) => trail[k].push(m.slice()));
          rounds++;
        }
        return moved;
      };

      const act = (id) => {
        if (id === "data") {
          makeData();
          newStart();
          msg = `New data, and ${K()} means (rings) on randomly chosen points. Press Assign, then Update, and repeat.`;
        } else if (id === "start" || id === "K") {
          newStart();
          msg = `New start: ${K()} mean${K() === 1 ? "" : "s"} (rings) on randomly chosen points. Press Assign, then Update, and repeat.`;
        } else if (id === "unlucky") {
          unluckyStart();
          msg =
            K() === 1
              ? "With K = 1 there is nothing to be unlucky about: every start ends at the overall mean."
              : `Unlucky start: ${K() - 1} mean${K() > 2 ? "s" : ""} inside one blob, 1 in another. Run it, then compare J with ordinary starts.`;
        } else if (id === "assign") {
          const changed = assign();
          msg = soft() ? "Assignment step: responsibilities recomputed; colours mix in proportion to them." : `Assignment step: ${changed} point${changed === 1 ? "" : "s"} changed cluster.`;
        } else if (id === "update") {
          if (!r) msg = "Press Assign first: the update step needs the clusters.";
          else if (update()) msg = `Update step: each mean moved to the ${soft() ? "responsibility-weighted " : ""}average of its points.`;
          else msg = "The means already sit at the averages of their clusters. Press Assign.";
        } else if (id === "run") {
          if (!r) assign();
          let it = 0;
          while (!converged && it < 2000) {
            update();
            assign();
            it++;
          }
          msg = converged ? "Ran to the end." : "Stopped after 2,000 rounds: the means are still creeping.";
        } else if (id === "soft" || id === "b") {
          if (id === "b" && !soft()) msg = "β only matters for soft K-means: tick Soft.";
          else {
            if (r) assign();
            msg = soft() ? `Soft K-means with β = ${num(beta())}.${r ? " Responsibilities recomputed." : ""}` : `Hard K-means again.${r ? " Each point belongs to its nearest mean." : ""}`;
          }
        }
        draw();
      };

      const draw = () => {
        const c = colors();
        const pal = [c.a, c.b, c.ok, "#ec4899", "#06b6d4", c.bad];
        const rgb = pal.map(toRgb);
        const { ctx, X, Y } = f.plot;
        f.plot.clear([0, xMax], [0, yMax], { integerStep: 5, yTicks: 2 });
        pts.forEach((p, n) => {
          let col = c.muted;
          if (r) {
            col = pal[argmax(r[n])];
            if (rgb.every(Boolean)) col = `rgb(${[0, 1, 2].map((i) => Math.round(r[n].reduce((s, rk, k) => s + rk * rgb[k][i], 0))).join(",")})`;
          }
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(X(p[0]), Y(p[1]), 3.6, 0, 2 * Math.PI);
          ctx.fill();
        });
        means.forEach((m, k) => {
          for (let i = 1; i < trail[k].length; i++) f.plot.segment(trail[k][i - 1][0], trail[k][i - 1][1], trail[k][i][0], trail[k][i][1], pal[k], 1.5);
          if (soft()) {
            // Dashed circle of radius σ = 1/√β: the length scale of each soft cluster.
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = pal[k];
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(X(m[0]), Y(m[1]), X(1 / Math.sqrt(beta())) - X(0), 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
          }
          // A hollow ring, so a point under the mean stays visible.
          for (const [color, width] of [[c.text, 5], [pal[k], 2.5]]) {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.arc(X(m[0]), Y(m[1]), 8, 0, 2 * Math.PI);
            ctx.stroke();
          }
        });

        const out = [msg];
        if (r && !soft()) {
          const J = clusterObjective(pts, means, r);
          out.push(`Objective J = ${J.toFixed(1)} (½ × squared distance from each point to its own mean, summed).`);
          if (converged) {
            const b = best[K()];
            out.push(`Converged after ${rounds} round${rounds === 1 ? "" : "s"}: no point will change cluster again.`);
            if (J > b * 1.02) out.push(`Stuck in a local optimum: an earlier start reached J = ${b.toFixed(1)}.`);
            if (means.some((_, k) => !r.some((row) => row[k] === 1))) out.push("A mean with no points stays where it is.");
            const list = Object.keys(best)
              .sort((a, b2) => a - b2)
              .map((k) => `K = ${k}: ${best[k].toFixed(1)}`)
              .join(" · ");
            out.push(`Lowest J found so far: ${list}.`);
          }
        } else if (r) {
          const shared = r.filter((row) => Math.max(...row) < 0.9).length;
          out.push(`Length scale σ = 1/√β = ${num(1 / Math.sqrt(beta()))} (dashed circles). ${shared} of ${pts.length} points are shared: no cluster takes 90% of them. Mixture log-likelihood ${mixtureLogLik(pts, means, beta()).toFixed(1)}; an update never lowers it.`);
          if (converged) out.push(`The means have stopped moving (${rounds} round${rounds === 1 ? "" : "s"}).`);
        }
        f.readout.textContent = out.join(" ");
      };

      makeData();
      newStart();
      msg = `The ${K()} means (rings) start on randomly chosen data points. Press Assign, then Update, and repeat, or Run to the end.`;
      f.onChange(act);
      draw();
    },
  },
};

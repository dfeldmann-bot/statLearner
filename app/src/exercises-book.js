// Exercise generators for Part B, aligned with MacKay's "Information Theory,
// Inference, and Learning Algorithms" (ITILA). Same contract as exercises.js.

import { entropy, bayesFactorCoin, choose, mean } from "./stats.js";
import { fmt, sci, pct, numeric, choice, shuffled } from "./exkit.js";

const log2 = Math.log2;

export const BOOK_EXERCISES = {
  // ---------- s08 information content and entropy (ITILA ch. 2, 4) ----------
  "info-content": {
    session: "s08",
    title: "Shannon information content",
    generate(rng) {
      const [p, label, what] = rng.pick([
        [1 / 2, "1/2", "a fair coin lands heads"],
        [1 / 6, "1/6", "a fair die shows a six"],
        [1 / 8, "1/8", "you pick the right one of 8 equally likely doors"],
        [1 / 26, "1/26", "a random letter of the alphabet is Q"],
        [1 / 64, "1/64", "a random chessboard square is the one you chose"],
        [0.9, "0.9", "a reliable bus arrives on time"],
        [1 / 100, "1/100", "a 1-in-100 event happens"],
        [1 / 1000, "1/1000", "your ticket wins a 1-in-1000 raffle"],
      ]);
      const h = log2(1 / p);
      return numeric({
        prompt: `The probability that ${what} is $${label}$. How many bits of information do you receive when it happens? Round to 2 decimals.`,
        answer: h,
        tolerance: 0.01,
        hint: "Information content h(x) = log₂(1/P(x)). Rare outcomes carry more bits.",
        steps: [
          `$h(x) = \\log_2 \\dfrac{1}{P(x)} = \\log_2 \\dfrac{1}{${label}}$.`,
          `$= \\log_2 ${fmt(1 / p, 4)} = \\dfrac{\\ln ${fmt(1 / p, 4)}}{\\ln 2} = ${fmt(h)}$ bits.`,
        ],
      });
    },
  },
  "entropy-calc": {
    session: "s08",
    title: "Entropy of a distribution",
    generate(rng) {
      const [labels, ps] = rng.pick([
        [["sunny", "cloudy", "rainy"], [1 / 2, 1 / 4, 1 / 4]],
        [["sunny", "cloudy", "rainy", "snowy"], [1 / 2, 1 / 4, 1 / 8, 1 / 8]],
        [["A", "B", "C", "D"], [1 / 4, 1 / 4, 1 / 4, 1 / 4]],
        [["red", "green", "blue"], [0.5, 0.3, 0.2]],
        [["win", "draw", "loss"], [0.7, 0.2, 0.1]],
        [["tea", "coffee", "water"], [0.6, 0.2, 0.2]],
        [["rock", "paper", "scissors"], [1 / 3, 1 / 3, 1 / 3]],
      ]);
      const H = entropy(ps);
      const unit = ps.every((p) => Math.abs(1 / p - Math.round(1 / p)) < 1e-9 && 1 / p <= 8);
      const show = (p) => (unit ? `1/${Math.round(1 / p)}` : fmt(p, 3));
      const table = `| outcome | ${labels.join(" | ")} |\n|---|${labels.map(() => "---").join("|")}|\n| probability | ${ps.map(show).join(" | ")} |`;
      return numeric({
        prompt: `${table}\n\nWhat is the entropy $H(X)$ of this distribution, in bits? Round to 2 decimals.`,
        answer: H,
        tolerance: 0.01,
        hint: "Entropy is the average information content: H = Σ P(x) log₂(1/P(x)).",
        steps: [
          "$H(X) = \\sum_x P(x) \\log_2 \\dfrac{1}{P(x)}$.",
          `Terms: ${ps.map((p) => `$${fmt(p, 3)} \\times ${fmt(log2(1 / p), 3)}$`).join(" + ")}.`,
          `$H(X) = ${fmt(H, 3)}$ bits (the maximum for ${ps.length} outcomes is $\\log_2 ${ps.length} = ${fmt(log2(ps.length), 3)}$).`,
        ],
      });
    },
  },
  "binary-entropy": {
    session: "s08",
    title: "Binary entropy",
    generate(rng) {
      const p = rng.pick([0.05, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5]);
      const H = entropy([p, 1 - p]);
      return numeric({
        prompt: `A bent coin lands heads with probability $p = ${p}$. What is the entropy of one toss, $H_2(p)$, in bits? Round to 3 decimals.`,
        answer: H,
        tolerance: 0.005,
        hint: "H₂(p) = p log₂(1/p) + (1−p) log₂(1/(1−p)). It is largest (1 bit) at p = 0.5.",
        steps: [
          `$H_2(p) = p \\log_2 \\frac{1}{p} + (1-p) \\log_2 \\frac{1}{1-p}$.`,
          `$= ${p} \\times ${fmt(log2(1 / p), 3)} + ${fmt(1 - p, 2)} \\times ${fmt(log2(1 / (1 - p)), 3)}$.`,
          `$= ${fmt(H, 3)}$ bits${p === 0.5 ? " - the maximum: a fair coin is the least predictable." : " - less than 1 bit, because the toss is partly predictable."}`,
        ],
      });
    },
  },
  "questions-needed": {
    session: "s08",
    title: "How many questions or weighings?",
    generate(rng) {
      const weigh = rng.next() < 0.4;
      if (weigh) {
        const [N, story] = rng.pick([
          [9, "Exactly one of 9 coins is lighter than the others"],
          [24, "Exactly one of 12 balls is either heavier or lighter than the others (so 24 possibilities)"],
          [27, "Exactly one of 27 coins is lighter than the others"],
          [40, "Exactly one of 20 coins is either heavier or lighter (40 possibilities)"],
        ]);
        const k = Math.ceil(Math.log(N) / Math.log(3) - 1e-9);
        return numeric({
          prompt: `${story}. A balance scale has three outcomes: left heavier, right heavier, or balanced. What is the smallest number of weighings that information theory allows?`,
          answer: k,
          tolerance: 0,
          hint: "Each weighing has 3 outcomes, so it can deliver at most log₂3 ≈ 1.585 bits. You need log₂N bits in total.",
          steps: [
            `You must identify one of $N = ${N}$ equally likely possibilities: $\\log_2 ${N} = ${fmt(log2(N), 3)}$ bits.`,
            "One weighing gives at most $\\log_2 3 = 1.585$ bits, and only if its three outcomes are equally likely.",
            `$${fmt(log2(N), 3)} / 1.585 = ${fmt(log2(N) / log2(3), 2)}$, so at least **${k}** weighings (equivalently $3^{${k}} = ${3 ** k} \\ge ${N}$).`,
          ],
        });
      }
      const N = rng.pick([16, 20, 32, 50, 64, 100, 1000]);
      const k = Math.ceil(log2(N) - 1e-9);
      return numeric({
        prompt: `A friend thinks of one of ${N} equally likely numbers. You may ask yes/no questions. What is the smallest number of questions that guarantees you can identify it?`,
        answer: k,
        tolerance: 0,
        hint: "A yes/no answer carries at most 1 bit. How many bits does it take to single out one of N equally likely options?",
        steps: [
          `Identifying one of ${N} options needs $\\log_2 ${N} = ${fmt(log2(N), 3)}$ bits.`,
          "Each answer gives at most 1 bit, achieved when the question splits the remaining options in half.",
          `So you need $\\lceil ${fmt(log2(N), 3)} \\rceil = ${k}$ questions (halving: $2^{${k}} = ${2 ** k} \\ge ${N}$).`,
        ],
      });
    },
  },

  // ---------- s09 Bayesian inference: the bent coin (ITILA ch. 2-3) ----------
  "discrete-bayes": {
    session: "s09",
    title: "Which coin was it? (Bayes with a table)",
    generate(rng) {
      const biases = rng.pick([
        [0.5, 0.75, 1],
        [0.2, 0.5, 0.8],
        [0.5, 0.6, 0.9],
      ]);
      const priors = rng.pick([
        [1 / 3, 1 / 3, 1 / 3],
        [0.5, 0.25, 0.25],
        [0.6, 0.3, 0.1],
      ]);
      const seqs = biases.includes(1) ? ["HH", "HHH", "HHT", "HTH"] : ["HH", "HHT", "HTT", "HHHT"];
      const seq = rng.pick(seqs);
      const h = [...seq].filter((c) => c === "H").length;
      const t = seq.length - h;
      const lik = biases.map((p) => p ** h * (1 - p) ** t);
      const prod = lik.map((l, i) => l * priors[i]);
      const Z = prod.reduce((a, b) => a + b, 0);
      const j = rng.int(0, 2);
      const post = prod[j] / Z;
      const names = ["A", "B", "C"];
      const showP = (p) => (Math.abs(p - 1 / 3) < 1e-9 ? "1/3" : fmt(p, 2));
      return numeric({
        prompt: `A bag holds three coins with heads-probabilities A: ${biases[0]}, B: ${biases[1]}, C: ${biases[2]}. You draw one with prior probabilities ${priors.map((p, i) => `${names[i]}: ${showP(p)}`).join(", ")}, toss it and see **${seq}**. What is the posterior probability that you drew coin **${names[j]}**? Round to 3 decimals.`,
        answer: post,
        tolerance: 0.005,
        hint: "Posterior ∝ prior × likelihood. Compute prior × P(data | coin) for each coin, then divide by the total.",
        steps: [
          `Likelihood of ${seq} (${h} heads, ${t} tails) for each coin: $p^{${h}}(1-p)^{${t}}$ = ${lik.map((l, i) => `${names[i]}: ${fmt(l, 4)}`).join(", ")}.`,
          `Prior × likelihood: ${prod.map((x, i) => `${names[i]}: ${fmt(x, 4)}`).join(", ")}; total $P(D) = ${fmt(Z, 4)}$.`,
          `$P(${names[j]} \\mid D) = ${fmt(prod[j], 4)} / ${fmt(Z, 4)} = ${fmt(post, 3)}$.`,
        ],
      });
    },
  },
  "laplace-rule": {
    session: "s09",
    title: "Laplace's rule of succession",
    generate(rng) {
      const h = rng.int(0, 8);
      const t = rng.int(h === 0 ? 1 : 0, 8);
      const n = h + t;
      const ans = (h + 1) / (n + 2);
      return numeric({
        prompt: `A bent coin with unknown bias (uniform prior on $p$) gave ${h} heads and ${t} tails. What is the probability that the next toss is heads? Round to 3 decimals.`,
        answer: ans,
        tolerance: 0.002,
        hint: "With a uniform prior the posterior is Beta(h+1, t+1); predict with its mean (h+1)/(n+2).",
        steps: [
          `Posterior: $P(p \\mid D) \\propto p^{${h}}(1-p)^{${t}}$, a Beta(${h + 1}, ${t + 1}) distribution.`,
          `Predictive probability = posterior mean $= \\dfrac{h+1}{n+2} = \\dfrac{${h + 1}}{${n + 2}} = ${fmt(ans, 3)}$.`,
          `Compare maximum likelihood: $h/n = ${fmt(h / n, 3)}$${h === 0 || t === 0 ? " - which would wrongly call the other outcome impossible." : "."}`,
        ],
      });
    },
  },
  "beta-posterior-mean": {
    session: "s09",
    title: "Prior pseudo-counts and the posterior mean",
    generate(rng) {
      const a = rng.pick([1, 2, 5, 10]);
      const b = rng.pick([1, 2, 5, 10]);
      const h = rng.int(0, 12);
      const t = rng.int(0, 12);
      const ans = (a + h) / (a + b + h + t);
      return numeric({
        prompt: `Your prior about a coin's heads-probability is Beta(${a}, ${b}) - like having already seen ${a} heads and ${b} tails. You then observe ${h} heads and ${t} tails. What is the posterior mean of $p$? Round to 3 decimals.`,
        answer: ans,
        tolerance: 0.002,
        hint: "Beta prior + binomial data gives a Beta posterior: add the observed counts to the prior counts.",
        steps: [
          `Posterior: Beta(${a} + ${h}, ${b} + ${t}) = Beta(${a + h}, ${b + t}).`,
          `Mean $= \\dfrac{${a + h}}{${a + h} + ${b + t}} = ${fmt(ans, 3)}$.`,
          `The prior counts ${a + b > h + t ? "outweigh" : "matter less than"} the ${h + t} observed tosses: the more data, the less the prior matters.`,
        ],
      });
    },
  },

  // ---------- s10 model comparison and Occam's razor (ITILA ch. 3, 28) ----------
  "bayes-factor-coin": {
    session: "s10",
    title: "Bayes factor: fair coin or bent coin?",
    generate(rng) {
      const n = rng.pick([6, 8, 10, 12, 20]);
      const h = rng.int(Math.ceil(n / 2), n);
      const t = n - h;
      const B = bayesFactorCoin(n, h);
      const p0 = 0.5 ** n;
      const p1 = p0 * B;
      return numeric({
        prompt: `$H_0$: the coin is fair. $H_1$: its bias $p$ is unknown, with a uniform prior. In ${n} tosses you see ${h} heads and ${t} tails. Compute the Bayes factor $B = P(D \\mid H_1)/P(D \\mid H_0)$. Round to 2 decimals.`,
        answer: B,
        tolerance: Math.max(0.01, B * 0.02),
        hint: "P(D | H0) = (1/2)^n. With a uniform prior, P(D | H1) = h! t! / (n+1)! for one particular sequence.",
        steps: [
          `$P(D \\mid H_0) = (1/2)^{${n}} = ${sci(p0)}$.`,
          `$P(D \\mid H_1) = \\int_0^1 p^{${h}}(1-p)^{${t}}\\,dp = \\dfrac{${h}!\\,${t}!}{${n + 1}!} = ${sci(p1)}$.`,
          `$B = ${sci(p1)} / ${sci(p0)} = ${fmt(B, 2)}$: ${B > 1 ? "the data favour the bent-coin model" : "the data favour the fair coin, even though heads came up more often"}.`,
        ],
      });
    },
  },
  "posterior-from-bf": {
    session: "s10",
    title: "From Bayes factor to posterior probability",
    generate(rng) {
      const prior = rng.pick([0.5, 0.2, 0.1, 0.8]);
      const B = rng.pick([0.25, 0.5, 2, 4, 10, 20]);
      const priorOdds = prior / (1 - prior);
      const postOdds = priorOdds * B;
      const post = postOdds / (1 + postOdds);
      return numeric({
        prompt: `Before seeing the data you give model $H_1$ probability ${prior} (and $H_0$ the rest). The data give Bayes factor $B = P(D\\mid H_1)/P(D\\mid H_0) = ${B}$. What is the posterior probability of $H_1$? Round to 3 decimals.`,
        answer: post,
        tolerance: 0.005,
        hint: "Posterior odds = prior odds × Bayes factor. Then convert odds o to probability o/(1+o).",
        steps: [
          `Prior odds: $${prior}/${fmt(1 - prior, 2)} = ${fmt(priorOdds, 3)}$.`,
          `Posterior odds: $${fmt(priorOdds, 3)} \\times ${B} = ${fmt(postOdds, 3)}$.`,
          `Probability: $${fmt(postOdds, 3)}/(1 + ${fmt(postOdds, 3)}) = ${fmt(post, 3)}$.`,
        ],
      });
    },
  },

  // ---------- s11 maximum likelihood and error bars (ITILA ch. 22, 24, 27) ----------
  "likelihood-ratio": {
    session: "s11",
    title: "Compare two parameter values by likelihood",
    generate(rng) {
      const h = rng.int(3, 9);
      const t = rng.int(1, 6);
      const [p1, p2] = rng.shuffle([0.3, 0.5, 0.6, 0.7, 0.8]).slice(0, 2);
      const lr = (p1 / p2) ** h * ((1 - p1) / (1 - p2)) ** t;
      return numeric({
        prompt: `A coin gave ${h} heads and ${t} tails. Compute the likelihood ratio $L(p = ${p1}) / L(p = ${p2})$. Round to 2 decimals.`,
        answer: lr,
        tolerance: Math.max(0.01, lr * 0.02),
        hint: "L(p) = p^h (1−p)^t. Divide the two; the binomial coefficient cancels.",
        steps: [
          `$\\dfrac{L(${p1})}{L(${p2})} = \\left(\\dfrac{${p1}}{${p2}}\\right)^{${h}} \\left(\\dfrac{${fmt(1 - p1, 2)}}{${fmt(1 - p2, 2)}}\\right)^{${t}}$.`,
          `$= ${fmt((p1 / p2) ** h, 4)} \\times ${fmt(((1 - p1) / (1 - p2)) ** t, 4)} = ${fmt(lr, 3)}$.`,
          lr > 1 ? `The data are ${fmt(lr, 2)} times more probable under $p = ${p1}$.` : `The data are ${fmt(1 / lr, 2)} times more probable under $p = ${p2}$.`,
        ],
      });
    },
  },
  "sigma-ml": {
    session: "s11",
    title: "Maximum-likelihood σ of a Gaussian",
    generate(rng) {
      const N = rng.int(4, 5);
      const base = rng.int(8, 14);
      const xs = Array.from({ length: N }, () => base + rng.int(-3, 3));
      const m = mean(xs);
      const ss = xs.reduce((acc, x) => acc + (x - m) ** 2, 0);
      const sN = Math.sqrt(ss / N);
      return numeric({
        prompt: `Data from a Gaussian: **${xs.join(", ")}**. What is the maximum-likelihood estimate $\\sigma_N$ of its standard deviation (divide by $N$)? Round to 2 decimals.`,
        answer: sN,
        tolerance: Math.max(0.02, sN * 0.01),
        hint: "μ_ML is the sample mean; σ_N² is the average squared deviation, dividing by N (not N − 1).",
        steps: [
          `$\\mu_{ML} = \\bar x = ${fmt(m, 3)}$.`,
          `Sum of squared deviations $= ${fmt(ss, 3)}$.`,
          `$\\sigma_N = \\sqrt{${fmt(ss, 3)}/${N}} = ${fmt(sN)}$; for comparison $\\sigma_{N-1} = \\sqrt{${fmt(ss, 3)}/${N - 1}} = ${fmt(Math.sqrt(ss / (N - 1)))}$.`,
        ],
      });
    },
  },
  "laplace-error-bar": {
    session: "s11",
    title: "Error bar from the curvature (Laplace's method)",
    generate(rng) {
      const n = rng.pick([20, 50, 100, 200]);
      const h = rng.int(Math.round(n * 0.2), Math.round(n * 0.8));
      const p = h / n;
      const sigma = Math.sqrt((p * (1 - p)) / n);
      return numeric({
        prompt: `A bent coin gave ${h} heads in ${n} tosses (uniform prior). Approximate the posterior of $p$ by a Gaussian at its peak (Laplace's method). What is its standard deviation, the error bar on $p$? Round to 3 decimals.`,
        answer: sigma,
        tolerance: 0.002,
        hint: "log P(p|D) = h ln p + t ln(1−p) + const. The error bar is 1/√(−second derivative) at the peak p = h/n, which gives √(p(1−p)/n).",
        steps: [
          `Peak: $\\hat p = h/n = ${fmt(p, 3)}$.`,
          `Curvature: $-\\dfrac{d^2}{dp^2}\\log P = \\dfrac{h}{p^2} + \\dfrac{t}{(1-p)^2} = \\dfrac{n}{\\hat p(1-\\hat p)}$ at the peak.`,
          `$\\sigma = \\sqrt{\\hat p(1-\\hat p)/n} = \\sqrt{${fmt(p, 3)} \\times ${fmt(1 - p, 3)} / ${n}} = ${fmt(sigma, 4)}$.`,
          "This equals the standard error from session 4: Bayesian and sampling-theory error bars agree here.",
        ],
      });
    },
  },

  // ---------- s12 Monte Carlo methods (ITILA ch. 29) ----------
  "mc-error": {
    session: "s12",
    title: "Monte Carlo accuracy",
    generate(rng) {
      const sigma = rng.pick([1, 2, 5, 10]);
      if (rng.next() < 0.5) {
        const R = rng.pick([100, 400, 2500, 10000]);
        const se = sigma / Math.sqrt(R);
        return numeric({
          prompt: `You estimate an expectation by averaging $R = ${R}$ independent samples of $\\phi(x)$, whose standard deviation is $\\sigma_\\phi = ${sigma}$. What is the standard error of the estimate?`,
          answer: se,
          tolerance: Math.max(0.0005, se * 0.01),
          hint: "The Monte Carlo error falls like σ/√R - whatever the dimension of x.",
          steps: [`$SE = \\sigma_\\phi/\\sqrt{R} = ${sigma}/\\sqrt{${R}} = ${sigma}/${Math.sqrt(R)} = ${fmt(se, 4)}$.`],
        });
      }
      const eps = rng.pick([0.1, 0.05, 0.02]);
      const R = Math.round((sigma / eps) ** 2);
      return numeric({
        prompt: `$\\phi(x)$ has standard deviation $\\sigma_\\phi = ${sigma}$. How many independent samples $R$ do you need for a standard error of ${eps}?`,
        answer: R,
        tolerance: 0.5,
        hint: "Solve σ/√R = ε for R.",
        steps: [`$\\sigma/\\sqrt{R} = \\varepsilon \\Rightarrow R = (\\sigma/\\varepsilon)^2 = (${sigma}/${eps})^2 = ${R}$.`, "Ten times more accuracy costs a hundred times more samples."],
      });
    },
  },
  "metropolis-accept": {
    session: "s12",
    title: "Metropolis acceptance probability",
    generate(rng) {
      const px = rng.pick([0.2, 0.3, 0.4, 0.5, 0.8]);
      const py = rng.pick([0.05, 0.1, 0.15, 0.3, 0.6, 0.9]);
      const a = Math.min(1, py / px);
      return numeric({
        prompt: `A Metropolis sampler with a symmetric proposal sits at $x$ with $P^*(x) = ${px}$ (unnormalised). It proposes $x'$ with $P^*(x') = ${py}$. With what probability does it accept the move?`,
        answer: a,
        tolerance: 0.002,
        hint: "Accept with probability min(1, P*(x′)/P*(x)). Uphill moves are always accepted.",
        steps: [`$a = \\min\\left(1, \\dfrac{P^*(x')}{P^*(x)}\\right) = \\min\\left(1, \\dfrac{${py}}{${px}}\\right) = ${fmt(a, 3)}$.`, a < 1 ? "If the move is rejected, the chain stays at $x$ and records $x$ again." : "Uphill (or level) moves are always accepted."],
      });
    },
  },
  "rejection-rate": {
    session: "s12",
    title: "Rejection sampling in many dimensions",
    generate(rng) {
      const [r, N] = rng.pick([
        [1.01, 10],
        [1.01, 100],
        [1.01, 1000],
        [1.02, 100],
        [1.05, 10],
        [1.05, 100],
      ]);
      const c = r ** N;
      return numeric({
        prompt: `You rejection-sample an $N = ${N}$-dimensional Gaussian with standard deviation $\\sigma_P$ using a Gaussian proposal that is just ${fmt((r - 1) * 100, 0)}% wider ($\\sigma_Q = ${r}\\,\\sigma_P$). The smallest valid envelope constant is $c = (\\sigma_Q/\\sigma_P)^N$. On average, how many proposals does it take to get one accepted sample (that is, $c$)?`,
        answer: c,
        tolerance: c * 0.02,
        hint: "With normalised densities the acceptance rate is 1/c, so you need c proposals per accepted sample. Raise the width ratio to the power N.",
        steps: [`$c = ${r}^{${N}} = ${sci(c)}$.`, `Acceptance rate $1/c = ${sci(1 / c)}$: on average ${sci(c)} proposals per accepted sample.`, "A tiny mismatch per dimension compounds exponentially: rejection sampling fails in high dimensions."],
      });
    },
  },
  "importance-estimate": {
    session: "s12",
    title: "Importance-sampling estimate",
    generate(rng) {
      const xs = rng.shuffle([1, 2, 3, 4, 5, 6]).slice(0, 3);
      const ws = xs.map(() => rng.pick([0.5, 1, 1.5, 2, 3]));
      const est = xs.reduce((acc, x, i) => acc + ws[i] * x, 0) / ws.reduce((a, b) => a + b, 0);
      return numeric({
        prompt: `Three samples drawn from a proposal $Q$ are $x = ${xs.join(", ")}$, with importance weights $w = P^*(x)/Q^*(x) = ${ws.join(", ")}$. Estimate $E_P[x]$. Round to 2 decimals.`,
        answer: est,
        tolerance: 0.01,
        hint: "Weighted average: Σ w x / Σ w.",
        steps: [
          `$\\sum w_r x_r = ${xs.map((x, i) => `${ws[i]} \\times ${x}`).join(" + ")} = ${fmt(xs.reduce((acc, x, i) => acc + ws[i] * x, 0), 3)}$.`,
          `$\\sum w_r = ${fmt(ws.reduce((a, b) => a + b, 0), 2)}$.`,
          `Estimate $= ${fmt(est, 3)}$. Samples where $P$ is large relative to $Q$ count more.`,
        ],
      });
    },
  },

  // ---------- s13 Bayesian inference vs sampling theory (ITILA ch. 36-37) ----------
  "binomial-tail": {
    session: "s13",
    title: "A one-sided p-value for a coin",
    generate(rng) {
      const n = rng.pick([8, 10, 12, 15]);
      const k = rng.int(Math.ceil(n / 2) + 1, n - 1);
      let tail = 0;
      for (let j = k; j <= n; j++) tail += choose(n, j);
      const p = tail / 2 ** n;
      return numeric({
        prompt: `You planned exactly ${n} tosses and saw ${k} heads. Under $H_0$: fair coin, what is the one-sided p-value $P(X \\ge ${k})$? Round to 3 decimals.`,
        answer: p,
        tolerance: 0.002,
        hint: "Add the binomial probabilities for k, k+1, …, n heads; each is C(n, j)/2ⁿ.",
        steps: [
          `$P(X \\ge ${k}) = \\sum_{j=${k}}^{${n}} \\binom{${n}}{j} / 2^{${n}}$.`,
          `Counts: ${Array.from({ length: n - k + 1 }, (_, i) => choose(n, k + i)).join(" + ")} $= ${tail}$; $2^{${n}} = ${2 ** n}$.`,
          `$p = ${tail}/${2 ** n} = ${fmt(p, 4)}$.`,
        ],
      });
    },
  },
  "expected-loss": {
    session: "s13",
    title: "Decide by minimising expected loss",
    generate(rng) {
      let q, L1, L2, treat, wait;
      do {
        q = rng.pick([0.05, 0.1, 0.2, 0.3, 0.5]);
        L1 = rng.pick([1, 2, 5]);
        L2 = rng.pick([10, 20, 50]);
        treat = (1 - q) * L1;
        wait = q * L2;
      } while (Math.abs(treat - wait) < 0.05); // no ties
      const best = treat <= wait ? "Treat" : "Don't treat";
      const { options, answer } = shuffled(rng, best, [best === "Treat" ? "Don't treat" : "Treat"]);
      return choice({
        prompt: `A patient has posterior probability ${q} of a disease. Treating a healthy patient costs ${L1} (side effects); leaving a sick patient untreated costs ${L2}; correct decisions cost 0. Which action minimises the expected loss?`,
        options,
        answer,
        hint: "Expected loss of an action = Σ over states of P(state) × loss(action, state).",
        steps: [
          `Treat: $(1-${q}) \\times ${L1} = ${fmt(treat, 2)}$.`,
          `Don't treat: $${q} \\times ${L2} = ${fmt(wait, 2)}$.`,
          `${best} has the smaller expected loss. The posterior alone does not decide; the losses matter too.`,
        ],
      });
    },
  },

  // ---------- s14 clustering: K-means and soft K-means (ITILA ch. 20, 22) ----------
  // Distances follow MacKay's convention d(x, m) = ½(x − m)², half the squared distance.
  "kmeans-update": {
    session: "s14",
    title: "One round of K-means in 1-D",
    generate(rng) {
      let m1, m2, mid, xs, c1, c2;
      do {
        m1 = rng.int(1, 6);
        m2 = m1 + rng.int(4, 8);
        mid = (m1 + m2) / 2;
        const pool = [];
        for (let v = Math.max(0, m1 - 3); v <= m2 + 4; v++) if (v !== mid) pool.push(v);
        xs = rng.shuffle(pool).slice(0, rng.int(5, 7)).sort((a, b) => a - b);
        c1 = xs.filter((x) => x < mid);
        c2 = xs.filter((x) => x > mid);
      } while (c1.length < 2 || c2.length < 2 || !xs.some((x) => x > m1 && x < m2));
      const j = rng.int(1, 2);
      const mine = j === 1 ? c1 : c2;
      const other = j === 1 ? c2 : c1;
      const total = mine.reduce((a, b) => a + b, 0);
      const ans = total / mine.length;
      return numeric({
        prompt: `K-means with $K = 2$ on one-dimensional data: **${xs.join(", ")}**. The current means are $m_1 = ${m1}$ and $m_2 = ${m2}$. Do one assignment step, then one update step. What is the new value of $m_${j}$? Round to 2 decimals.`,
        answer: ans,
        tolerance: 0.01,
        hint: "Assignment: each point joins its nearest mean (in 1-D, check which side of the midpoint between the two means it lies on). Update: average the points in the cluster.",
        steps: [
          `Assignment step: the midpoint between the means is $(${m1} + ${m2})/2 = ${fmt(mid)}$. Points below it are closer to $m_1$, points above it closer to $m_2$. Cluster 1: ${c1.join(", ")}. Cluster 2: ${c2.join(", ")}.`,
          `Update step: $m_${j} = \\dfrac{${mine.join(" + ")}}{${mine.length}} = \\dfrac{${total}}{${mine.length}}$.`,
          `$m_${j} = ${fmt(ans, 3)}$. (The other mean moves to $${fmt(other.reduce((a, b) => a + b, 0) / other.length, 3)}$.) In the next round the points are assigned again, to the moved means.`,
        ],
      });
    },
  },
  "soft-responsibility": {
    session: "s14",
    title: "Soft K-means: the responsibility of a cluster",
    generate(rng) {
      let m1, m2, x, beta, d1, d2, r1;
      do {
        m1 = rng.int(0, 5);
        m2 = m1 + rng.int(2, 6);
        x = m1 + 0.5 * rng.int(1, 2 * (m2 - m1) - 1);
        beta = rng.pick([0.25, 0.5, 1, 2]);
        d1 = 0.5 * (x - m1) ** 2;
        d2 = 0.5 * (x - m2) ** 2;
        r1 = 1 / (1 + Math.exp(-beta * (d2 - d1)));
      } while (d1 === d2 || r1 < 0.02 || r1 > 0.98);
      const dd = d2 - d1;
      const z = -beta * dd;
      return numeric({
        prompt: `Soft K-means with stiffness $\\beta = ${beta}$ and distance $d(x, m) = \\tfrac12 (x - m)^2$. The two cluster means are $m_1 = ${m1}$ and $m_2 = ${m2}$. What is the responsibility $r_1$ of cluster 1 for the point $x = ${x}$? Round to 3 decimals.`,
        answer: r1,
        tolerance: 0.005,
        hint: "r₁ = e^(−βd₁) / (e^(−βd₁) + e^(−βd₂)) with d = ½(x − m)². Dividing top and bottom by e^(−βd₁) leaves 1 / (1 + e^(−β(d₂ − d₁))).",
        steps: [
          `Distances: $d_1 = \\tfrac12(${x} - ${m1})^2 = ${fmt(d1, 3)}$ and $d_2 = \\tfrac12(${x} - ${m2})^2 = ${fmt(d2, 3)}$.`,
          "$r_1 = \\dfrac{e^{-\\beta d_1}}{e^{-\\beta d_1} + e^{-\\beta d_2}} = \\dfrac{1}{1 + e^{-\\beta (d_2 - d_1)}}$ (divide top and bottom by $e^{-\\beta d_1}$).",
          `$\\beta (d_2 - d_1) = ${beta} \\times ${dd < 0 ? `(${fmt(dd, 3)})` : fmt(dd, 3)} = ${fmt(-z, 4)}$, so $r_1 = \\dfrac{1}{1 + e^{${fmt(z, 4)}}} = \\dfrac{1}{1 + ${fmt(Math.exp(z), 4)}} = ${fmt(r1, 3)}$.`,
          r1 > 0.5
            ? `The point is closer to $m_1$, so $r_1 > 0.5$, but cluster 2 still keeps a share $r_2 = 1 - r_1 = ${fmt(1 - r1, 3)}$.`
            : `The point is closer to $m_2$, so $r_1 < 0.5$ and cluster 2 takes the larger share $r_2 = 1 - r_1 = ${fmt(1 - r1, 3)}$.`,
        ],
      });
    },
  },
  "mixture-posterior": {
    session: "s14",
    title: "Which cluster? Bayes' theorem with Gaussian clusters",
    generate(rng) {
      const story = rng.pick([
        { intro: "A forest has two species of beetle.", group: "species", verb: "makes up", items: "beetles", item: "beetle", measure: "body length", unit: "mm", lo: 8, hi: 14 },
        { intro: "A box holds bolts from two machines.", group: "machine", verb: "made", items: "bolts", item: "bolt", measure: "length", unit: "mm", lo: 40, hi: 60 },
        { intro: "A market sells trout from two lakes.", group: "lake", verb: "supplies", items: "trout", item: "trout", measure: "length", unit: "cm", lo: 22, hi: 34 },
      ]);
      const sig = (v) => (v >= 1e-4 ? String(Number(v.toPrecision(4))) : sci(v, 4));
      let s, mA, mB, x, pA, eA, eB, PA, PB, post;
      do {
        s = rng.pick([1, 2]);
        mA = rng.int(story.lo, story.hi);
        mB = mA + s * rng.int(2, 4);
        x = mA + 0.5 * s * rng.int(1, (2 * (mB - mA)) / s - 1);
        pA = rng.pick([0.2, 0.3, 0.4, 0.6, 0.7, 0.8]);
        eA = (x - mA) ** 2 / (2 * s * s);
        eB = (x - mB) ** 2 / (2 * s * s);
        PA = pA * Math.exp(-eA);
        PB = (1 - pA) * Math.exp(-eB);
        post = PA / (PA + PB);
      } while (post < 0.03 || post > 0.97);
      const LA = Math.exp(-eA);
      const LB = Math.exp(-eB);
      const G = story.group;
      const Gcap = G[0].toUpperCase() + G.slice(1);
      return numeric({
        prompt: `${story.intro} ${Gcap} A ${story.verb} ${pct(pA)} of the ${story.items}, with ${story.measure}s that are Gaussian with mean ${mA} ${story.unit}; ${G} B ${story.verb} the other ${pct(1 - pA)}, with mean ${mB} ${story.unit}. Both have standard deviation ${s} ${story.unit}. One ${story.item} measures ${x} ${story.unit}. What is the probability that it comes from ${G} A? Round to 3 decimals.`,
        answer: post,
        tolerance: 0.005,
        hint: "Posterior ∝ prior × likelihood. With equal standard deviations the Gaussian's front factor cancels, so each group's likelihood is proportional to e^(−(x − m)²/(2σ²)).",
        steps: [
          `Likelihoods: both groups have $\\sigma = ${s}$, so the factor $1/(\\sigma\\sqrt{2\\pi})$ cancels and only $e^{-(x - m)^2/(2\\sigma^2)}$ matters. A: $e^{-(${x} - ${mA})^2/${2 * s * s}} = e^{-${fmt(eA, 4)}} = ${sig(LA)}$. B: $e^{-(${x} - ${mB})^2/${2 * s * s}} = e^{-${fmt(eB, 4)}} = ${sig(LB)}$.`,
          `Prior × likelihood: A: $${pA} \\times ${sig(LA)} = ${sig(PA)}$. B: $${fmt(1 - pA, 2)} \\times ${sig(LB)} = ${sig(PB)}$.`,
          `$P(A \\mid x) = \\dfrac{${sig(PA)}}{${sig(PA)} + ${sig(PB)}} = ${fmt(post, 3)}$.`,
          `This is a soft K-means responsibility with prior weights: $r_k \\propto \\pi_k\\, e^{-\\beta d_k}$ with $d_k = \\tfrac12 (x - m_k)^2$ and $\\beta = 1/\\sigma^2 = ${fmt(1 / (s * s), 2)}$.`,
        ],
      });
    },
  },
};

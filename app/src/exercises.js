// Parametric exercise generators: every call draws fresh numbers, so learners
// get unlimited small practice problems with worked solutions - no LLM needed.
//
// generate(rng) returns:
//   { type: "numeric" | "choice", prompt, answer, tolerance?, options?, hint, steps: [md, ...] }
// `steps` is a complete worked solution; the practice view fades it out
// (full example -> partial -> independent), following worked-example research.

import { mean, median, sd, binomPmf, choose, normalCdf, Z_STAR } from "./stats.js";

export const fmt = (x, d = 2) => {
  const v = Number(Number(x).toFixed(d));
  return Object.is(v, -0) ? "0" : String(v);
};
const pct = (p) => `${fmt(p * 100, 1)}%`; // for prose, not inside $math$

const numeric = (o) => ({ type: "numeric", ...o });
const choice = (o) => ({ type: "choice", ...o });

// Shuffle options and track where the correct one lands.
function shuffled(rng, correct, wrong) {
  const options = rng.shuffle([correct, ...wrong]);
  return { options, answer: options.indexOf(correct) };
}

const CONTEXTS_SMALL = [
  ["minutes spent on homework by", "students", "minutes"],
  ["cups of coffee drunk per week by", "colleagues", "cups"],
  ["goals scored per season by", "players", "goals"],
  ["books read last year by", "friends", "books"],
];

export const EXERCISES = {
  // ---------- s01 describing data ----------
  mean: {
    session: "s01",
    title: "Compute a mean",
    generate(rng) {
      const n = rng.int(5, 7);
      const xs = Array.from({ length: n }, () => rng.int(1, 20));
      const [what, who] = rng.pick(CONTEXTS_SMALL);
      const total = xs.reduce((a, b) => a + b, 0);
      const m = mean(xs);
      return numeric({
        prompt: `The ${what} ${n} ${who}: **${xs.join(", ")}**. What is the mean? Round to 2 decimals.`,
        answer: m,
        tolerance: 0.01,
        hint: "Add all values, then divide by how many values there are.",
        steps: [
          `Add the values: $${xs.join(" + ")} = ${total}$.`,
          `Count them: $n = ${n}$.`,
          `Divide: $\\bar x = ${total} / ${n} = ${fmt(m)}$.`,
        ],
      });
    },
  },
  median: {
    session: "s01",
    title: "Find a median",
    generate(rng) {
      const n = rng.int(5, 8);
      const xs = Array.from({ length: n }, () => rng.int(1, 30));
      const sorted = xs.slice().sort((a, b) => a - b);
      const med = median(xs);
      const mid = Math.floor(n / 2);
      const middle =
        n % 2
          ? `With $n = ${n}$ (odd), the median is the value in position ${mid + 1}: **${sorted[mid]}**.`
          : `With $n = ${n}$ (even), average the two middle values (positions ${mid} and ${mid + 1}): $(${sorted[mid - 1]} + ${sorted[mid]})/2 = ${fmt(med)}$.`;
      return numeric({
        prompt: `Find the median of: **${xs.join(", ")}**.`,
        answer: med,
        tolerance: 0.001,
        hint: "Sort first. The median is the middle value - or the average of the two middle values when n is even.",
        steps: [`Sort the values: ${sorted.join(", ")}.`, middle],
      });
    },
  },
  "sample-sd": {
    session: "s01",
    title: "Compute a sample standard deviation",
    generate(rng) {
      const n = rng.int(4, 5);
      const base = rng.int(6, 12);
      const xs = Array.from({ length: n }, () => base + rng.int(-4, 4));
      const m = mean(xs);
      const dev = xs.map((x) => x - m);
      const ss = dev.reduce((a, d) => a + d * d, 0);
      const s = sd(xs);
      return numeric({
        prompt: `Compute the sample standard deviation $s$ of **${xs.join(", ")}**. Round to 2 decimals.`,
        answer: s,
        tolerance: Math.max(0.02, s * 0.01),
        hint: "Mean first; then squared deviations; divide their sum by n − 1; take the square root.",
        steps: [
          `Mean: $\\bar x = ${fmt(m, 3)}$.`,
          `Deviations $x_i - \\bar x$: ${dev.map((d) => fmt(d, 2)).join(", ")}.`,
          `Sum of squared deviations: $${fmt(ss, 3)}$.`,
          `Divide by $n - 1 = ${n - 1}$: $s^2 = ${fmt(ss / (n - 1), 3)}$.`,
          `Square root: $s = \\sqrt{${fmt(ss / (n - 1), 3)}} = ${fmt(s)}$.`,
        ],
      });
    },
  },
  "skew-direction": {
    session: "s01",
    title: "Read skew from mean and median",
    generate(rng) {
      const kind = rng.pick(["right", "left", "symmetric"]);
      const med = rng.int(40, 80);
      const gap = rng.int(8, 20);
      const m = kind === "right" ? med + gap : kind === "left" ? med - gap : med + rng.pick([-1, 0, 1]);
      const what = rng.pick(["household incomes (in \\$1000s)", "commute times (minutes)", "exam scores", "house prices (in \\$10,000s)"]);
      const correct = { right: "Right-skewed (long tail of large values)", left: "Left-skewed (long tail of small values)", symmetric: "Roughly symmetric" }[kind];
      const { options, answer } = shuffled(
        rng,
        correct,
        ["Right-skewed (long tail of large values)", "Left-skewed (long tail of small values)", "Roughly symmetric"].filter((o) => o !== correct),
      );
      return choice({
        prompt: `A data set of ${what} has mean **${m}** and median **${med}**. What shape is the distribution most likely?`,
        options,
        answer,
        hint: "The mean is pulled toward the long tail; the median resists it.",
        steps: [
          "The mean uses every value, so a few extreme values drag it toward the tail. The median only depends on the middle.",
          kind === "symmetric"
            ? "Mean and median are almost equal, so there is no strong tail: roughly symmetric."
            : `The mean is ${kind === "right" ? "above" : "below"} the median, so the tail points ${kind === "right" ? "right (large values)" : "left (small values)"}.`,
        ],
      });
    },
  },

  // ---------- s02 probability ----------
  complement: {
    session: "s02",
    title: "Complement rule",
    generate(rng) {
      const p = rng.pick([0.05, 0.12, 0.2, 0.35, 0.4, 0.65, 0.72, 0.9]);
      const [event, not] = rng.pick([
        ["it rains tomorrow", "it does not rain"],
        ["a flight is delayed", "the flight is on time"],
        ["a customer buys something", "the customer buys nothing"],
        ["a seed germinates", "the seed does not germinate"],
      ]);
      return numeric({
        prompt: `$P(\\text{${event}}) = ${p}$. What is the probability that ${not}?`,
        answer: 1 - p,
        tolerance: 0.001,
        hint: "An event and its complement together cover all outcomes, so their probabilities add to 1.",
        steps: ["Complement rule: $P(A^c) = 1 - P(A)$.", `$1 - ${p} = ${fmt(1 - p, 3)}$.`],
      });
    },
  },
  "addition-rule": {
    session: "s02",
    title: "General addition rule",
    generate(rng) {
      const a = rng.pick([0.3, 0.4, 0.45, 0.5, 0.6]);
      const b = rng.pick([0.2, 0.25, 0.3, 0.35]);
      const both = rng.pick([0.05, 0.1, 0.15]);
      return numeric({
        prompt: `In a survey, ${fmt(a * 100)}% of people own a cat, ${fmt(b * 100)}% own a dog and ${fmt(both * 100)}% own both. What proportion own a cat **or** a dog (or both)?`,
        answer: a + b - both,
        tolerance: 0.001,
        hint: "Adding P(cat) and P(dog) counts the 'both' group twice.",
        steps: [
          "General addition rule: $P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$.",
          `$${a} + ${b} - ${both} = ${fmt(a + b - both, 3)}$.`,
        ],
      });
    },
  },
  "independent-events": {
    session: "s02",
    title: "Independent events",
    generate(rng) {
      const p = rng.pick([0.1, 0.2, 0.3, 0.5]);
      const q = rng.pick([0.1, 0.2, 0.4, 0.6]);
      const atLeast = rng.next() < 0.5;
      const ans = atLeast ? 1 - (1 - p) * (1 - q) : p * q;
      return numeric({
        prompt: `Two machines fail independently: machine A with probability ${p}, machine B with probability ${q} on a given day. What is the probability that ${atLeast ? "**at least one** fails" : "**both** fail"}?`,
        answer: ans,
        tolerance: 0.001,
        hint: atLeast ? "'At least one' is the complement of 'none'." : "For independent events, multiply.",
        steps: atLeast
          ? [
              `P(neither fails) $= (1-${p})(1-${q}) = ${fmt((1 - p) * (1 - q), 4)}$.`,
              `P(at least one) $= 1 - ${fmt((1 - p) * (1 - q), 4)} = ${fmt(ans, 4)}$.`,
            ]
          : ["Independence: $P(A \\cap B) = P(A)\\,P(B)$.", `$${p} \\times ${q} = ${fmt(ans, 4)}$.`],
      });
    },
  },
  "conditional-table": {
    session: "s02",
    title: "Conditional probability from a table",
    generate(rng) {
      const a = rng.int(20, 60);
      const b = rng.int(5, 30);
      const c = rng.int(10, 40);
      const d = rng.int(15, 50);
      const askRow = rng.next() < 0.5;
      const table = `| | Passed | Failed | Total |\n|---|---|---|---|\n| Used flashcards | ${a} | ${b} | ${a + b} |\n| Did not | ${c} | ${d} | ${c + d} |\n| Total | ${a + c} | ${b + d} | ${a + b + c + d} |`;
      const ans = askRow ? a / (a + b) : a / (a + c);
      return numeric({
        prompt: `${table}\n\nWhat is ${askRow ? "P(passed | used flashcards)" : "P(used flashcards | passed)"}? Round to 3 decimals.`,
        answer: ans,
        tolerance: 0.002,
        hint: "Condition = restrict to one row (or column). Divide by that row's (column's) total, not the grand total.",
        steps: askRow
          ? [`Restrict to students who used flashcards: ${a + b} students.`, `Of those, ${a} passed: $${a}/${a + b} = ${fmt(ans, 3)}$.`]
          : [`Restrict to students who passed: ${a + c} students.`, `Of those, ${a} used flashcards: $${a}/${a + c} = ${fmt(ans, 3)}$.`],
      });
    },
  },
  "bayes-test": {
    session: "s02",
    title: "Bayes: positive test, disease?",
    generate(rng) {
      const prev = rng.pick([0.01, 0.02, 0.05, 0.1]);
      const sens = rng.pick([0.9, 0.95, 0.99]);
      const spec = rng.pick([0.9, 0.95, 0.98]);
      const N = 10000;
      const sick = prev * N;
      const tp = sens * sick;
      const fp = (1 - spec) * (N - sick);
      const ans = tp / (tp + fp);
      return numeric({
        prompt: `A disease affects ${pct(prev)} of people. A test detects it in ${pct(sens)} of sick people (sensitivity) and correctly clears ${pct(spec)} of healthy people (specificity). Someone tests **positive**. What is the probability they have the disease? Round to 3 decimals.`,
        answer: ans,
        tolerance: 0.003,
        hint: "Imagine 10,000 people. How many are sick and test positive? How many are healthy but test positive?",
        steps: [
          `Of 10,000 people, $${fmt(sick, 0)}$ are sick and $${fmt(N - sick, 0)}$ are healthy.`,
          `True positives: $${sens} \\times ${fmt(sick, 0)} = ${fmt(tp, 1)}$.`,
          `False positives: $${fmt(1 - spec, 2)} \\times ${fmt(N - sick, 0)} = ${fmt(fp, 1)}$.`,
          `$P(\\text{sick} \\mid +) = ${fmt(tp, 1)} / (${fmt(tp, 1)} + ${fmt(fp, 1)}) = ${fmt(ans, 3)}$.`,
        ],
      });
    },
  },

  // ---------- s03 random variables & the normal model ----------
  "expected-value": {
    session: "s03",
    title: "Expected value of a discrete variable",
    generate(rng) {
      const probs = rng.pick([
        [0.5, 0.3, 0.2],
        [0.6, 0.3, 0.1],
        [0.4, 0.4, 0.2],
        [0.7, 0.2, 0.1],
        [0.25, 0.25, 0.5],
      ]);
      const values = [0, rng.int(2, 10), rng.int(11, 40)];
      const ev = values.reduce((acc, v, i) => acc + v * probs[i], 0);
      const table = `| Prize $x$ (€) | ${values.join(" | ")} |\n|---|---|---|---|\n| $P(X = x)$ | ${probs.join(" | ")} |`;
      return numeric({
        prompt: `A game pays the prizes below.\n\n${table}\n\nWhat is the expected prize $E(X)$ in euros?`,
        answer: ev,
        tolerance: 0.01,
        hint: "Weight each value by its probability and add up.",
        steps: [
          "$E(X) = \\sum x \\, P(X = x)$.",
          `$${values.map((v, i) => `${v} \\times ${probs[i]}`).join(" + ")} = ${fmt(ev)}$.`,
        ],
      });
    },
  },
  "binomial-prob": {
    session: "s03",
    title: "Binomial probability",
    generate(rng) {
      const n = rng.int(4, 8);
      const p = rng.pick([0.2, 0.3, 0.5, 0.6]);
      const k = rng.int(1, n - 1);
      const ans = binomPmf(k, n, p);
      return numeric({
        prompt: `A free-throw shooter makes each shot with probability ${p}, independently. In ${n} shots, what is $P(\\text{exactly } ${k} \\text{ made})$? Round to 3 decimals.`,
        answer: ans,
        tolerance: 0.002,
        hint: "Binomial: (number of orderings) × p^k × (1−p)^(n−k).",
        steps: [
          `$P(X = k) = \\binom{n}{k} p^k (1-p)^{n-k}$ with $n = ${n}$, $k = ${k}$, $p = ${p}$.`,
          `$\\binom{${n}}{${k}} = ${choose(n, k)}$.`,
          `$${choose(n, k)} \\times ${p}^{${k}} \\times ${fmt(1 - p, 2)}^{${n - k}} = ${fmt(ans, 4)}$.`,
        ],
      });
    },
  },
  "binomial-mean-sd": {
    session: "s03",
    title: "Binomial mean and SD",
    generate(rng) {
      const n = rng.pick([20, 50, 100, 200, 400]);
      const p = rng.pick([0.1, 0.2, 0.25, 0.5]);
      const askSd = rng.next() < 0.5;
      const ans = askSd ? Math.sqrt(n * p * (1 - p)) : n * p;
      return numeric({
        prompt: `${n} people each answer "yes" with probability ${p}, independently. Let $X$ be the number of yes answers. What is the ${askSd ? "standard deviation" : "mean"} of $X$?${askSd ? " Round to 2 decimals." : ""}`,
        answer: ans,
        tolerance: askSd ? 0.02 : 0.001,
        hint: askSd ? "SD of a binomial: square root of n·p·(1−p)." : "Mean of a binomial: n·p.",
        steps: askSd
          ? [`$\\sigma = \\sqrt{np(1-p)} = \\sqrt{${n} \\times ${p} \\times ${fmt(1 - p, 2)}}$.`, `$= \\sqrt{${fmt(n * p * (1 - p), 3)}} = ${fmt(ans)}$.`]
          : [`$\\mu = np = ${n} \\times ${p} = ${fmt(ans)}$.`],
      });
    },
  },
  "z-score": {
    session: "s03",
    title: "Standardise with a z-score",
    generate(rng) {
      const mu = rng.pick([60, 70, 100, 500]);
      const sigma = rng.pick([5, 8, 10, 15, 100].filter((s) => s < mu / 2));
      const x = mu + sigma * rng.pick([-2, -1.5, -1, -0.5, 0.5, 1, 1.2, 1.5, 2, 2.5]);
      const z = (x - mu) / sigma;
      return numeric({
        prompt: `Scores have mean ${mu} and standard deviation ${sigma}. How many standard deviations from the mean is a score of **${fmt(x, 1)}**? (Give the z-score.)`,
        answer: z,
        tolerance: 0.01,
        hint: "z = (value − mean) / SD. Negative z means below the mean.",
        steps: [`$z = \\dfrac{x - \\mu}{\\sigma} = \\dfrac{${fmt(x, 1)} - ${mu}}{${sigma}}$.`, `$= ${fmt(x - mu, 1)} / ${sigma} = ${fmt(z)}$.`],
      });
    },
  },
  "empirical-rule": {
    session: "s03",
    title: "68-95-99.7 rule",
    generate(rng) {
      const mu = rng.pick([50, 100, 170]);
      const sigma = rng.pick([5, 10, 15]);
      const k = rng.pick([1, 2, 3]);
      const mode = rng.pick(["within", "above", "below"]);
      const within = { 1: 0.68, 2: 0.95, 3: 0.997 }[k];
      const ans = mode === "within" ? within : (1 - within) / 2;
      const desc =
        mode === "within" ? `between ${mu - k * sigma} and ${mu + k * sigma}` : mode === "above" ? `above ${mu + k * sigma}` : `below ${mu - k * sigma}`;
      return numeric({
        prompt: `A quantity is approximately normal with mean ${mu} and SD ${sigma}. About what proportion of values lie ${desc}? Use the 68-95-99.7 rule.`,
        answer: ans,
        tolerance: mode === "within" ? 0.006 : 0.003,
        hint: "Convert the cut-off(s) to 'how many SDs from the mean'. Tails are symmetric: split what is outside in two.",
        steps: [
          `${desc[0].toUpperCase() + desc.slice(1)} is ${mode === "within" ? `within ${k} SD of the mean` : `beyond ${k} SD on one side`}.`,
          mode === "within"
            ? `About ${pct(within)} of a normal distribution lies within ${k} SD: **${ans}**.`
            : `${pct(within)} lies within ${k} SD, so ${pct(1 - within)} lies outside, half on each side: **${fmt(ans, 4)}**.`,
        ],
      });
    },
  },

  // ---------- s04 sampling distributions ----------
  "se-mean": {
    session: "s04",
    title: "Standard error of a mean",
    generate(rng) {
      const sigma = rng.pick([6, 8, 10, 12, 15, 20]);
      const n = rng.pick([16, 25, 36, 49, 64, 100]);
      const se = sigma / Math.sqrt(n);
      return numeric({
        prompt: `Individual measurements have SD $\\sigma = ${sigma}$. What is the standard error of the mean of a random sample of $n = ${n}$? Round to 2 decimals.`,
        answer: se,
        tolerance: 0.01,
        hint: "SE = σ / √n: averages vary less than single values.",
        steps: [`$SE = \\sigma / \\sqrt{n} = ${sigma} / \\sqrt{${n}}$.`, `$= ${sigma} / ${Math.sqrt(n)} = ${fmt(se)}$.`],
      });
    },
  },
  "se-proportion": {
    session: "s04",
    title: "Standard error of a proportion",
    generate(rng) {
      const p = rng.pick([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const n = rng.pick([100, 200, 400, 500, 1000]);
      const se = Math.sqrt((p * (1 - p)) / n);
      return numeric({
        prompt: `In a population, a proportion $p = ${p}$ supports a policy. What is the standard error of the sample proportion $\\hat p$ for samples of $n = ${n}$? Round to 4 decimals.`,
        answer: se,
        tolerance: 0.0006,
        hint: "SE of a proportion: √(p(1−p)/n).",
        steps: [`$SE = \\sqrt{p(1-p)/n} = \\sqrt{${p} \\times ${fmt(1 - p, 2)} / ${n}}$.`, `$= \\sqrt{${fmt((p * (1 - p)) / n, 6)}} = ${fmt(se, 4)}$.`],
      });
    },
  },
  "se-scaling": {
    session: "s04",
    title: "How SE changes with n",
    generate(rng) {
      const k = rng.pick([4, 9, 16, 100]);
      const root = Math.sqrt(k);
      const correct = `It is divided by ${root}`;
      const { options, answer } = shuffled(rng, correct, [`It is divided by ${k}`, `It is multiplied by ${root}`, "It stays the same"]);
      return choice({
        prompt: `A study's sample size is multiplied by ${k}. What happens to the standard error of the sample mean?`,
        options,
        answer,
        hint: "n sits under a square root in SE = σ/√n.",
        steps: [`$SE = \\sigma/\\sqrt{n}$. Replacing $n$ by $${k}n$ gives $\\sigma/\\sqrt{${k}n} = \\dfrac{\\sigma/\\sqrt{n}}{${root}}$.`, `So the SE is divided by $\\sqrt{${k}} = ${root}$: precision grows only with the square root of the effort.`],
      });
    },
  },

  // ---------- s05 confidence intervals ----------
  "ci-proportion": {
    session: "s05",
    title: "Margin of error for a proportion",
    generate(rng) {
      const n = rng.pick([200, 400, 500, 800, 1000]);
      const x = Math.round(n * rng.pick([0.2, 0.3, 0.35, 0.45, 0.55, 0.6]));
      const level = rng.pick([90, 95, 99]);
      const ph = x / n;
      const se = Math.sqrt((ph * (1 - ph)) / n);
      const me = Z_STAR[level] * se;
      return numeric({
        prompt: `In a random sample of ${n} people, ${x} say yes. Compute the margin of error of a ${level}% confidence interval for the true proportion ($z^* = ${Z_STAR[level]}$). Round to 3 decimals.`,
        answer: me,
        tolerance: 0.002,
        hint: "Margin of error = z* × SE, with SE = √(p̂(1−p̂)/n).",
        steps: [
          `$\\hat p = ${x}/${n} = ${fmt(ph, 3)}$.`,
          `$SE = \\sqrt{${fmt(ph, 3)} \\times ${fmt(1 - ph, 3)} / ${n}} = ${fmt(se, 4)}$.`,
          `$ME = z^* \\times SE = ${Z_STAR[level]} \\times ${fmt(se, 4)} = ${fmt(me, 3)}$.`,
          `Interval: $${fmt(ph, 3)} \\pm ${fmt(me, 3)}$, i.e. $(${fmt(ph - me, 3)},\\ ${fmt(ph + me, 3)})$.`,
        ],
      });
    },
  },
  "ci-mean": {
    session: "s05",
    title: "Confidence interval for a mean (large sample)",
    generate(rng) {
      const n = rng.pick([64, 100, 144, 400]);
      const s = rng.pick([8, 10, 12, 20]);
      const xbar = rng.int(40, 90);
      const level = rng.pick([90, 95, 99]);
      const se = s / Math.sqrt(n);
      const upper = xbar + Z_STAR[level] * se;
      return numeric({
        prompt: `A random sample of $n = ${n}$ has mean $\\bar x = ${xbar}$ and SD $s = ${s}$. Using $z^* = ${Z_STAR[level]}$ (large sample), what is the **upper** end of the ${level}% confidence interval for the population mean? Round to 2 decimals.`,
        answer: upper,
        tolerance: 0.02,
        hint: "Upper end = x̄ + z* × s/√n.",
        steps: [
          `$SE = s/\\sqrt{n} = ${s}/${Math.sqrt(n)} = ${fmt(se, 3)}$.`,
          `$ME = ${Z_STAR[level]} \\times ${fmt(se, 3)} = ${fmt(Z_STAR[level] * se, 3)}$.`,
          `Upper end $= ${xbar} + ${fmt(Z_STAR[level] * se, 3)} = ${fmt(upper)}$.`,
        ],
      });
    },
  },
  "sample-size": {
    session: "s05",
    title: "Sample size for a target margin of error",
    generate(rng) {
      const m = rng.pick([0.01, 0.02, 0.03, 0.04, 0.05]);
      const n = Math.ceil((1.96 ** 2 * 0.25) / m ** 2);
      return numeric({
        prompt: `A pollster wants a 95% margin of error of at most ${fmt(m * 100)} percentage points for a proportion. Using the conservative guess $p = 0.5$, how many people must be sampled? (Round up.)`,
        answer: n,
        tolerance: 1,
        hint: "Solve m = 1.96·√(0.25/n) for n; always round up.",
        steps: [
          "$m = z^* \\sqrt{p(1-p)/n} \\Rightarrow n = \\dfrac{(z^*)^2\\, p(1-p)}{m^2}$.",
          `$n = \\dfrac{1.96^2 \\times 0.25}{${m}^2} = ${fmt((1.96 ** 2 * 0.25) / m ** 2, 1)}$.`,
          `Round up: $n = ${n}$.`,
        ],
      });
    },
  },

  // ---------- s06 hypothesis tests ----------
  "z-test-proportion": {
    session: "s06",
    title: "Test statistic for a proportion",
    generate(rng) {
      const p0 = rng.pick([0.5, 0.3, 0.2]);
      const n = rng.pick([100, 200, 400]);
      const x = Math.round(n * (p0 + rng.pick([-0.08, -0.05, 0.04, 0.06, 0.09])));
      const ph = x / n;
      const se = Math.sqrt((p0 * (1 - p0)) / n);
      const z = (ph - p0) / se;
      return numeric({
        prompt: `$H_0: p = ${p0}$. In a sample of ${n}, ${x} are successes. Compute the test statistic $z$. Round to 2 decimals.`,
        answer: z,
        tolerance: 0.02,
        hint: "Under H0, use p0 (not p̂) in the standard error.",
        steps: [
          `$\\hat p = ${x}/${n} = ${fmt(ph, 3)}$.`,
          `$SE_0 = \\sqrt{p_0(1-p_0)/n} = \\sqrt{${p0} \\times ${fmt(1 - p0, 2)}/${n}} = ${fmt(se, 4)}$.`,
          `$z = (\\hat p - p_0)/SE_0 = (${fmt(ph, 3)} - ${p0}) / ${fmt(se, 4)} = ${fmt(z)}$.`,
        ],
      });
    },
  },
  "p-value-two-sided": {
    session: "s06",
    title: "From tail area to two-sided p-value",
    generate(rng) {
      const z = rng.pick([1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0]);
      const tail = 1 - normalCdf(z);
      const sign = rng.next() < 0.5 ? 1 : -1;
      return numeric({
        prompt: `A two-sided test gives $z = ${fmt(sign * z)}$. The area beyond ${fmt(z)} in one tail is $P(Z > ${fmt(z)}) = ${fmt(tail, 4)}$. What is the two-sided p-value?`,
        answer: 2 * tail,
        tolerance: 0.0006,
        hint: "Two-sided: results as extreme in either direction count.",
        steps: [`Both tails count: $p = 2 \\times P(Z > |z|)$.`, `$p = 2 \\times ${fmt(tail, 4)} = ${fmt(2 * tail, 4)}$.`],
      });
    },
  },
  decision: {
    session: "s06",
    title: "Make the decision",
    generate(rng) {
      const alpha = rng.pick([0.05, 0.01, 0.1]);
      const p = rng.pick([0.003, 0.02, 0.04, 0.07, 0.2, 0.6]);
      const reject = p <= alpha;
      const correct = reject ? "Reject H₀: the data are unusual if H₀ were true" : "Do not reject H₀: the data are not unusual enough";
      const { options, answer } = shuffled(rng, correct, [
        reject ? "Do not reject H₀: the data are not unusual enough" : "Reject H₀: the data are unusual if H₀ were true",
        "Accept H₀: we have proven it is true",
        `There is a ${fmt(p * 100, 1)}% chance that H₀ is true`,
      ]);
      return choice({
        prompt: `With significance level $\\alpha = ${alpha}$, a test gives p-value **${p}**. What do you conclude?`,
        options,
        answer,
        hint: "Compare p to α. Note that a p-value is not the probability that H₀ is true.",
        steps: [
          `$p = ${p}$ is ${reject ? "at most" : "greater than"} $\\alpha = ${alpha}$, so we ${reject ? "reject" : "do not reject"} $H_0$.`,
          "We never 'prove' $H_0$; and the p-value is P(data this extreme | H₀), not P(H₀ | data).",
        ],
      });
    },
  },
  "error-type": {
    session: "s06",
    title: "Type I or Type II error?",
    generate(rng) {
      const ctx = rng.pick([
        { who: "the clinical trial", h0: "the new drug has no effect", h1: "the drug works", yes: "concludes the drug works", no: "finds no evidence that the drug works" },
        { who: "the analysis", h0: "the coin is fair", h1: "the coin is biased", yes: "concludes the coin is biased", no: "finds no evidence of bias" },
        { who: "the jury", h0: "the defendant is innocent", h1: "the defendant is guilty", yes: "convicts the defendant", no: "acquits the defendant" },
        { who: "the A/B test", h0: "the website redesign does not change sales", h1: "the redesign changes sales", yes: "concludes the redesign changes sales", no: "finds no evidence of a change" },
      ]);
      const h0True = rng.next() < 0.5;
      const label = h0True ? "Type I error (false positive)" : "Type II error (false negative)";
      const { options, answer } = shuffled(rng, label, [h0True ? "Type II error (false negative)" : "Type I error (false positive)", "No error: a correct decision"]);
      const scenario = h0True ? `In truth ${ctx.h0}, but ${ctx.who} ${ctx.yes}.` : `In truth ${ctx.h1}, but ${ctx.who} ${ctx.no}.`;
      return choice({
        prompt: `$H_0$: ${ctx.h0}. ${scenario} Which kind of error is this?`,
        options,
        answer,
        hint: "Type I = rejecting a true H₀. Type II = failing to reject a false H₀.",
        steps: [
          h0True ? "H₀ is true but was rejected." : "H₀ is false but was not rejected.",
          `That is a ${label}.`,
        ],
      });
    },
  },

  // ---------- s07 correlation & regression ----------
  "slope-from-r": {
    session: "s07",
    title: "Slope from correlation",
    generate(rng) {
      const r = rng.pick([-0.8, -0.6, -0.4, 0.3, 0.5, 0.7, 0.9]);
      const sx = rng.pick([2, 4, 5, 10]);
      const sy = rng.pick([3, 6, 8, 12, 20]);
      const b1 = (r * sy) / sx;
      return numeric({
        prompt: `Hours studied ($x$) and exam score ($y$) have correlation $r = ${r}$, $s_x = ${sx}$, $s_y = ${sy}$. What is the least-squares slope $b_1$? Round to 2 decimals.`,
        answer: b1,
        tolerance: 0.01,
        hint: "b1 = r · sy / sx: the correlation rescaled into y-units per x-unit.",
        steps: [`$b_1 = r \\dfrac{s_y}{s_x} = ${r} \\times \\dfrac{${sy}}{${sx}}$.`, `$= ${fmt(b1)}$.`],
      });
    },
  },
  intercept: {
    session: "s07",
    title: "Intercept from the means",
    generate(rng) {
      const b1 = rng.pick([-2, -1.5, 0.5, 1.2, 2, 3]);
      const xbar = rng.int(3, 12);
      const ybar = rng.int(20, 80);
      const b0 = ybar - b1 * xbar;
      return numeric({
        prompt: `A least-squares line has slope $b_1 = ${b1}$. The means are $\\bar x = ${xbar}$ and $\\bar y = ${ybar}$. What is the intercept $b_0$?`,
        answer: b0,
        tolerance: 0.01,
        hint: "The least-squares line always passes through the point (x̄, ȳ).",
        steps: ["The line passes through $(\\bar x, \\bar y)$, so $b_0 = \\bar y - b_1 \\bar x$.", `$b_0 = ${ybar} - (${b1})(${xbar}) = ${fmt(b0)}$.`],
      });
    },
  },
  residual: {
    session: "s07",
    title: "Predict and compute a residual",
    generate(rng) {
      const b0 = rng.int(10, 40);
      const b1 = rng.pick([1.5, 2, 2.5, 3, 4]);
      const x = rng.int(2, 10);
      const yhat = b0 + b1 * x;
      const y = Math.round(yhat + rng.pick([-6, -4, -3, 2, 3, 5, 7]));
      const e = y - yhat;
      return numeric({
        prompt: `The fitted line is $\\hat y = ${b0} + ${b1}x$. A data point has $x = ${x}$ and observed $y = ${y}$. What is its residual?`,
        answer: e,
        tolerance: 0.01,
        hint: "Residual = observed − predicted.",
        steps: [`Prediction: $\\hat y = ${b0} + ${b1} \\times ${x} = ${fmt(yhat)}$.`, `Residual: $e = y - \\hat y = ${y} - ${fmt(yhat)} = ${fmt(e)}$.`, e > 0 ? "Positive: the point lies above the line." : "Negative: the point lies below the line."],
      });
    },
  },
  "r-squared": {
    session: "s07",
    title: "R² from r",
    generate(rng) {
      const r = rng.pick([-0.9, -0.7, -0.5, 0.4, 0.6, 0.8, 0.95]);
      return numeric({
        prompt: `The correlation between two variables is $r = ${r}$. What proportion of the variation in $y$ is explained by the linear model ($R^2$)?`,
        answer: r * r,
        tolerance: 0.002,
        hint: "In simple linear regression, R² is the square of r.",
        steps: [`$R^2 = r^2 = (${r})^2 = ${fmt(r * r, 4)}$.`, `About ${fmt(r * r * 100, 1)}% of the variability in $y$ is explained by $x$ (the sign of $r$ disappears).`],
      });
    },
  },
};

export const EXERCISE_IDS = new Set(Object.keys(EXERCISES));

export function generate(id, rng) {
  const ex = EXERCISES[id];
  if (!ex) throw new Error(`unknown exercise "${id}"`);
  return { id, title: ex.title, ...ex.generate(rng) };
}

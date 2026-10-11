import { h } from "./dom.js";

// PDF page positions verified against the linked MacKay PDF and the user's
// Casella–Berger 2nd-edition scan. Printed and PDF page numbers differ.
const mackay = {
  s02: [2, 34], s03: [23, 323], s04: [4, 79], s05: [37, 469],
  s06: [37, 469], s08: [2, 34], s09: [3, 60], s10: [28, 355],
  s11: [22, 312], s12: [29, 369], s13: [37, 469], s14: [20, 296],
};
const casella = {
  s01: ["§5.3: Sample mean and variance", 219, 245],
  s02: ["§1.3: Conditional probability and independence", 20, 47],
  s03: ["§3.2: Discrete distributions", 86, 112],
  s04: ["§5.5: Convergence concepts", 233, 259],
  s05: ["Ch. 9: Interval estimation", 418, 444],
  s06: ["Ch. 8: Hypothesis testing", 374, 400],
  s07: ["§11.3: Simple linear regression", 540, 566],
  s09: ["§7.2.3: Bayes estimators", 325, 351],
  s10: ["§8.2.2: Bayesian tests (related reading)", 380, 406],
  s11: ["§7.2.2: Maximum likelihood estimators", 316, 342],
  s12: ["§5.6: Generating a random sample", 246, 272],
  s13: ["§6.3: The likelihood principle", 291, 317],
  s14: ["§4.4: Mixture distributions (background)", 163, 189],
};

// Section anchors follow the bookdown source at github.com/StatsWithR/book.
const statsWithR = {
  s02: [["the-basics-of-bayesian-statistics.html#bayes-rule", "§1.1: Bayes' rule and diagnostic testing"]],
  s05: [["bayesian-inference.html#credible-intervals", "§2.3.2: Credible intervals, the Bayesian counterpart"]],
  s06: [["losses-and-decision-making.html#minimizing-expected-loss-for-hypothesis-testing", "§3.4: Minimizing expected loss for hypothesis testing"],
    ["hypothesis-testing-with-normal-populations.html#sec:known-var", "§5.1: Bayes factors for testing a normal mean"]],
  s07: [["introduction-to-bayesian-regression.html#sec:simple-linear", "§6.1: Bayesian simple linear regression"]],
  s09: [["the-basics-of-bayesian-statistics.html#inference-for-a-proportion", "§1.2: Inference for a proportion"],
    ["bayesian-inference.html#inference-on-a-binomial-proportion", "§2.2.1: The beta-binomial conjugate family"]],
  s10: [["losses-and-decision-making.html#sec:bayes-factors", "§3.5: Posterior probabilities of hypotheses and Bayes factors"],
    ["bayesian-model-choice.html#sec:BIC", "§7.1: Bayesian information criterion"]],
  s11: [["bayesian-inference.html#sec:normal-normal", "§2.2.3: The normal-normal conjugate family"],
    ["inference-and-decision-making-with-multiple-parameters.html#sec:normal-gamma", "§4.1: The normal-gamma conjugate family"]],
  s12: [["inference-and-decision-making-with-multiple-parameters.html#sec:NG-MC", "§4.2: Monte Carlo inference"],
    ["inference-and-decision-making-with-multiple-parameters.html#sec:NG-MCMC", "§4.6: Markov chain Monte Carlo"]],
  s13: [["the-basics-of-bayesian-statistics.html#frequentist-vs.-bayesian-inference", "§1.3: Frequentist vs. Bayesian inference"],
    ["losses-and-decision-making.html", "Ch. 3: Losses and decision making"]],
};

let personalPdfUrl;

export function deepDiveView(session) {
  const section = h("section", { class: "deep-dive" }, h("h3", {}, "Deep dive"));
  const link = (href, label) => h("a", { href, target: "_blank", rel: "noopener noreferrer" }, label);
  if (session.companionRef) section.append(h("p", {}, link("https://www.openintro.org/book/os/", session.companionRef)));
  const chapter = mackay[session.id];
  if (chapter) section.append(h("p", {}, link(`https://www.inference.org.uk/itprnn/book.pdf#page=${chapter[1]}`, `MacKay · chapter ${chapter[0]} (PDF page ${chapter[1]})`), h("br"), h("small", { class: "muted" }, session.bookRef)));
  const sections = statsWithR[session.id];
  if (sections) section.append(h("p", {}, h("strong", {}, "Clyde et al. · An Introduction to Bayesian Thinking"),
    ...sections.flatMap(([path, label]) => [h("br"), link(`https://statswithr.github.io/book/${path}`, label)])));
  const reference = casella[session.id];
  if (reference) {
    const [title, printedPage, pdfPage] = reference;
    section.append(h("p", {}, link(`https://pages.stat.wisc.edu/~shao/stat610/Casella_Berger_Statistical_Inference.pdf#page=${pdfPage}`, `Read Casella–Berger online · PDF page ${pdfPage}`)));
    const open = link("#", `Open your PDF at page ${pdfPage}`);
    open.hidden = !personalPdfUrl;
    if (personalPdfUrl) open.href = `${personalPdfUrl}#page=${pdfPage}`;
    const status = h("p", { class: "muted small", role: "status" });
    const input = h("input", { type: "file", accept: ".pdf,application/pdf", hidden: true });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        if (!(await file.slice(0, 1024).text()).includes("%PDF-")) throw new Error("Please choose a PDF file.");
        if (personalPdfUrl) URL.revokeObjectURL(personalPdfUrl);
        personalPdfUrl = URL.createObjectURL(file);
        open.href = `${personalPdfUrl}#page=${pdfPage}`;
        open.hidden = false;
        status.textContent = `Selected ${file.name}. Use the link above to open it.`;
      } catch (error) {
        status.textContent = error.message;
      }
    });
    section.append(h("p", {}, h("strong", {}, "Casella–Berger · Statistical Inference, 2nd edition"), h("br"), `${title}, printed p. ${printedPage} (PDF page ${pdfPage} in the linked edition).`),
      h("div", { class: "actions" }, h("button", { type: "button", class: "btn small", onclick: () => input.click() }, "Choose your Casella–Berger PDF"), open, input), status,
      h("p", { class: "muted small" }, "Choose your copy on this device; it stays local and is not uploaded. Select it again after reloading. Other editions or scans can have different PDF page numbers."));
  }
  section.append(h("p", { class: "muted small" }, "Reading opens separately so you can return to this question. If your PDF viewer ignores the page link, enter the displayed page number. Online books need an internet connection."));
  return section;
}

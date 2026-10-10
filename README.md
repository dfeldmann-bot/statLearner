# statLearner

A small course in statistics and inference that runs in your browser. It is based on **David MacKay's *Information Theory, Inference, and Learning Algorithms*** ([free PDF from the author](https://www.inference.org.uk/itprnn/book.pdf)). It offers short sessions, many worked examples, unlimited practice problems, interactive simulations, a multiple-choice exam per session, a built-in calculator, spaced-repetition flashcards, streaks and badges. **It works fully offline and needs no AI at runtime.**

Two companions:

- an **authoring pipeline** in which Claude drafts new sessions, ChatGPT reviews them, and both independently check every answer key;
- **StatBot**, a minimal self-made AI that answers statistics questions only from curated sources, with citations, and refuses everything else.

## Quick start

```bash
npm run serve          # http://localhost:8080 - no install needed (Node.js 20+)
npm test               # 104 JavaScript tests
npm run validate       # check all course content against the schema
npm run fetch-book     # optional: personal offline copy of the book (git-ignored)
```

Open the app, pick a daily goal and a reminder time, and start. The **Book** tab links the book, MacKay's 16 recorded lectures, and a map from sessions to chapters.

## The course

| # | Session | Book (ITILA) | MacKay lecture |
|---|---|---|---|
| | **Part A · Foundations** (companion: *OpenIntro Statistics*, free) | | |
| 1 | Describing data: center and spread | prerequisite | - |
| 2 | Probability: rules and conditional thinking | ch. 2 | 9 |
| 3 | Random variables, the binomial and the normal model | ch. 2, 23 | - |
| 4 | Sampling distributions and the central limit theorem | background for ch. 4, 29 | - |
| 5 | Confidence intervals | contrasted in ch. 37 | - |
| 6 | Hypothesis tests and p-values | contrasted in ch. 37 | - |
| 7 | Correlation and simple linear regression | background for part V | 15 |
| | **Part B · Information, inference and learning** | | |
| 8 | Information content and entropy | ch. 2, 4 | 2, 3 |
| 9 | Bayesian inference: the bent coin | ch. 2, 3 | 9, 10 |
| 10 | Model comparison and Occam's razor | ch. 3, 28 | 10 |
| 11 | Maximum likelihood, error bars and the Gaussian | ch. 22, 24, 27 | 11 |
| 12 | Monte Carlo methods | ch. 29 | 12, 13 |
| 13 | Bayesian inference vs sampling theory | ch. 36, 37 | - |

Every session is open: jump to any session, step or exam, and pick up an unfinished lesson or exam where you left it. Learners who know the basics can begin with Part B. Details, the book's copyright terms and the full lecture list are in [docs/BOOK.md](docs/BOOK.md).

Every session follows the same research-based rhythm (details in [docs/LEARNING-DESIGN.md](docs/LEARNING-DESIGN.md)):

1. **Recall warm-up** from earlier sessions (spaced retrieval, interleaving).
2. **Predict first:** a question before the explanation (pretesting effect).
3. **Short explanations alternating with active steps:** checks, simulations ("predict, then observe"), self-explanation prompts.
4. **Worked examples revealed step by step,** then **faded practice:** study a full solution, finish a half-solved one, then solve alone. 46 generators create fresh numbers, so practice never runs out. A 🧮 calculator next to every answer field does the arithmetic and fills the field in.
5. **Session exam:** 8 multiple-choice questions, no hints, 80% to pass, new questions and numbers on every retake.
6. **Flashcards** for concepts and equations join a review deck scheduled by **FSRS-6**, a modern memory model, just before you would forget them.

Gamification stays simple and honest: XP, levels, a daily goal, streaks with freezes, and 11 badges. Reviews earn the same XP whatever grade you give, so an honest "Again" never costs you.

Progress stays in your browser and is saved after every step, so you can close the app mid-lesson or mid-exam and resume later. Export and import it from Settings.

## Repository layout

```text
app/                 the course (static PWA; deploys as-is)
  content/           course.json + one JSON file per session  ← course content
  src/               fsrs.js, game.js, exercises.js, exam.js, calc.js, sims.js, main.js, ...
  vendor/katex/      math rendering (MIT), vendored for offline use
authoring/           Claude + ChatGPT pipeline (cli.mjs, prompts, briefs/)
statbot/             StatBot phase 0 (Python standard library only)
docs/                BOOK, PLAN, LEARNING-DESIGN, AUTHORING, STATBOT-PLAN
tests/               node:test suites (engine, content, exercises, authoring, offline cache)
tools/               serve.mjs, validate-content.mjs
```

## Documents

- [docs/BOOK.md](docs/BOOK.md): the book, its copyright terms, MacKay's lectures and other teaching, the session-to-chapter map
- [docs/PLAN.md](docs/PLAN.md): roadmap, architecture, minimum requirements and costs, decisions for you
- [docs/LEARNING-DESIGN.md](docs/LEARNING-DESIGN.md): which learning methods the research supports and where the app uses them
- [docs/AUTHORING.md](docs/AUTHORING.md): writing new sessions with Claude and ChatGPT (API or copy-paste)
- [docs/STATBOT-PLAN.md](docs/STATBOT-PLAN.md): the self-made AI, phase by phase, with hardware and AWS costs

## Writing new sessions with Claude and ChatGPT

```bash
npm install
export ANTHROPIC_API_KEY=... OPENAI_API_KEY=...
npm run author -- run authoring/briefs/s14-clustering.json
npm run author -- promote authoring/out/s14/session.json
```

No API keys? Add `--drafter manual --reviewer manual --solvers manual`: the CLI writes each prompt to a file for you to paste into claude.ai or chatgpt.com. See [docs/AUTHORING.md](docs/AUTHORING.md).

## StatBot

```bash
cd statbot
python3 -m statbot ask "Why do we divide by n-1 in the sample variance?"
python3 -m statbot eval
```

See [statbot/README.md](statbot/README.md) and [docs/STATBOT-PLAN.md](docs/STATBOT-PLAN.md).

## Licence

GPL-3.0 (see `LICENSE`). Course text is original. The course follows MacKay's *Information Theory, Inference, and Learning Algorithms* (© Cambridge University Press 2003); the repository links to the author's free on-screen PDF instead of including it. Part A also references *OpenIntro Statistics* (CC BY-SA 3.0). KaTeX is MIT-licensed (`app/vendor/katex/LICENSE`).

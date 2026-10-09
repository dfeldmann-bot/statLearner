# statLearner

A small statistics course that runs in your browser: short sessions, many worked examples, unlimited practice problems, interactive simulations, mastery quizzes, spaced-repetition flashcards, streaks and badges. **It works fully offline and needs no AI at runtime.**

Two companions:

- an **authoring pipeline** in which Claude drafts new sessions, ChatGPT reviews them, and both independently check every answer key;
- **StatBot**, a minimal self-made AI that answers statistics questions only from curated sources, with citations, and refuses everything else.

## Quick start

```bash
npm run serve          # http://localhost:8080 - no install needed (Node.js 20+)
npm test               # 72 JavaScript tests
npm run validate       # check all course content against the schema
```

Open the app, pick a daily goal and a reminder time, and start session 1. Add the daily reminder to your calendar from the welcome card or from Settings.

## The course

| # | Session | Optional reading (OpenIntro Statistics 4e) |
|---|---|---|
| 1 | Describing data: center and spread | §2.1 |
| 2 | Probability: rules and conditional thinking | §3.1-3.2 |
| 3 | Random variables, the binomial and the normal model | §3.4, §4.1, §4.3 |
| 4 | Sampling distributions and the central limit theorem | §5.1 |
| 5 | Confidence intervals | §5.2 |
| 6 | Hypothesis tests and p-values | §5.3 |
| 7 | Correlation and simple linear regression | §8.1-8.3 |

Every session follows the same research-based rhythm (details in [docs/LEARNING-DESIGN.md](docs/LEARNING-DESIGN.md)):

1. **Recall warm-up** from earlier sessions (spaced retrieval, interleaving).
2. **Predict first:** a question before the explanation (pretesting effect).
3. **Short explanations alternating with active steps:** checks, simulations ("predict, then observe"), self-explanation prompts.
4. **Worked examples revealed step by step,** then **faded practice:** study a full solution, finish a half-solved one, then solve alone. Problems are generated with fresh numbers, so practice never runs out.
5. **Mastery quiz** (80% unlocks the next session), new numbers on every retake.
6. **Flashcards** for concepts and equations join a review deck scheduled by **FSRS-6**, a modern memory model, just before you would forget them.

Gamification stays simple and honest: XP, levels, a daily goal, streaks with freezes, and 11 badges. Reviews earn the same XP whatever grade you give, so an honest "Again" never costs you.

Progress stays in your browser. Export and import it from Settings.

## Repository layout

```text
app/                 the course (static PWA; deploys as-is)
  content/           course.json + one JSON file per session  ← course content
  src/               fsrs.js, game.js, exercises.js, sims.js, main.js, ...
  vendor/katex/      math rendering (MIT), vendored for offline use
authoring/           Claude + ChatGPT pipeline (cli.mjs, prompts, briefs/)
statbot/             StatBot phase 0 (Python standard library only)
docs/                PLAN, LEARNING-DESIGN, AUTHORING, STATBOT-PLAN
tests/               node:test suites (engine, content, exercises, authoring, offline cache)
tools/               serve.mjs, validate-content.mjs
```

## Documents

- [docs/PLAN.md](docs/PLAN.md): roadmap, architecture, minimum requirements and costs, decisions for you
- [docs/LEARNING-DESIGN.md](docs/LEARNING-DESIGN.md): which learning methods the research supports and where the app uses them
- [docs/AUTHORING.md](docs/AUTHORING.md): writing new sessions with Claude and ChatGPT (API or copy-paste)
- [docs/STATBOT-PLAN.md](docs/STATBOT-PLAN.md): the self-made AI, phase by phase, with hardware and AWS costs

## Writing new sessions with Claude and ChatGPT

```bash
npm install
export ANTHROPIC_API_KEY=... OPENAI_API_KEY=...
npm run author -- run authoring/briefs/s08-comparing-groups.json
npm run author -- promote authoring/out/s08/session.json
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

GPL-3.0 (see `LICENSE`). Course text is original. Book references point to *OpenIntro Statistics* (CC BY-SA 3.0, openintro.org). KaTeX is MIT-licensed (`app/vendor/katex/LICENSE`).

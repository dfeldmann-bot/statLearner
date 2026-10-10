# Authoring with Claude and ChatGPT

Claude and ChatGPT write course content; the course itself never calls an LLM. The two models check each other, and a human approves every session before it ships.

```text
brief (you)  ──►  Claude drafts  ──►  schema validator ──► (auto-repair if invalid)
                        │
                        ▼
              ChatGPT reviews: recomputes numbers, checks answer keys, pedagogy, clarity
                        │  verdict "revise"?
                        ▼
              Claude revises  ──►  ChatGPT reviews again (max 2 rounds)
                        │
                        ▼
      Claude AND ChatGPT each answer every fixed question without seeing the key
                        │
                        ▼
      report.md: open issues, ⚠️ disagreements with the answer key, proposed generators
                        │
                        ▼
      you review  ──►  npm run author -- promote  ──►  live in the app
```

**Why two different models?** One model tends to repeat its own mistakes when it checks its own work. A second model, trained differently, makes *different* mistakes, so cross-review catches more errors. The cross-check is the strongest test: if either model, solving a question cold, disagrees with the answer key, the key is suspect.

## Setup

```bash
npm install                        # installs @anthropic-ai/sdk and openai
export ANTHROPIC_API_KEY=...       # console.anthropic.com
export OPENAI_API_KEY=...          # platform.openai.com
```

Models and roles live in `authoring/config.json`:

```json
{
  "roles": { "drafter": "claude", "reviewer": "openai", "solvers": ["claude", "openai"] },
  "providers": {
    "claude": { "model": "claude-opus-5-5", "effort": "high" },
    "openai": { "model": "gpt-5", "reasoningEffort": "high" }
  }
}
```

Override a model for one run with `CLAUDE_MODEL=...` or `OPENAI_MODEL=...`. Check OpenAI's current model list and set `OPENAI_MODEL` to its newest reasoning model; OpenAI renames models often.

The Claude provider streams responses (long sessions would otherwise hit HTTP timeouts). It also enables Anthropic's server-side **fallback**: if a safety classifier declines a request, which can occasionally happen with harmless content, the API re-runs it on a suitable fallback model instead of failing. Remove `fallbacks` in `authoring/providers.mjs` if you prefer a hard failure.

## Writing a new session

1. **Write a brief.** Copy `authoring/briefs/s14-clustering.json` (the brief behind session 14, which is now part of the course; the planned sessions are listed in [BOOK.md](BOOK.md)). The commands below use it as the example; for a new session, use your own brief and session number. List objectives, key ideas, misconceptions and the book sections, **in your own words**.
2. **Run the pipeline:**
   ```bash
   npm run author -- run authoring/briefs/s14-clustering.json
   ```
   Output goes to `authoring/out/s14/`: `session.json`, `result.json`, `report.md`.
3. **Read `report.md`.** Resolve every ⚠️ answer-key disagreement and every open critical or major issue. Recompute the worked examples yourself.
4. **Implement proposed generators.** If the drafter needed a practice type that does not exist yet (for example "one K-means update step"), it lists it under *Proposed exercise generators*. Add it to `app/src/exercises.js`; the tests will check it automatically.
5. **Promote:**
   ```bash
   npm run author -- promote authoring/out/s14/session.json   # add --force to replace an existing session
   npm test && npm run serve      # check it in the app (Settings → unlock all)
   ```
   `promote` validates the session, adds it to `course.json`, and updates the offline cache list in `app/sw.js`. It refuses to overwrite a session that already exists unless you pass `--force`.

### Other commands

| Command | What it does |
|---|---|
| `npm run author -- run <brief> --drafter openai --reviewer claude` | Swap roles: ChatGPT drafts, Claude reviews |
| `npm run author -- prompt <brief>` | Print the full draft prompt, e.g. to paste into a chat |
| `npm run author -- draft <brief>` | Draft only |
| `npm run author -- review <session.json> --brief <brief>` | Review only |
| `npm run author -- revise <session.json> <review.json>` | Revise only |
| `npm run author -- crosscheck <session.json>` | Both models answer every fixed question |
| `npm run validate [file.json]` | Validate the course or one session file |

## Without API keys: manual mode

With a Claude or ChatGPT subscription but no API key, use the same pipeline by copy and paste:

```bash
npm run author -- run authoring/briefs/s14-clustering.json --drafter manual --reviewer manual --solvers manual
```

Each step writes a prompt to `authoring/out/manual/<step>.prompt.md` and stops. Paste the prompt into claude.ai (for drafting) or chatgpt.com (for reviewing), save the reply as `<step>.response.md` next to it, and run the same command again. The pipeline continues where it stopped.

## Cost

Estimated per session at Claude Opus 5.5 prices ($4 per million input tokens, $20 per million output tokens; Anthropic, October 2026):

| Step | Input tokens | Output tokens (incl. reasoning) | Approx. cost |
|---|---|---|---|
| Claude draft (+ repair) | ~25,000 | ~20,000 | ~$0.50 |
| ChatGPT review × 2 | ~30,000 | ~10,000 | ~$0.20-0.45 |
| Claude revise × 2 | ~50,000 | ~40,000 | ~$1.00 |
| Cross-check (2 models × ~10 questions) | ~10,000 | ~10,000 | ~$0.20 |
| **Total per session** | | | **~$1.50-2.50** |

Ten sessions cost about $15-25 in API fees. OpenAI prices depend on the model you choose; check OpenAI's pricing page. Manual mode costs nothing beyond your subscriptions.

## Rules that keep content trustworthy

1. **No book text in briefs.** Briefs go to two external services, and MacKay's book is copyrighted. Paraphrase; reference chapters in `bookRef`.
2. **Humans approve.** `report.md` ends with a checklist; `promote` refuses invalid content, but correctness is your call.
3. **Generators are code, reviewed by a human.** LLMs may *propose* exercise generators; they never write executable code into the app directly.
4. **Safe rendering.** The app escapes all HTML in content, so a model cannot inject scripts into lessons.
5. **One source of truth.** The same validator (`app/src/schema.js`) runs in the pipeline, the tests and the app's CI.

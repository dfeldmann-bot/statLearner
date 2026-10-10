# StatBot: a minimal AI that only knows curated statistics sources

StatBot answers statistics questions **only** from text you curate: the course sessions in `app/content` plus the Markdown files in `corpus/`. Every answer cites its sources. When the sources do not cover a question, StatBot refuses instead of guessing.

This folder is **phase 0** of the plan in [`docs/STATBOT-PLAN.md`](../docs/STATBOT-PLAN.md): pure Python standard library, no model, no GPU, no internet.

```bash
cd statbot
python3 -m statbot build                          # index the course + corpus (about 265 passages)
python3 -m statbot ask "What is a standard error?"
python3 -m statbot chat                           # interactive; empty line quits
python3 -m statbot eval -v                        # retrieval hit@3 and refusal accuracy
python3 -m unittest discover -s tests             # tests
```

Example:

```text
$ python3 -m statbot ask "What is a standard error?"

The SD of a sampling distribution has its own name: the standard error (SE). [1] Notice the √n: to halve
the standard error you need four times the data. [1]

  [1] Sampling distributions and the central limit theorem › Standard error: how much a statistic varies
      (statLearner course, session s04; GPL-3.0 (this repository))

$ python3 -m statbot ask "Who won the football World Cup in 2022?"

I can't answer that from my curated statistics sources. ...
```

## How it works

1. **Corpus** (`statbot/corpus.py`): splits the course and curated Markdown into short passages. Each passage keeps its title, source and licence.
2. **Retrieval** (`statbot/bm25.py`): ranks passages with Okapi BM25, the classic search-engine formula. Statistics abbreviations are expanded first (SD, SE, CI, CLT and others).
3. **Answer or refuse** (`statbot/answer.py`): if the best passage scores high enough *and* contains at least half of the question's terms, StatBot quotes its best-matching sentences with citations. Otherwise it refuses.
4. **Optional local LLM:** with `--llm ollama:llama3.2:3b` (requires [Ollama](https://ollama.com) running locally), the same passages go to a small local model. The model is told to use nothing else, and any answer without a citation is discarded.

Current baseline (`python3 -m statbot eval`): **98% hit@3** on 44 in-scope questions, **88% correct refusals** on 8 out-of-scope questions. Lexical retrieval misses paraphrases and can be fooled by shared words: "weather tomorrow" matches "hot weather" in the confounder example. Phase 2 of the plan targets exactly these weaknesses.

## Adding curated sources

See [`corpus/README.md`](corpus/README.md) and the vetted candidate list in [`sources.json`](sources.json). Add only text whose licence allows it, rebuild, and re-run the eval. MacKay's book, which the course follows, is copyrighted and listed as reference-only: StatBot learns its topics through the course sessions, which cite the chapters.

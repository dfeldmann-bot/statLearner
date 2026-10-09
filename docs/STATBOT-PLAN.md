# StatBot plan: a minimal self-made statistics AI from curated sources

## The answer first

- **Minimum investment: $0.** StatBot runs on the computer you already have. Phase 0 (built, in `statbot/`) needs only Python. Phase 2 adds a small local language model and needs **8 GB of RAM; 16 GB is comfortable**.
- **Optional spend: $10-40, once,** to rent a cloud GPU for a few hours if you decide to fine-tune a model in phase 3. You do not need to buy hardware.
- **Avoid always-on cloud GPUs.** A single AWS GPU instance left running costs about $590-730 a month.
- **"Knowledge only from curated sources" comes from grounding, not from training.** A model you could afford to train from scratch on a few statistics books cannot write coherent answers. A small pretrained model can, as long as StatBot feeds it only curated passages, demands citations, and refuses whenever the passages do not cover the question.

## Terms used in this plan

| Term | Meaning |
|---|---|
| LLM | Large language model: a neural network trained on large amounts of text to predict the next word (ChatGPT, Claude, Llama). |
| Retrieval | Finding the passages in your corpus that match a question, like a search engine. |
| BM25 | A classic search-engine scoring formula based on word overlap. StatBot phase 0 uses it. |
| Embeddings | Number vectors that represent meaning, so "how spread out" can match "standard deviation" without sharing words. |
| RAG | Retrieval-augmented generation: retrieve passages first, then let an LLM write the answer from those passages only. |
| Fine-tuning / LoRA | Further training of a pretrained model on your own examples. LoRA (low-rank adaptation) trains a small add-on and fits on one GPU. |
| Quantisation (Q4) | Storing model weights in 4 bits instead of 16, so a model needs about a quarter of the memory. |
| VRAM | Memory on a graphics card (GPU). |
| hit@3 | Share of test questions where a correct passage appears among the top 3 retrieved. |

## What "only curated sources" can and cannot mean

A pretrained model such as Llama 3.2 3B already absorbed general web text during training. Fine-tuning cannot erase that knowledge. StatBot therefore enforces the curation rule at answer time:

1. StatBot retrieves passages only from the curated corpus.
2. StatBot answers only when the best passage covers the question well (score and term-coverage thresholds, tuned on the eval set).
3. The model must cite a passage for every claim; StatBot discards an answer without citations.
4. A later check verifies that each answer sentence is supported by a cited passage. For example, an answer that mentions "n − 1" must cite a passage that contains it.

The only way to get a model whose *weights* contain nothing but curated text is to train it from scratch (phase 4). That is a worthwhile learning project, but not a useful assistant: a few open statistics books hold roughly 1-5 million words. By the common rule of thumb of about 20 training tokens per model parameter, that much text supports at most a few hundred thousand parameters, roughly 10,000 times smaller than a 3B model and far too small to write reliable explanations.

## Phases

| Phase | What you build | Hardware | Cost | Effort |
|---|---|---|---|---|
| **0. Retrieval baseline** (built) | BM25 search over the course and a glossary, extractive answers with citations, refusals, eval set | Any computer, Python 3.9+ | $0 | done |
| **1. Grow the corpus** | Add 2-3 openly licensed books (e.g. OpenStax *Introductory Statistics*, CC BY 4.0), split by section; extend the eval to 150-200 questions, including 50 that must be refused | Any computer | $0 | 2-4 weekends |
| **2. Local RAG** | Hybrid retrieval (BM25 + embeddings), small local LLM via Ollama or llama.cpp, citation check, refusal | 8 GB RAM (3B model, CPU); 16 GB RAM or Apple Silicon for 7-8B models; 5-10 GB disk | $0 | 1-2 weekends |
| **3. Fine-tune (optional)** | LoRA on 1,000-3,000 verified Q&A pairs, so the model answers in the course's style and refuses more reliably | Rented GPU with 24 GB VRAM, 1-3 hours per run | $10-40 total | 1 weekend |
| **4. From-scratch mini-GPT (optional, educational)** | nanoGPT-style model of 1-20M parameters trained only on the corpus | Laptop CPU (hours) or 1-3 GPU hours | $0-5 | 1 weekend |

### Phase 1 details: curate before you compute

- Pick sources from [`statbot/sources.json`](../statbot/sources.json). Check each licence on the source's site, keep the attribution in the front matter, and never ingest "free to read" but copyrighted books such as ISLR.
- One topic per section: short passages retrieve better than chapters.
- **Measure first.** Run `python3 -m statbot eval` after every change; a bigger corpus can lower hit@3 when topics start to collide.

### Phase 2 details: local RAG

- **Generator model:** a 3-4B instruction-tuned open-weight model (for example Llama 3.2 3B or a Qwen model of similar size), quantised to Q4 in Ollama. Expect roughly 5-15 words per second on a modern laptop CPU, and faster on Apple Silicon or with an NVIDIA GPU.
- **Embeddings:** a small sentence-embedding model of about 100 MB, for example from the `bge-small` or `all-MiniLM` families. Combine its ranking with BM25: BM25 keeps exact formula words, embeddings catch paraphrases.
- **Guardrails:** keep the phase 0 thresholds, require citations, and add the sentence-support check described above.
- **Success criteria:** hit@3 ≥ 95%, correct refusals ≥ 95%, and a human judges ≥ 90% of 50 sampled answers correct *and* fully supported by their citations.

The hook already exists: `python3 -m statbot ask "..." --llm ollama:llama3.2:3b`.

### Phase 3 details: fine-tuning

- **Data:** generate candidate Q&A pairs from the corpus with Claude and ChatGPT (the authoring pipeline already cross-checks answers between them), then review them by hand. Include "refuse" examples.
- **Training:** QLoRA (LoRA on a 4-bit model) for a 3-8B model fits on one 24 GB GPU and takes about 1-3 hours for a few thousand examples.
- **Where to rent the GPU** (on-demand, us-east-1, checked October 2026 via third-party price trackers; confirm in the [AWS Pricing Calculator](https://calculator.aws/)):

| Option | GPU | Price per hour | 3-hour run |
|---|---|---|---|
| AWS `g6.xlarge` | 1× NVIDIA L4, 24 GB | ~$0.80 (spot ~$0.35-0.75) | ~$2.40 |
| AWS `g5.xlarge` | 1× NVIDIA A10G, 24 GB | ~$1.01 | ~$3.00 |
| GPU rental marketplaces / Colab | similar 16-24 GB GPUs | often similar or lower | a few dollars |

Budget $10-40 to cover failed runs and experiments. **Stop the instance after each run**: `g6.xlarge` left on costs about $590 a month, `g5.xlarge` about $730.

### Phase 4 details: from scratch

Train a nanoGPT-style character- or word-level model on the curated corpus to learn how training works: tokenisation, loss curves, overfitting. A model of 1-20M parameters is far larger than the data supports, so it will memorise phrases: expect statistics-flavoured but unreliable text. Keep it out of the learner-facing app.

## Hosting options

| Option | What runs | Cost | Verdict |
|---|---|---|---|
| Your own computer | Everything, phases 0-4 | $0 | **Recommended** for building and personal use |
| GitHub Pages | The course app (static files) | $0 | **Recommended** for sharing the course; a later step can port BM25 to JavaScript so StatBot phase 0 runs in the browser for free |
| Small VPS / AWS `t4g.small` (2 GB) | Phase 0 as a web API | ~$5-15 / month | Fine, but the browser version makes it unnecessary |
| AWS `t3.xlarge` (4 vCPU, 16 GB, ~$0.17/h) | Phase 2 RAG on CPU | ~$120 / month if always on | Slow and pricey; only for a shared demo |
| AWS GPU instance always on | Phase 2-3 models | ~$590-730 / month | **Avoid**; start and stop on demand instead |
| Hosted model API + your own retrieval | Your retrieval and guardrails; Anthropic's or OpenAI's model writes the answer | Claude Haiku 5.5: $0.10 per million input and $0.50 per million output tokens, so about $0.0005 per answer (3,000 tokens in, 300 out); about $0.50 per 1,000 questions | Cheapest high-quality option, but the model is not self-made |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| The model answers from its own knowledge instead of the sources | Thresholds, mandatory citations, sentence-support check, refusal tests in the eval set |
| Licence problems with ingested books | Ingest only sources marked `ingest` in `sources.json`, after checking the licence; keep attribution |
| Wrong statistics in generated Q&A pairs | Two-model cross-check plus human review before fine-tuning |
| Quality drops as the corpus grows | Run the eval after every change, and grow the eval set with the corpus |
| Cloud bills | Prefer local; use spot or on-demand instances and stop them after each run; set an AWS budget alarm at $20 |

## Recommended next steps

1. Use phase 0 as it is, and add your own questions to `statbot/eval/questions.json` whenever StatBot misses one.
2. Phase 1: ingest OpenStax *Introductory Statistics* (CC BY 4.0) section by section; rebuild and evaluate.
3. Phase 2: install Ollama, pull a 3B model, run `--llm`, then add embeddings and the support check.
4. Decide on phase 3 only if phase 2 answers are correct but badly styled, or refusals stay unreliable.

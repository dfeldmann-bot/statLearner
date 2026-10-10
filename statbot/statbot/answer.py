"""Answer questions from retrieved passages only - or refuse.

Extractive mode (default, no model): pick the passage sentences that best match
the question and cite them. Generative mode (optional): hand the same passages
to a local model through Ollama with instructions to use nothing else.
"""

import json
import re
import urllib.request

from .text import sentences, tokenize

MIN_SCORE = 3.0  # below this BM25 score the sources do not cover the question
MIN_COVERAGE = 0.5  # share of question terms the best passage must contain

REFUSAL = "I can't answer that from my curated statistics sources. Try rephrasing, or ask about a topic from the course."


TEX_SYMBOLS = [
    ("\\bar x", "x̄"), ("\\bar y", "ȳ"), ("\\hat p", "p̂"), ("\\hat y", "ŷ"), ("\\sqrt", "√"), ("\\sigma", "σ"), ("\\mu", "μ"),
    ("\\alpha", "α"), ("\\beta", "β"), ("\\sum", "Σ"), ("\\pm", "±"), ("\\times", "×"), ("\\cdot", "·"), ("\\le", "≤"),
    ("\\ge", "≥"), ("\\ne", "≠"), ("\\cap", "∩"), ("\\cup", "∪"), ("\\mid", "|"), ("\\approx", "≈"), ("\\Rightarrow", "⇒"), ("\\,", " "),
]


def _plain(md):
    """Strip Markdown and TeX markers for terminal output."""
    s = re.sub(r"\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?", " ", md)  # table separator rows
    s = re.sub(r"\s*\|\s*", "; ", s).strip("; ")
    s = re.sub(r"\*\*|__|`|\*", "", s)
    s = re.sub(r"\$\$?", "", s)
    s = re.sub(r"\\(dfrac|frac)\{([^{}]*)\}\{([^{}]*)\}", r"(\2)/(\3)", s)
    s = re.sub(r"\\(text|mathrm|operatorname)\{([^{}]*)\}", r"\2", s)
    for tex, sym in TEX_SYMBOLS:
        s = re.sub(re.escape(tex) + r"(?![a-zA-Z])", sym, s)  # \le must not eat \left
    s = re.sub(r"\\[a-zA-Z]+", "", s).replace("{", "").replace("}", "")
    return re.sub(r"\s+", " ", s).strip()


def retrieve(index, question, k=4):
    hits, q = index.search(question, k=k)
    covered = bool(hits) and hits[0]["score"] >= MIN_SCORE and hits[0]["coverage"] >= MIN_COVERAGE
    return hits, q, covered


def extractive_answer(index, question, k=4, max_sentences=3):
    hits, q, covered = retrieve(index, question, k)
    if not covered:
        return {"refused": True, "answer": REFUSAL, "citations": [], "hits": hits}
    qset = set(q)
    candidates = []
    for rank, h in enumerate(hits[:2]):
        for pos, sent in enumerate(sentences(h["text"])):
            toks = set(tokenize(sent))
            overlap = len(qset & toks) / (len(qset) or 1)
            # Prefer earlier passages and earlier sentences (definitions come first);
            # never quote a question back at the learner.
            score = overlap - 0.15 * rank - 0.02 * pos - (1.0 if sent.rstrip().endswith("?") else 0)
            if overlap >= 0.34 or (rank == 0 and pos == 0):
                candidates.append((score, rank, pos, sent))
    candidates.sort(reverse=True)
    chosen = sorted(candidates[:max_sentences], key=lambda c: (c[1], c[2]))
    used = sorted({c[1] for c in chosen})
    cite = {r: n + 1 for n, r in enumerate(used)}
    text = " ".join(f"{_plain(c[3])} [{cite[c[1]]}]" for c in chosen)
    return {"refused": False, "answer": text, "citations": [hits[r] for r in used], "hits": hits}


def generative_answer(index, question, model="llama3.2:3b", host="http://localhost:11434", k=4):
    hits, _, covered = retrieve(index, question, k)
    if not covered:
        return {"refused": True, "answer": REFUSAL, "citations": [], "hits": hits}
    sources = "\n\n".join(f"[{i + 1}] {h['title']}\n{h.get('context', '')}\n{h['text']}" for i, h in enumerate(hits))
    prompt = (
        "Answer the question using ONLY the numbered sources below. Cite sources like [1]. "
        "If the sources do not contain the answer, reply exactly: NOT IN SOURCES.\n\n"
        f"SOURCES\n{sources}\n\nQUESTION\n{question}\n\nANSWER"
    )
    body = json.dumps({"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0}}).encode()
    req = urllib.request.Request(f"{host}/api/generate", data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        text = json.loads(resp.read())["response"].strip()
    cited = sorted({int(n) for n in re.findall(r"\[(\d+)\]", text) if 0 < int(n) <= len(hits)})
    if "NOT IN SOURCES" in text or not cited:
        # No citation means the model may be using its own (uncurated) knowledge.
        return {"refused": True, "answer": REFUSAL, "citations": [], "hits": hits}
    return {"refused": False, "answer": text, "citations": [hits[n - 1] for n in cited], "hits": hits}

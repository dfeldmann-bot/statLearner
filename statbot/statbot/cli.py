"""Command line: python -m statbot {build,ask,chat,eval}  (run from the statbot/ folder)."""

import argparse
import json
import sys
from pathlib import Path

from .answer import extractive_answer, generative_answer
from .bm25 import BM25Index
from .corpus import ROOT, all_passages

INDEX_PATH = ROOT / "statbot" / "index.json"
EVAL_PATH = ROOT / "statbot" / "eval" / "questions.json"


def build(path=INDEX_PATH):
    passages = all_passages()
    index = BM25Index(passages)
    index.save(path)
    return index


def load_or_build():
    return BM25Index.load(INDEX_PATH) if INDEX_PATH.exists() else build()


def ask(index, question, llm=None):
    if llm:
        model = llm.split(":", 1)[1] if llm.startswith("ollama:") else llm
        return generative_answer(index, question, model=model)
    return extractive_answer(index, question)


def show(result):
    print(f"\n{result['answer']}\n")
    for i, c in enumerate(result["citations"], 1):
        print(f"  [{i}] {c['title']}  ({c['source']}; {c['license']})")
    print()


def evaluate(index, path=EVAL_PATH, verbose=False):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    hit, n_in, refused_ok, n_out = 0, 0, 0, 0
    for item in data["questions"]:
        result = extractive_answer(index, item["q"])
        if item.get("outOfScope"):
            n_out += 1
            ok = result["refused"]
            refused_ok += ok
        else:
            n_in += 1
            top = [h["id"] for h in result["hits"][:3]] if not result["refused"] else []
            ok = any(any(t.startswith(prefix) for prefix in item["expect"]) for t in top)
            hit += ok
        if verbose and not ok:
            print(f"MISS: {item['q']}  -> {[h['id'] for h in result['hits'][:3]]} refused={result['refused']}")
    return {"hit_at_3": hit / max(1, n_in), "refusal_accuracy": refused_ok / max(1, n_out), "in_scope": n_in, "out_of_scope": n_out}


def main(argv=None):
    p = argparse.ArgumentParser(prog="statbot", description="Answers statistics questions from curated sources only.")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("build", help="(re)build the search index from the course and statbot/corpus")
    a = sub.add_parser("ask", help="answer one question")
    a.add_argument("question")
    a.add_argument("--llm", help="optional local model, e.g. ollama:llama3.2:3b (needs Ollama running)")
    c = sub.add_parser("chat", help="interactive questions")
    c.add_argument("--llm")
    e = sub.add_parser("eval", help="measure retrieval quality and refusals")
    e.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)

    if args.cmd == "build":
        index = build()
        print(f"Indexed {len(index.passages)} passages -> {INDEX_PATH.relative_to(ROOT)}")
    elif args.cmd == "ask":
        show(ask(load_or_build(), args.question, args.llm))
    elif args.cmd == "chat":
        index = load_or_build()
        print("StatBot - ask about statistics (empty line to quit).")
        for line in sys.stdin:
            if not line.strip():
                break
            show(ask(index, line.strip(), args.llm))
    elif args.cmd == "eval":
        m = evaluate(build(), verbose=args.verbose)
        print(f"Retrieval hit@3: {m['hit_at_3']:.0%} of {m['in_scope']} in-scope questions")
        print(f"Correct refusals: {m['refusal_accuracy']:.0%} of {m['out_of_scope']} out-of-scope questions")

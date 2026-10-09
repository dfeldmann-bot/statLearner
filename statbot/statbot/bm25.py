"""Okapi BM25 ranking - the classic search-engine scoring function, ~40 lines."""

import json
import math
from collections import Counter

from .text import tokenize


class BM25Index:
    def __init__(self, passages, k1=1.5, b=0.75):
        self.passages = passages
        self.k1, self.b = k1, b
        # Titles carry the topic, so they count twice.
        self.docs = [Counter(tokenize(p["title"]) * 2 + tokenize(p.get("context", "")) + tokenize(p["text"])) for p in passages]
        self.lengths = [sum(d.values()) for d in self.docs]
        self.avgdl = sum(self.lengths) / max(1, len(self.lengths))
        df = Counter(t for d in self.docs for t in d)
        n = len(self.docs)
        self.idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def score(self, query_tokens, i):
        d, dl = self.docs[i], self.lengths[i]
        s = 0.0
        for t in query_tokens:
            tf = d.get(t, 0)
            if tf:
                s += self.idf[t] * tf * (self.k1 + 1) / (tf + self.k1 * (1 - self.b + self.b * dl / self.avgdl))
        return s

    def search(self, query, k=5):
        q = list(dict.fromkeys(tokenize(query, expand=True)))
        scored = [(self.score(q, i), i) for i in range(len(self.docs))]
        scored = [x for x in scored if x[0] > 0]
        scored.sort(reverse=True)
        return [{"score": s, "coverage": self.coverage(q, i), **self.passages[i]} for s, i in scored[:k]], q

    def coverage(self, query_tokens, i):
        """Share of the query's distinct terms that appear in passage i."""
        if not query_tokens:
            return 0.0
        return sum(1 for t in query_tokens if t in self.docs[i]) / len(query_tokens)

    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"k1": self.k1, "b": self.b, "passages": self.passages}, f, ensure_ascii=False)

    @classmethod
    def load(cls, path):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return cls(data["passages"], data["k1"], data["b"])

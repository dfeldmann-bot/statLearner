import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from statbot.answer import _plain, extractive_answer  # noqa: E402
from statbot.bm25 import BM25Index  # noqa: E402
from statbot.cli import evaluate  # noqa: E402
from statbot.corpus import all_passages, parse_front_matter  # noqa: E402
from statbot.text import stem, tokenize  # noqa: E402


class TextTests(unittest.TestCase):
    def test_tokenize_handles_tex_stopwords_and_plurals(self):
        self.assertEqual(tokenize("The intervals of $\\sigma$"), ["interval", "sigma"])
        self.assertIn("mean", tokenize("What is the mean?"))
        self.assertEqual(tokenize("what is the SD", expand=True), ["standard", "deviation"])
        self.assertEqual(stem("probabilities"), "probability")
        self.assertEqual(stem("analysis"), "analysis")

    def test_plain_text_rendering(self):
        self.assertEqual(_plain("$\\bar x = \\frac{1}{n}$ and **bold**"), "x̄ = (1)/(n) and bold")
        self.assertEqual(_plain("$\\left( a \\le b \\right)$"), "( a ≤ b )")


class IndexTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = BM25Index(all_passages())

    def test_corpus_has_course_and_glossary(self):
        ids = [p["id"] for p in self.index.passages]
        self.assertTrue(any(i.startswith("s01:") for i in ids))
        self.assertTrue(any(i.startswith("glossary:") for i in ids))
        for p in self.index.passages:
            self.assertTrue(p["source"] and p["license"], p["id"])

    def test_answers_with_citations(self):
        r = extractive_answer(self.index, "What is a standard error?")
        self.assertFalse(r["refused"])
        self.assertIn("standard error", r["answer"].lower())
        self.assertTrue(r["citations"][0]["id"].startswith("s04:"))
        self.assertIn("[1]", r["answer"])

    def test_refuses_out_of_scope(self):
        r = extractive_answer(self.index, "How do I bake sourdough bread?")
        self.assertTrue(r["refused"])
        self.assertEqual(r["citations"], [])

    def test_eval_quality_floor(self):
        m = evaluate(self.index)
        self.assertGreaterEqual(m["hit_at_3"], 0.85)
        self.assertGreaterEqual(m["refusal_accuracy"], 0.75)

    def test_front_matter(self):
        meta, body = parse_front_matter("---\ntitle: T\nlicense: CC BY\n---\n## A\ntext")
        self.assertEqual(meta, {"title": "T", "license": "CC BY"})
        self.assertTrue(body.startswith("## A"))


if __name__ == "__main__":
    unittest.main()

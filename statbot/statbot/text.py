"""Tokenisation tuned for statistics text: TeX-aware, abbreviation-aware, light stemming."""

import re

STOPWORDS = set(
    """a an and are as at be been but by can could do does did for from has have how i if in into is it its
    of on or our so such than that the their them then there these they this to was we were what when where
    which while who whom why will with would you your about also any each more most much not no only other
    same some very just over under between both all one two us me my meaning explain tell give please""".split()
)
# Words that only carry TeX layout.
TEX_NOISE = set("frac dfrac tfrac sqrt text textbf left right cdot times mid quad qquad le ge leq geq pm mp hat bar operatorname displaystyle".split())

# Query-side expansions for common abbreviations.
ABBREVIATIONS = {
    "sd": "standard deviation",
    "std": "standard deviation",
    "se": "standard error",
    "ci": "confidence interval",
    "cis": "confidence intervals",
    "clt": "central limit theorem",
    "lln": "law of large numbers",
    "iqr": "interquartile range",
    "pvalue": "p value",
    "p-value": "p value",
    "r2": "r squared coefficient determination",
    "ols": "least squares regression",
    "h0": "null hypothesis",
    "ha": "alternative hypothesis",
    "pmf": "probability distribution",
    "pdf": "density normal distribution",
    "avg": "mean average",
    "average": "mean average",
}

_word = re.compile(r"[a-z0-9]+")


def stem(token):
    """Very light stemming: plural forms only, so 'intervals' matches 'interval'."""
    if len(token) > 4 and token.endswith("ies"):
        return token[:-3] + "y"
    if len(token) > 4 and token.endswith("ses"):
        return token[:-2]
    if len(token) > 3 and token.endswith("s") and not token.endswith("ss") and not token.endswith("us") and not token.endswith("is"):
        return token[:-1]
    return token


def normalise(text):
    text = text.lower()
    text = text.replace("p-value", "p value").replace("z-score", "z score").replace("t-distribution", "t distribution")
    text = re.sub(r"\\([a-z]+)", r" \1 ", text)  # \sigma -> sigma
    return text


def tokenize(text, expand=False):
    tokens = []
    for raw in _word.findall(normalise(text)):
        if expand and raw in ABBREVIATIONS:
            tokens.extend(stem(t) for t in ABBREVIATIONS[raw].split())
            continue
        if raw in STOPWORDS or raw in TEX_NOISE:
            continue
        tokens.append(stem(raw))
    return tokens


def sentences(text):
    """Split prose into sentences, keeping TeX spans intact."""
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z$*(])", text.strip())
    return [p.strip() for p in parts if len(p.strip()) > 2]

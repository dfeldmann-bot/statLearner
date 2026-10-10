"""Build retrieval passages from curated sources only.

Sources:
  1. the course itself (app/content/sessions/*.json) - written for this repo;
  2. Markdown files in statbot/corpus/ with a front-matter header naming the
     source, URL and licence. Only add text you are allowed to redistribute.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COURSE_DIR = ROOT / "app" / "content"
CORPUS_DIR = ROOT / "statbot" / "corpus"


def _passage(pid, title, text, source, url, license_, context=""):
    """`text` is quotable answer text; `context` (e.g. a question) helps retrieval only."""
    clean = lambda t: re.sub(r"\s+", " ", t).strip()
    return {"id": pid, "title": title, "context": clean(context), "text": clean(text), "source": source, "url": url, "license": license_}


def course_passages(course_dir=COURSE_DIR):
    course = json.loads((course_dir / "course.json").read_text(encoding="utf-8"))
    out = []
    for name in course["sessions"]:
        s = json.loads((course_dir / "sessions" / f"{name}.json").read_text(encoding="utf-8"))
        src = f"statLearner course, session {s['id']}: {s['title']}"
        url = f"app/#/s/{s['id']}"
        lic = "GPL-3.0 (this repository)"
        heading = s["title"]
        for i, b in enumerate(s["blocks"]):
            pid = f"{s['id']}:blocks[{i}]"
            t = b["type"]
            if t == "text":
                # Split long text blocks at headings so passages stay focused.
                for j, chunk in enumerate(re.split(r"\n(?=#{2,4} )", b["md"])):
                    m = re.match(r"#{2,4} (.+)", chunk)
                    if m:
                        heading = m.group(1).strip()
                    body = re.sub(r"^#{2,4} .+\n?", "", chunk).strip()
                    if body:
                        out.append(_passage(f"{pid}.{j}", f"{s['title']} › {heading}", body, src, url, lic))
            elif t == "example":
                body = " ".join(b["steps"] + ([b["reflect"]["answer"]] if b.get("reflect") else []))
                ctx = " ".join([b.get("md", "")] + ([b["reflect"]["prompt"]] if b.get("reflect") else []))
                out.append(_passage(pid, f"{s['title']} › Worked example: {b['title']}", body, src, url, lic, ctx))
            elif t == "callout":
                out.append(_passage(pid, f"{s['title']} › {b['kind'].capitalize()}", b["md"], src, url, lic))
            elif t == "reflect":
                out.append(_passage(pid, f"{s['title']} › {heading}", b["answer"], src, url, lic, b["prompt"]))
            elif t == "check":
                q = b["question"]
                out.append(_passage(pid, f"{s['title']} › Check", q["explain"], src, url, lic, q["prompt"]))
        for q in s["quiz"] + s.get("warmup", []):
            if q["type"] != "generated":
                out.append(_passage(f"{s['id']}:{q['id']}", f"{s['title']} › Question", q["explain"], src, url, lic, q["prompt"]))
        for c in s["cards"]:
            if c["kind"] != "exercise":
                out.append(_passage(f"{s['id']}:{c['id']}", f"{s['title']} › Flashcard", c["back"], src, url, lic, c["front"]))
    return out


def parse_front_matter(text):
    meta = {}
    m = re.match(r"---\n(.*?)\n---\n", text, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        text = text[m.end():]
    return meta, text


def markdown_passages(corpus_dir=CORPUS_DIR):
    out = []
    for path in sorted(corpus_dir.glob("*.md")):
        if path.name.lower() == "readme.md":
            continue
        meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
        missing = [k for k in ("title", "source", "license") if k not in meta]
        if missing:
            raise ValueError(f"{path.name}: front matter is missing {', '.join(missing)}")
        for j, chunk in enumerate(re.split(r"\n(?=## )", body)):
            m = re.match(r"## (.+)", chunk)
            heading = m.group(1).strip() if m else meta["title"]
            text = re.sub(r"^## .+\n?", "", chunk).strip()
            if text:
                out.append(_passage(f"{path.stem}:{j}", f"{meta['title']} › {heading}", text, meta["source"], meta.get("url", ""), meta["license"]))
    return out


def all_passages():
    return course_passages() + markdown_passages()

# Curated corpus

StatBot answers only from passages it finds here and in the course itself (`app/content`).
Add one Markdown file per source. Each file starts with front matter:

```markdown
---
title: Short name shown in citations
source: Who wrote it / where it comes from
url: https://...
license: The licence that allows you to store and quote it
---
## First topic
Text...
```

Rules for the curated corpus:

1. **Only add text you may redistribute.** Openly licensed (CC BY, CC BY-SA, public domain) or your own writing. Check `../sources.json` for vetted candidates.
2. **One topic per `##` section.** Short sections retrieve better than long chapters.
3. **Keep attribution.** The front matter travels with every citation StatBot prints.
4. Rebuild the index after every change: `python -m statbot build`, then `python -m statbot eval`.

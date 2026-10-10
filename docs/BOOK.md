# The book: MacKay, *Information Theory, Inference, and Learning Algorithms*

statLearner follows **David J. C. MacKay, *Information Theory, Inference, and Learning Algorithms*** (Cambridge University Press, 2003), called **ITILA** below.

- **Read it (PDF, author's site):** <https://www.inference.org.uk/itprnn/book.pdf>
- **Book home page** (PDF, errata, exercise solutions, software): <https://www.inference.org.uk/mackay/itila/>
- **In the app:** the **Book** tab links the PDF, the lectures and the session-by-chapter map.

## Why the PDF is not in this repository

The book is © Cambridge University Press 2003. MacKay made the PDF free **for on-screen viewing**; the PDF itself says printing is not permitted, and the usual copyright rules apply. Committing the file to a public GPL repository would redistribute it, so the repository links to the author's copy instead.

For a personal offline copy:

```bash
npm run fetch-book      # downloads to app/book/itila.pdf (git-ignored, never committed)
npm run serve           # the Book tab then shows "Open your local copy"
```

StatBot treats the book as **reference-only**: it is not added to the curated corpus (see `statbot/sources.json`).

## The author

Sir David MacKay (1967-2016) was a Cambridge physicist and Regius Professor of Engineering. His research covered machine learning and information theory, and he invented **Dasher**, an efficient text-entry interface built on information theory. From 2009 to 2014 he was Chief Scientific Advisor to the UK Department of Energy and Climate Change. He also wrote *Sustainable Energy - without the hot air* (2008), which is free to read at <https://www.withouthotair.com>.

## MacKay's lectures (Cambridge, 2012)

Sixteen recorded lectures cover the core of the book: [VideoLectures.net](https://videolectures.net/course_information_theory_pattern_recognition/) · [YouTube playlist](https://www.youtube.com/playlist?list=PLruBu5BI5n4aFpG32iMbdWoRVAA-Vcso6) · [course page with slides and material](https://www.inference.org.uk/itprnn_lectures/) · [2012 slides](https://www.inference.org.uk/itprnn/Slides.shtml)

| # | Lecture | statLearner session |
|---|---|---|
| 1 | [Introduction to information theory](https://videolectures.net/mackay_course_01/) | - |
| 2 | [Entropy and data compression (I): introduction to compression, information content](https://videolectures.net/mackay_course_02/) | 8 |
| 3 | [Entropy and data compression (II): source coding theorem, the bent coin lottery](https://videolectures.net/mackay_course_03/) | 8 |
| 4 | [Entropy and data compression (III): symbol codes](https://videolectures.net/mackay_course_04/) | planned |
| 5 | [Entropy and data compression (IV): arithmetic coding](https://videolectures.net/mackay_course_05/) | - |
| 6 | [Noisy channel coding (I): inference and information measures for noisy channels](https://videolectures.net/mackay_course_06/) | planned |
| 7 | [Noisy channel coding (II): the capacity of a noisy channel](https://videolectures.net/mackay_course_07/) | planned |
| 8 | [Noisy channel coding (III): the noisy-channel coding theorem](https://videolectures.net/mackay_course_08/) | - |
| 9 | [A noisy channel coding gem, and an introduction to Bayesian inference (I)](https://videolectures.net/mackay_course_09/) | 2, 9 |
| 10 | [An introduction to Bayesian inference (II): inference of parameters and models](https://videolectures.net/mackay_course_10/) | 9, 10 |
| 11 | [Approximating probability distributions (I): clustering as an example inference problem](https://videolectures.net/mackay_course_11/) | 11; brief for 14 |
| 12 | [Approximating probability distributions (II): Monte Carlo methods (I)](https://videolectures.net/mackay_course_12/) | 12 |
| 13 | [Approximating probability distributions (III): Monte Carlo methods (II)](https://videolectures.net/mackay_course_13/) | 12 |
| 14 | [Approximating probability distributions (IV): variational methods](https://videolectures.net/mackay_course_14/) | planned |
| 15 | [Data modelling with neural networks (I): feedforward networks](https://videolectures.net/mackay_course_15/) | 7 (background) |
| 16 | [Data modelling with neural networks (II): content-addressable memories and state-of-the-art error-correcting codes](https://videolectures.net/mackay_course_16/) | - |

Titles of lectures 2-5, 7 and 8 follow the 2012 slide list; the others follow the course and video pages. The per-lecture links follow VideoLectures.net's `mackay_course_NN` pattern; if one moves, use the event page or the YouTube playlist.

### Other teaching material by MacKay

- [A short course in information theory](https://www.inference.org.uk/mackay/info-theory/course.html)
- [Presentations by David MacKay](https://www.inference.org.uk/mackay/presentations/)
- [David MacKay's home page](https://www.inference.org.uk/mackay/) (papers, software, older course notes)

## How the course maps to the book

| Session | Topic | ITILA | Lectures |
|---|---|---|---|
| **Part A · Foundations** | | | |
| 1 | Describing data | prerequisite, not in the book | - |
| 2 | Probability rules, Bayes with natural frequencies | ch. 2 (§2.1-2.3) | 9 |
| 3 | Random variables, binomial, normal | ch. 2, ch. 23 | - |
| 4 | Sampling distributions, CLT | background for ch. 4 and ch. 29 | - |
| 5 | Confidence intervals | contrasted in ch. 37 | - |
| 6 | Hypothesis tests | contrasted in ch. 37 | - |
| 7 | Regression | background for part V (ch. 39-45) | 15 |
| **Part B · Information, inference and learning** | | | |
| 8 | Information content and entropy | ch. 2 (§2.4), ch. 4 | 2, 3 |
| 9 | Bayesian inference: the bent coin | ch. 2 (§2.3), ch. 3 (§3.2) | 9, 10 |
| 10 | Model comparison and Occam's razor | ch. 3 (§3.3), ch. 28 | 10 |
| 11 | Maximum likelihood, error bars, the Gaussian | ch. 22, 24, 27 | 11 |
| 12 | Monte Carlo methods | ch. 29 | 12, 13 |
| 13 | Bayesian inference vs sampling theory | ch. 37, 36 | - |

Part A keeps *OpenIntro Statistics* (free, CC BY-SA 3.0) as a companion, because ITILA assumes basic probability and argues against, but does not teach, classical confidence intervals and tests. Every session is open, so a learner who already knows the basics can start with Part B.

## Study plan per Part B session

1. **Before:** skim the chapter sections listed in the session header (the Book tab links the PDF).
2. **Session:** about 30 minutes in the app: prediction question, worked examples, simulations, faded practice, exam.
3. **After:** watch the matching lecture, then try the book's own exercises for that chapter. Many have worked solutions in the book, and they go deeper than the app.
4. **Next days:** flashcard reviews keep the definitions and formulas fresh.

## Planned next sessions (via the authoring pipeline)

| Session | Topic | ITILA | Lecture | Brief |
|---|---|---|---|---|
| 14 | Clustering and soft K-means as inference | ch. 20, 22 | 11 | `authoring/briefs/s14-clustering.json` |
| 15 | Symbol codes and Huffman coding | ch. 5 | 4 | to write |
| 16 | Noisy channels, mutual information, capacity | ch. 8-10 | 6-8 | to write |
| 17 | Variational methods | ch. 33 | 14 | to write |
| 18 | Learning as inference: the single neuron | ch. 38-41 | 15 | to write |

Write each brief **in your own words**: briefs go to Claude and ChatGPT, so never paste text from the book into them.

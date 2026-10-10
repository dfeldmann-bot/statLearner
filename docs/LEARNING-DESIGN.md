# Learning design: what the research says and how statLearner uses it

## Summary

Two techniques have the strongest evidence for durable learning: **retrieval practice** (testing yourself) and **spacing** (spreading practice over days). statLearner builds every screen around them. Worked examples that fade, interleaved practice, prediction questions and explanatory feedback come next. The gamification is deliberately light and rewards those behaviours, never raw clicking.

| # | Method | Evidence (short) | Where statLearner uses it |
|---|---|---|---|
| 1 | Retrieval practice | Rated "high utility" across ages and subjects in a major review (Dunlosky et al., 2013); testing beat re-reading after one week (Roediger & Karpicke, 2006) | Checks inside lessons, mastery quizzes, flashcard reviews, recall warm-ups |
| 2 | Spaced repetition | Meta-analysis of 839 assessments: spaced beats massed practice (Cepeda et al., 2006); optimal gaps grow with the retention interval (Cepeda et al., 2008) | FSRS-6 scheduler for flashcards (`app/src/fsrs.js`); daily review queue |
| 3 | Interleaving | Mixed problem sets beat blocked ones in maths classrooms (Rohrer & Taylor, 2007; Rohrer, Dedrick & Stershic, 2015) | Review queue mixes sessions round-robin; Mixed practice mode; recall warm-ups from earlier sessions |
| 4 | Worked examples, then fading | Novices learn more from studying worked examples than from solving alone (Sweller & Cooper, 1985); gradually removing steps eases the move to independence (Renkl & Atkinson, 2003) | Every practice set: full worked example → half-solved → solve alone |
| 5 | Self-explanation | Learners who explain steps to themselves understand more (Chi et al., 1994; meta-analysis: Bisra et al., 2018) | "Explain it in your own words" prompts with model answers; reflection after worked examples |
| 6 | Pretesting / prediction | Attempting a question before instruction improves later learning, even when the attempt fails (Richland, Kornell & Kao, 2009; Kornell, Hays & Bjork, 2009) | Each session opens with a prediction question; every simulation asks for a prediction first |
| 7 | Simulation-based statistics | GAISE College Report (ASA, 2016): focus on concepts, use technology to explore them; simulation-based inference curricula (Cobb, 2007; Tintle et al., 2011) | 17 simulations: CLT, CI coverage, Bayes grid, bent-coin posterior, Occam's razor, Metropolis sampler, stopping-rule paradox and more |
| 8 | Targeting misconceptions | Students leave intro courses with stable misconceptions about sampling and p-values (delMas et al., 2007); natural frequencies make Bayesian reasoning easier (Gigerenzer & Hoffrage, 1995); ASA statement on p-values (Wasserstein & Lazar, 2016) | Misconception callouts; distractors built from real misconceptions, each with its own feedback; Bayes taught with "imagine 10,000 people" |
| 9 | Immediate, explanatory feedback | Feedback that explains *why* helps more than right/wrong alone (Hattie & Timperley, 2007; Shute, 2008) | Every answer shows an explanation and the full worked solution (opened automatically when wrong) |
| 10 | Mastery learning | Requiring mastery before moving on raises achievement (Bloom, 1984; Kulik, Kulik & Bangert-Drowns, 1990) | 80% quiz pass mark unlocks the next session; retakes draw new numbers |
| 11 | Segmenting / low cognitive load | Learner-paced segments beat continuous presentations (Mayer, 2009) | Lessons reveal one block at a time; text blocks stay short |
| 12 | Gamification, used with care | Small positive effects on cognitive (g = .49), motivational (g = .36) and behavioural (g = .25) outcomes (Sailer & Homner, 2020); tangible rewards for mere task engagement can undermine intrinsic motivation (Deci, Koestner & Ryan, 1999) | XP, levels, streaks, badges tied to learning behaviours; no leaderboards |
| 13 | Implementation intentions for habits | "When X happens, I will do Y" plans have a medium-to-large effect on reaching goals (d = .65; Gollwitzer & Sheeran, 2006) | Onboarding asks for a fixed daily time; calendar reminder (.ics) at that time; optional browser notifications |

## How each piece works in the app

### Spaced repetition with FSRS

statLearner schedules flashcards with **FSRS-6** (Free Spaced Repetition Scheduler), the algorithm Anki has offered since version 23.10. FSRS models each card's memory with two numbers:

- **stability S:** the number of days until the probability of recall drops to 90%;
- **difficulty D:** 1-10; harder cards gain stability more slowly.

After each review the learner grades recall (Again, Hard, Good, Easy). FSRS updates S and D and schedules the next review for the day predicted recall falls to the learner's target (90% by default, adjustable in Settings). With the default parameters, a card answered "Good" every time comes back after about 2, 11, 46 and 163 days. A forgotten card returns after 10 minutes and its stability drops.

In the open-source spaced-repetition benchmark, built on millions of real Anki reviews, FSRS predicts recall more accurately than schedulers based on the older SM-2 algorithm; Ye, Su & Cao (2022) describe the underlying model. statLearner stores every review in the log, so later versions can fit personal FSRS parameters to each learner.

Three card types:

1. **Concept** cards ("What does the SD measure, in words?");
2. **Formula** cards ("Standard error of a sample proportion?");
3. **Exercise** cards: the card generates a fresh problem each time, so the learner must *apply* the formula, not recognise the card. A wrong answer counts as "Again" automatically.

"Mastery" for a session is the share of its cards with stability of at least 21 days. The progress page shows it, and the Long-term memory badge requires 80%.

### Unlimited practice without an LLM

`app/src/exercises.js` and `app/src/exercises-book.js` contain 46 exercise generators. Each draws random but sensible numbers, computes the answer, and writes a step-by-step solution. Learners never run out of practice, quiz retakes use new numbers (so memorising answers does not help), and everything works offline. Tests generate 300 instances of every generator and check that each answer is finite, accepted by the checker and explained.

### Lesson flow

Each session follows the same rhythm:

1. **Recall warm-up:** one fresh problem from each of up to two earlier sessions (spaced retrieval plus interleaving).
2. **Prediction question:** a pretest on the session's key idea; any answer earns XP.
3. **Short explanation → active step** (check, practice, simulation or reflection), repeated.
4. **Worked examples** revealed step by step, with a self-explanation prompt.
5. **Completion:** the session's flashcards join the review deck.
6. **Mastery quiz:** 80% unlocks the next session.

### Gamification rules

| Element | Rule | Why |
|---|---|---|
| XP | Reviews earn 5 XP **whatever the grade**; correct answers 10 (5 with a hint); finishing a session 50; passing a quiz 100 | Honest "Again" grades must never cost points, or learners inflate their grades and break the scheduler |
| Levels | Level L starts at 50·L·(L−1) XP, with playful titles ("Mean Machine", "P-value Pro") | Visible long-term progress |
| Daily goal | Default 50 XP (about 10 minutes); 20 XP bonus when reached | Short daily sessions exploit spacing |
| Streak + freezes | Any activity keeps the streak; every 7-day streak earns a freeze (max 2) that covers a missed day | Habit without anxiety: one bad day does not wipe out weeks |
| Badges | 11 badges for meaningful milestones: first session, perfect quiz, 7/30-day streaks, 100/500 reviews, 80% mastery, comeback after a break | Celebrate learning behaviours, not time spent |
| Not included | Leaderboards, timers, loot boxes | Social comparison and time pressure hurt anxious learners, and the course works alone and offline |

### Reminders without a server

- **Calendar reminder:** a downloadable `.ics` file with a daily recurring event and an alarm at the learner's chosen time. It works in Google Calendar, Apple Calendar and Outlook, on every synced device, with no account or backend.
- **Browser notifications:** when the app is open or installed as a PWA (progressive web app) and cards are due after the reminder time, it shows one notification per day.
- True background push notifications would need a server, which conflicts with the goal of running fully offline. `docs/PLAN.md` lists them as a future option.

## What we deliberately left out

- **Learning styles** (visual, auditory, ...): matching instruction to them has no supporting evidence (Pashler et al., 2008).
- **Highlighting and re-reading** as study methods: rated "low utility" by Dunlosky et al. (2013).
- **Massed practice** ("one long session before the exam"): spacing beats it in nearly every comparison.

## References

- American Statistical Association (2016). *Guidelines for Assessment and Instruction in Statistics Education (GAISE) College Report 2016.*
- Bisra, K., Liu, Q., Nesbit, J. C., Salimi, F., & Winne, P. H. (2018). Inducing self-explanation: A meta-analysis. *Educational Psychology Review, 30*.
- Bloom, B. S. (1984). The 2 sigma problem. *Educational Researcher, 13*(6).
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin, 132*(3).
- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science, 19*(11).
- Chi, M. T. H., de Leeuw, N., Chiu, M.-H., & LaVancher, C. (1994). Eliciting self-explanations improves understanding. *Cognitive Science, 18*(3).
- Cobb, G. W. (2007). The introductory statistics course: A Ptolemaic curriculum? *Technology Innovations in Statistics Education, 1*(1).
- Deci, E. L., Koestner, R., & Ryan, R. M. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin, 125*(6).
- delMas, R., Garfield, J., Ooms, A., & Chance, B. (2007). Assessing students' conceptual understanding after a first course in statistics. *Statistics Education Research Journal, 6*(2).
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest, 14*(1).
- Gigerenzer, G., & Hoffrage, U. (1995). How to improve Bayesian reasoning without instruction: Frequency formats. *Psychological Review, 102*(4).
- Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. *Advances in Experimental Social Psychology, 38*.
- Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research, 77*(1).
- Kornell, N., Hays, M. J., & Bjork, R. A. (2009). Unsuccessful retrieval attempts enhance subsequent learning. *Journal of Experimental Psychology: Learning, Memory, and Cognition, 35*(4).
- Kulik, C.-L. C., Kulik, J. A., & Bangert-Drowns, R. L. (1990). Effectiveness of mastery learning programs: A meta-analysis. *Review of Educational Research, 60*(2).
- Mayer, R. E. (2009). *Multimedia Learning* (2nd ed.). Cambridge University Press.
- Pashler, H., McDaniel, M., Rohrer, D., & Bjork, R. (2008). Learning styles: Concepts and evidence. *Psychological Science in the Public Interest, 9*(3).
- Renkl, A., & Atkinson, R. K. (2003). Structuring the transition from example study to problem solving in cognitive skill acquisition: A cognitive load perspective. *Educational Psychologist, 38*(1).
- Richland, L. E., Kornell, N., & Kao, L. S. (2009). The pretesting effect: Do unsuccessful retrieval attempts enhance learning? *Journal of Experimental Psychology: Applied, 15*(3).
- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science, 17*(3).
- Rohrer, D., Dedrick, R. F., & Stershic, S. (2015). Interleaved practice improves mathematics learning. *Journal of Educational Psychology, 107*(3).
- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science, 35*.
- Sailer, M., & Homner, L. (2020). The gamification of learning: A meta-analysis. *Educational Psychology Review, 32*.
- Shute, V. J. (2008). Focus on formative feedback. *Review of Educational Research, 78*(1).
- Sweller, J., & Cooper, G. A. (1985). The use of worked examples as a substitute for problem solving in learning algebra. *Cognition and Instruction, 2*(1).
- Tintle, N., VanderStoep, J., Holmes, V.-L., Quisenberry, B., & Swanson, T. (2011). Development and assessment of a preliminary randomization-based introductory statistics curriculum. *Journal of Statistics Education, 19*(1).
- Wasserstein, R. L., & Lazar, N. A. (2016). The ASA statement on p-values: Context, process, and purpose. *The American Statistician, 70*(2).
- Ye, J., Su, J., & Cao, Y. (2022). A stochastic shortest path algorithm for optimizing spaced repetition scheduling. *Proceedings of the 28th ACM SIGKDD Conference on Knowledge Discovery and Data Mining*.
- FSRS algorithm documentation: <https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm>

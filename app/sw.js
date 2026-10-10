// Service worker: precache the whole app so it works offline after one visit.
// Strategy: stale-while-revalidate - answer from cache instantly, refresh in the
// background. Bump VERSION when files are added or removed (a test checks the list).
const VERSION = "statlearner-v4";
const PRECACHE = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "icon.svg",
  "content/course.json",
  "content/sessions/s01-describing-data.json",
  "content/sessions/s02-probability.json",
  "content/sessions/s03-random-variables-normal.json",
  "content/sessions/s04-sampling-clt.json",
  "content/sessions/s05-confidence-intervals.json",
  "content/sessions/s06-hypothesis-tests.json",
  "content/sessions/s07-regression.json",
  "content/sessions/s08-information-entropy.json",
  "content/sessions/s09-bayesian-bent-coin.json",
  "content/sessions/s10-model-comparison-occam.json",
  "content/sessions/s11-likelihood-error-bars.json",
  "content/sessions/s12-monte-carlo.json",
  "content/sessions/s13-bayes-vs-sampling-theory.json",
  "content/sessions/s14-clustering.json",
  "src/calc.js",
  "src/calculator.js",
  "src/check.js",
  "src/dom.js",
  "src/exercises-book.js",
  "src/exam.js",
  "src/exercises.js",
  "src/exkit.js",
  "src/fsrs.js",
  "src/game.js",
  "src/main.js",
  "src/markdown.js",
  "src/question.js",
  "src/reminders.js",
  "src/rng.js",
  "src/schema.js",
  "src/simkit.js",
  "src/sims-book.js",
  "src/sims.js",
  "src/srs.js",
  "src/stats.js",
  "src/store.js",
  "vendor/katex/fonts/KaTeX_AMS-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2",
  "vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2",
  "vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Main-Bold.woff2",
  "vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2",
  "vendor/katex/fonts/KaTeX_Main-Italic.woff2",
  "vendor/katex/fonts/KaTeX_Main-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2",
  "vendor/katex/fonts/KaTeX_Math-Italic.woff2",
  "vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2",
  "vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2",
  "vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Script-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Size1-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Size2-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Size3-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Size4-Regular.woff2",
  "vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2",
  "vendor/katex/katex.min.css",
  "vendor/katex/katex.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const fresh = fetch(event.request)
        .then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached ?? fresh;
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => (list.length ? list[0].focus() : self.clients.openWindow("./#/review"))),
  );
});

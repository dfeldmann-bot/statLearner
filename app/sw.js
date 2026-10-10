// Service worker: precache the whole app so it works offline after one visit.
// Keep a complete release together. A new worker waits until existing app tabs
// close before activating. Bump VERSION whenever any app file changes.
const CACHE_PREFIX = `statlearner:${self.registration.scope}:`;
const VERSION = `${CACHE_PREFIX}v7`;
const PRECACHE = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
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
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      return cached ?? fetch(event.request).catch(() => Response.error());
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => (list.length ? list[0].focus() : self.clients.openWindow("./#/review"))),
  );
});

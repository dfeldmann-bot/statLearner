import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../app/sw.js", import.meta.url), "utf8");
const scope = "https://example.com/statLearner/";

function worker({ cached, online = true } = {}) {
  const handlers = {};
  const entries = new Map([["another-app-v1", new Map()]]);
  const cache = {
    addAll: async () => {},
    match: async () => cached && new Response(cached),
    put: async () => {},
  };
  let networkRequests = 0;
  const context = vm.createContext({
    URL, Response,
    self: {
      registration: { scope },
      location: new URL(`${scope}sw.js`),
      addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async (name) => { entries.set(name, cache); return cache; },
      keys: async () => [...entries.keys()],
      delete: async (name) => entries.delete(name),
    },
    fetch: async () => {
      networkRequests++;
      if (!online) throw new TypeError("Offline");
      return new Response("new release");
    },
  });
  vm.runInContext(source, context);
  return { handlers, entries, requests: () => networkRequests };
}

test("activating statLearner preserves other applications' offline caches", async () => {
  const { handlers, entries } = worker();
  let work;
  handlers.activate({ waitUntil: (promise) => { work = promise; } });
  await work;
  assert.ok(entries.has("another-app-v1"));
});

test("cached course files remain on one release while an update is deployed", async () => {
  const { handlers, requests } = worker({ cached: "current release" });
  let response;
  handlers.fetch({ request: new Request(`${scope}src/main.js`), respondWith: (promise) => { response = promise; } });
  assert.equal(await (await response).text(), "current release");
  assert.equal(requests(), 0);
});

test("uncached offline requests produce a network-error response", async () => {
  const { handlers } = worker({ online: false });
  let response;
  handlers.fetch({ request: new Request(`${scope}missing.json`), respondWith: (promise) => { response = promise; } });
  assert.equal((await response)?.type, "error");
});

test("requests for another application are not intercepted", () => {
  const { handlers } = worker();
  let intercepted = false;
  handlers.fetch({ request: new Request("https://example.com/another-app/"), respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
});

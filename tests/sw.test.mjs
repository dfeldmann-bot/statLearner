import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../app");

async function walk(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, base)));
    else out.push(path.relative(base, p).split(path.sep).join("/"));
  }
  return out;
}

test("service worker precaches every app file it needs offline", async () => {
  const sw = await readFile(path.join(appDir, "sw.js"), "utf8");
  const list = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/, "]"));
  const files = (await walk(appDir)).filter((f) => f !== "sw.js" && f !== "vendor/katex/LICENSE");
  for (const f of files) assert.ok(list.includes(f), `sw.js PRECACHE is missing "${f}"`);
  for (const f of list) if (f !== "./") assert.ok(files.includes(f), `sw.js PRECACHE lists missing file "${f}"`);
});

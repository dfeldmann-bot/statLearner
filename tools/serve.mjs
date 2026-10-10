// Minimal static file server for the app (no dependencies).
//   npm run serve            -> http://localhost:8080
//   PORT=3000 npm run serve
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../app");
const port = Number(process.env.PORT ?? 8080);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ics": "text/calendar",
};

createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(root, path.normalize(urlPath));
    if (!file.startsWith(root)) throw Object.assign(new Error("forbidden"), { code: 403 });
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
    res.end(body);
  } catch (e) {
    res.writeHead(e.code === 403 ? 403 : 404, { "content-type": "text/plain" });
    res.end(e.code === 403 ? "Forbidden" : "Not found");
  }
}).listen(port, () => console.log(`statLearner running at http://localhost:${port}`));

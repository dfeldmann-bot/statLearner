// Downloads a personal copy of MacKay's "Information Theory, Inference, and
// Learning Algorithms" from the author's site into app/book/ (git-ignored).
//
//   npm run fetch-book
//
// The book is © Cambridge University Press 2003. The author offers the PDF
// free for on-screen viewing; printing and redistribution are not permitted.
// That is why this repository links to the book instead of including it.
import { mkdir, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const URL_PDF = "https://www.inference.org.uk/itprnn/book.pdf";
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../app/book");
const file = path.join(dir, "itila.pdf");

async function main() {
  const existing = await stat(file).catch(() => null);
  if (!existing) return download();
  console.log(`Already downloaded: ${path.relative(process.cwd(), file)} (${(existing.size / 1e6).toFixed(1)} MB)`);
}

async function download() {
  console.log(`Downloading ${URL_PDF} …`);
  const res = await fetch(URL_PDF);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}. Open ${URL_PDF} in a browser instead.`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.subarray(0, 4).toString() !== "%PDF") throw new Error("The server did not return a PDF.");
  await mkdir(dir, { recursive: true });
  await writeFile(file, bytes);
  console.log(`Saved ${path.relative(process.cwd(), file)} (${(bytes.length / 1e6).toFixed(1)} MB). Personal on-screen use only; please do not commit or redistribute it.`);
  console.log("With `npm run serve`, the app's Book page links to this local copy.");
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exitCode = 1;
});

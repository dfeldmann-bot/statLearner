// Pull a JSON object out of an LLM reply: plain JSON, a ```json fence, or the
// outermost {...} span. Throws with a short excerpt when nothing parses.
export function extractJson(text) {
  const t = String(text ?? "").trim();
  const attempts = [t];
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) attempts.push(fence[1]);
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last > first) attempts.push(t.slice(first, last + 1));
  for (const a of attempts) {
    try {
      return JSON.parse(a);
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error(`Reply is not valid JSON. Starts with: ${t.slice(0, 160)}`);
}

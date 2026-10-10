// Tiny DOM helpers: element builder, Markdown+math rendering, toasts.

import { renderMarkdown } from "./markdown.js";

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

const renderMath = (tex, displayMode) => {
  if (typeof window !== "undefined" && window.katex) {
    try {
      return window.katex.renderToString(tex, { displayMode, throwOnError: false, output: "html" });
    } catch {
      /* fall through to plain TeX */
    }
  }
  const code = document.createElement("code");
  code.className = "tex";
  code.textContent = tex;
  return code.outerHTML;
};

// Markdown -> element (block content).
export function md(markdown, cls = "prose") {
  return h("div", { class: cls, html: renderMarkdown(markdown, { renderMath }) });
}

// Markdown -> inline element (strips the surrounding <p>).
export function mdInline(markdown) {
  const html = renderMarkdown(markdown, { renderMath }).replace(/^<p>([\s\S]*)<\/p>$/, "$1");
  return h("span", { html });
}

let toastHost;
export function toast(message, kind = "info", ms = 2600) {
  if (!toastHost) {
    toastHost = h("div", { class: "toasts", "aria-live": "polite" });
    document.body.append(toastHost);
  }
  const t = h("div", { class: `toast ${kind}` }, message);
  toastHost.append(t);
  while (toastHost.children.length > 3) toastHost.firstChild.remove();
  setTimeout(() => t.classList.add("out"), ms);
  setTimeout(() => t.remove(), ms + 400);
}

export function download(filename, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

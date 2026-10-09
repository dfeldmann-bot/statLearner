// Minimal, safe Markdown renderer for lesson text.
// Supports: paragraphs, #-headings, - and 1. lists, > callouts, pipe tables,
// **bold**, *italic*, `code`, [links](https://...), $inline$ and $$display$$ math.
// All raw HTML is escaped, so content written by people or LLMs cannot inject markup.

const PH = "\u0001";

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const fallbackMath = (tex, display) =>
  display ? `<code class="tex tex-display">${escapeHtml(tex)}</code>` : `<code class="tex">${escapeHtml(tex)}</code>`;

export function renderMarkdown(md, { renderMath = fallbackMath } = {}) {
  const slots = [];
  const stash = (html) => `${PH}${slots.push(html) - 1}${PH}`;

  let text = String(md ?? "").replace(/\r\n?/g, "\n");
  text = text.replace(/\\\$/g, () => stash("$"));
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => stash(`<div class="math-display">${renderMath(tex.trim(), true)}</div>`));
  text = text.replace(/\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (_, tex) => stash(renderMath(tex, false)));
  text = escapeHtml(text);

  const html = renderBlocks(text.split("\n"));
  return html.replace(new RegExp(`${PH}(\\d+)${PH}`, "g"), (_, i) => slots[Number(i)]);
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

const UL = /^\s*[-*]\s+/;
const OL = /^\s*\d+[.)]\s+/;
const TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const isOnlySlot = (s) => new RegExp(`^${PH}\\d+${PH}$`).test(s.trim());

function renderBlocks(lines) {
  const out = [];
  let para = [];
  const flush = () => {
    if (!para.length) return;
    const body = para.join(" ").trim();
    out.push(isOnlySlot(body) ? body : `<p>${inline(body)}</p>`);
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const level = Math.min(6, h[1].length + 1);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    if (UL.test(line) || OL.test(line)) {
      flush();
      const ordered = OL.test(line);
      const marker = ordered ? OL : UL;
      const items = [];
      while (i < lines.length && lines[i].trim()) {
        if (marker.test(lines[i])) items.push(lines[i].replace(marker, ""));
        else if (/^\s+/.test(lines[i]) && items.length) items[items.length - 1] += " " + lines[i].trim();
        else break;
        i++;
      }
      i--;
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (line.trim().startsWith("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++]);
      i--;
      const cells = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => inline(c.trim()));
      const [head, , ...body] = rows;
      out.push(
        `<table><thead><tr>${cells(head).map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body
          .map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
      continue;
    }
    if (line.startsWith("&gt; ") || line === "&gt;") {
      flush();
      const quoted = [];
      while (i < lines.length && lines[i].startsWith("&gt;")) quoted.push(lines[i++].replace(/^&gt;\s?/, ""));
      i--;
      out.push(`<blockquote>${renderBlocks(quoted)}</blockquote>`);
      continue;
    }
    para.push(line);
  }
  flush();
  return out.join("\n");
}

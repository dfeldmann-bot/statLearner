// Shared plumbing for simulations: controls, a DPR-aware canvas, plot helpers.

const css = (name, fallback) =>
  (typeof getComputedStyle !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;
export const colors = () => ({
  text: css("--text", "#1d2433"),
  muted: css("--muted", "#6b7280"),
  grid: css("--border", "#e5e7eb"),
  a: css("--accent", "#4f46e5"),
  b: css("--accent-2", "#f59e0b"),
  ok: css("--ok", "#16a34a"),
  bad: css("--danger", "#dc2626"),
});

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const k of kids) n.append(k);
  return n;
}

// Builds controls and a canvas. Returns { ctl, draw helpers, readout }.
export function frame(root, controls, height = 240) {
  const values = {};
  const panel = el("div", { class: "sim-controls" });
  const listeners = [];
  for (const c of controls) {
    if (c.type === "range") {
      const out = el("output", {}, "");
      const input = el("input", { type: "range", min: c.min, max: c.max, step: c.step ?? 1, value: c.value, "aria-label": c.label });
      const sync = () => {
        values[c.id] = Number(input.value);
        out.textContent = c.format ? c.format(values[c.id]) : input.value;
      };
      input.addEventListener("input", () => {
        sync();
        listeners.forEach((f) => f(c.id));
      });
      sync();
      panel.append(el("label", { class: "sim-range" }, el("span", {}, c.label), input, out));
    } else if (c.type === "select") {
      const sel = el("select", { "aria-label": c.label });
      for (const [v, label] of c.options) sel.append(el("option", { value: v }, label));
      sel.value = c.value;
      values[c.id] = c.value;
      sel.addEventListener("change", () => {
        values[c.id] = sel.value;
        listeners.forEach((f) => f(c.id));
      });
      panel.append(el("label", { class: "sim-range" }, el("span", {}, c.label), sel));
    } else if (c.type === "checkbox") {
      const box = el("input", { type: "checkbox" });
      box.checked = !!c.value;
      values[c.id] = !!c.value;
      box.addEventListener("change", () => {
        values[c.id] = box.checked;
        listeners.forEach((f) => f(c.id));
      });
      panel.append(el("label", { class: "sim-check" }, box, el("span", {}, c.label)));
    } else if (c.type === "button") {
      panel.append(el("button", { class: "btn small", type: "button", onclick: () => listeners.forEach((f) => f(c.id)) }, c.label));
    }
  }
  const canvas = el("canvas", { class: "sim-canvas", role: "img", "aria-label": "simulation plot" });
  const readout = el("div", { class: "sim-readout", "aria-live": "polite" });
  root.append(panel, canvas, readout);
  const width = Math.min(680, Math.max(280, root.clientWidth || 600));
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = "100%";
  canvas.style.maxWidth = `${width}px`;
  canvas.style.aspectRatio = `${width} / ${height}`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const pad = { l: 40, r: 12, t: 12, b: 28 };
  const plot = makePlot(ctx, width, height, pad);
  return { values, onChange: (f) => listeners.push(f), plot, readout };
}

export function makePlot(ctx, W, H, pad) {
  let xr = [0, 1];
  let yr = [0, 1];
  const X = (x) => pad.l + ((x - xr[0]) / (xr[1] - xr[0])) * (W - pad.l - pad.r);
  const Y = (y) => H - pad.b - ((y - yr[0]) / (yr[1] - yr[0])) * (H - pad.t - pad.b);
  return {
    ctx,
    X,
    Y,
    clear(xRange, yRange, { xTicks = 5, yTicks = 0, xLabel = "", integerStep = 0 } = {}) {
      const c = colors();
      xr = xRange;
      yr = yRange;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = c.grid;
      ctx.fillStyle = c.muted;
      ctx.font = "11px system-ui, sans-serif";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, H - pad.b);
      ctx.lineTo(W - pad.r, H - pad.b);
      ctx.stroke();
      ctx.textAlign = "center";
      if (integerStep) {
        for (let v = Math.ceil(xr[0]); v <= xr[1]; v += integerStep) ctx.fillText(String(v), X(v), H - pad.b + 14);
      } else {
        for (let i = 0; i <= xTicks; i++) {
          const v = xr[0] + ((xr[1] - xr[0]) * i) / xTicks;
          ctx.fillText(niceNum(v), X(v), H - pad.b + 14);
        }
      }
      if (xLabel) ctx.fillText(xLabel, (pad.l + W - pad.r) / 2, H - 2);
      ctx.textAlign = "right";
      for (let i = 1; i <= yTicks; i++) {
        const v = yr[0] + ((yr[1] - yr[0]) * i) / yTicks;
        ctx.fillText(niceNum(v), pad.l - 4, Y(v) + 4);
        ctx.beginPath();
        ctx.moveTo(pad.l, Y(v));
        ctx.lineTo(W - pad.r, Y(v));
        ctx.stroke();
      }
    },
    bars(values, x0, width, color, alpha = 0.85) {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      values.forEach((v, i) => {
        const left = X(x0 + i * width);
        const right = X(x0 + (i + 1) * width);
        ctx.fillRect(left + 0.5, Y(v), Math.max(1, right - left - 1), Y(yr[0]) - Y(v));
      });
      ctx.globalAlpha = 1;
    },
    dots(points, color, r = 4) {
      ctx.fillStyle = color;
      for (const [x, y] of points) {
        ctx.beginPath();
        ctx.arc(X(x), Y(y), r, 0, 2 * Math.PI);
        ctx.fill();
      }
    },
    vline(x, color, label) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(X(x), pad.t);
      ctx.lineTo(X(x), H - pad.b);
      ctx.stroke();
      if (label) {
        ctx.fillStyle = color;
        ctx.font = "bold 11px system-ui, sans-serif";
        const nearRight = X(x) > W - pad.r - 80;
        ctx.textAlign = nearRight ? "right" : "left";
        ctx.fillText(label, X(x) + (nearRight ? -4 : 4), pad.t + 10);
      }
    },
    curve(f, color, from = xr[0], to = xr[1], width = 2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const x = from + ((to - from) * i) / 200;
        const px = X(x);
        const py = Y(f(x));
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    },
    segment(x1, y1, x2, y2, color, width = 2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(X(x1), Y(y1));
      ctx.lineTo(X(x2), Y(y2));
      ctx.stroke();
    },
    fillUnder(f, from, to, color) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(X(from), Y(0));
      for (let i = 0; i <= 120; i++) {
        const x = from + ((to - from) * i) / 120;
        ctx.lineTo(X(x), Y(f(x)));
      }
      ctx.lineTo(X(to), Y(0));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    },
  };
}

function niceNum(v) {
  const a = Math.abs(v);
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(0);
  if (a >= 1) return Number(v.toFixed(1)).toString();
  return Number(v.toFixed(2)).toString();
}

export const f2 = (x) => Number(x).toFixed(2);


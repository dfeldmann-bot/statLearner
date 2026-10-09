// Seeded pseudo-random numbers so every generated exercise is reproducible.
// mulberry32: small, fast, good enough for teaching (not for cryptography).

export function makeRng(seed = Date.now()) {
  let a = hashSeed(seed) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng = {
    seed,
    next,
    // Integer in [min, max], both ends included.
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    // Float in [min, max) rounded to `digits` decimals.
    float(min, max, digits = 2) {
      return round(min + next() * (max - min), digits);
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    // Standard normal draw via Box-Muller.
    normal(mean = 0, sd = 1) {
      let u = 0;
      while (u === 0) u = next();
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
  return rng;
}

export function round(x, digits = 2) {
  const f = 10 ** digits;
  return Math.round((x + Number.EPSILON) * f) / f;
}

function hashSeed(seed) {
  if (typeof seed === "number") return seed;
  let h = 2166136261;
  for (const ch of String(seed)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h;
}

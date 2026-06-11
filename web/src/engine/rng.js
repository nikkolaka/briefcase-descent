// Tiny deterministic PRNG. Every slab regenerates identically from its index, so
// the infinite world needs zero stored level data and makes no per-frame garbage.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer hash to decorrelate sequential indices before they seed a generator.
export function hashInt(i) {
  let x = i >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

// A seeded generator for a given slab index.
export function slabRng(index) {
  return mulberry32(hashInt((index | 0) ^ 0x9e3779b9));
}

// Helpers built on a 0..1 generator.
export const rangeOf = (rng) => (min, max) => min + (max - min) * rng();
export const pickOf = (rng) => (arr) => arr[(rng() * arr.length) | 0];

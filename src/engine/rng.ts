/**
 * mulberry32 — small, fast, seedable PRNG. Every deal is identified by its
 * integer seed, which makes deals reproducible (restart-this-deal, daily
 * challenges, deterministic tests). Math.random() is never used for dealing.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh, arbitrary seed for new deals (not used for anything reproducible). */
export function randomSeed(): number {
  return (Date.now() ^ (Math.floor(Math.random() * 0xffffffff) >>> 0)) >>> 0;
}

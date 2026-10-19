/** Small deterministic PRNG (mulberry32) — dummy data and Monte Carlo forecasts are identical on every load. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    const u = Math.max(next(), 1e-9);
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    next,
    normal,
    between: (min: number, max: number) => min + (max - min) * next(),
    int: (min: number, max: number) => Math.floor(min + (max - min + 1) * next()),
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
    /** Log-normal with the given median and spread (sigma of the underlying normal) */
    logNormal: (median: number, sigma: number) => Math.exp(Math.log(median) + sigma * normal()),
    poisson: (lambda: number) => {
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= next();
      } while (p > L);
      return k - 1;
    },
  };
}
export type Rng = ReturnType<typeof createRng>;

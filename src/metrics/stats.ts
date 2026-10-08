export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : NaN);

export function stdev(xs: number[]) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

/** Coefficient of variation (stdev / mean). NaN when undefined. */
export function cv(xs: number[]) {
  const m = mean(xs);
  return m > 0 ? stdev(xs) / m : NaN;
}

/** Percentile with linear interpolation, p in [0, 100]. */
export function percentile(xs: number[], p: number) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export const DAY_MS = 86_400_000;

export type PeriodDays = 30 | 90 | 180;

export interface Window {
  startMs: number;
  endMs: number;
  days: number;
}

/** Current window ending at the snapshot, and the equal-length window before it (for deltas). */
export function windows(asOf: string, days: PeriodDays): { current: Window; previous: Window } {
  const endMs = Date.parse(asOf);
  const startMs = endMs - days * DAY_MS;
  return {
    current: { startMs, endMs, days },
    previous: { startMs: startMs - days * DAY_MS, endMs: startMs, days },
  };
}

export const inWindow = (iso: string | null, w: Window) => {
  if (!iso) return false;
  const t = Date.parse(iso);
  return t > w.startMs && t <= w.endMs;
};

export const daysBetween = (a: string, b: string | number) =>
  ((typeof b === 'number' ? b : Date.parse(b)) - Date.parse(a)) / DAY_MS;

/** Week buckets (7-day) ending at the snapshot, oldest first. */
export function weekBuckets(asOf: string, weeks: number): Window[] {
  const endMs = Date.parse(asOf);
  return Array.from({ length: weeks }, (_, i) => {
    const e = endMs - (weeks - 1 - i) * 7 * DAY_MS;
    return { startMs: e - 7 * DAY_MS, endMs: e, days: 7 };
  });
}

import type { Dataset, Squad } from '../data/model';
import type { MetricId } from './catalogue';
import { DAY_MS } from './period';
import { computeValues } from './scorecard';

export interface TrendOptions {
  points: number;
  stepDays: number;
  windowDays: number;
}

/** Sensible trend windows per metric (sprint-based metrics step by sprint). */
export const TREND_DEFAULTS: Partial<Record<MetricId, TrendOptions>> = {
  sayDo: { points: 12, stepDays: 14, windowDays: 14 },
  scopeChange: { points: 12, stepDays: 14, windowDays: 14 },
  goalHitRate: { points: 12, stepDays: 14, windowDays: 42 },
  velocity: { points: 12, stepDays: 14, windowDays: 14 },
  velocityCv: { points: 8, stepDays: 14, windowDays: 84 },
  throughputCv: { points: 12, stepDays: 14, windowDays: 56 },
};
const FALLBACK: TrendOptions = { points: 12, stepDays: 14, windowDays: 28 };

/** Metric value over trailing windows ending every `stepDays`, oldest first. */
export function metricTrend(data: Dataset, squads: Squad[], id: MetricId, opts: Partial<TrendOptions> = {}) {
  const o = { ...FALLBACK, ...TREND_DEFAULTS[id], ...opts };
  const asOfMs = Date.parse(data.asOf);
  return Array.from({ length: o.points }, (_, i) => {
    const endMs = asOfMs - (o.points - 1 - i) * o.stepDays * DAY_MS;
    const v = computeValues(data, squads, { startMs: endMs - o.windowDays * DAY_MS, endMs: endMs - 1, days: o.windowDays });
    return { endMs, value: v[id] };
  });
}

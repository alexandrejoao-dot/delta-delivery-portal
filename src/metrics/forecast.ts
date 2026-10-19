import type { WorkItem } from '../data/model';
import { createRng } from '../lib/rng';
import { DAY_MS, type Window } from './period';
import { percentile } from './stats';

export const FORECAST = {
  /** Horizon being forecast — one sprint */
  horizonDays: 14,
  /** Throughput history sampled from */
  historyDays: 84,
  /** "At least N items" with this confidence */
  confidence: 85,
  trials: 2000,
};

/** Items finished on each of the `days` days ending at `endMs`, oldest first. */
export function dailyThroughput(items: WorkItem[], endMs: number, days: number): number[] {
  const counts = new Array<number>(days).fill(0);
  const startMs = endMs - days * DAY_MS;
  for (const i of items) {
    if (!i.doneAt) continue;
    const t = Date.parse(i.doneAt);
    if (t <= startMs || t > endMs) continue;
    counts[Math.min(days - 1, Math.floor((t - startMs) / DAY_MS))]++;
  }
  return counts;
}

/**
 * Monte Carlo "how many?" forecast: resample past daily throughput to simulate the horizon many times.
 * Returns the item count reached in `confidence`% of trials (the (100 − confidence)th percentile).
 * Seeded, so the same history always gives the same forecast.
 */
export function forecastItems(daily: number[], horizonDays = FORECAST.horizonDays, confidence = FORECAST.confidence, trials = FORECAST.trials) {
  if (!daily.length || daily.every((d) => d === 0)) return NaN;
  const rng = createRng(daily.length * 7919 + daily.reduce((a, b) => a + b, 0));
  const totals = Array.from({ length: trials }, () => {
    let sum = 0;
    for (let d = 0; d < horizonDays; d++) sum += daily[Math.floor(rng.next() * daily.length)];
    return sum;
  });
  return Math.floor(percentile(totals, 100 - confidence));
}

export const deliveryForecast = (items: WorkItem[], w: Window) =>
  forecastItems(dailyThroughput(items, w.endMs, FORECAST.historyDays));

/** Backtests use fewer trials — many forecasts per window, and a hit/miss needs less precision. */
const BACKTEST_TRIALS = 500;
const WEEK_MS = 7 * DAY_MS;

/**
 * Forecasting accuracy: replay the forecast weekly in the past and check it.
 * For each week whose 14-day horizon ends inside the window, forecast "at least N items" (85%) from the
 * history available at that moment, then compare with what was actually finished.
 * Returns the share of forecasts met. A well-calibrated 85% forecast is met ~85% of the time.
 */
export function forecastBacktest(items: WorkItem[], w: Window) {
  const H = FORECAST.horizonDays * DAY_MS;
  const results: { madeAtMs: number; forecast: number; actual: number; met: boolean }[] = [];
  for (let end = w.endMs; end > w.startMs; end -= WEEK_MS) {
    const madeAtMs = end - H;
    const forecast = forecastItems(dailyThroughput(items, madeAtMs, FORECAST.historyDays), FORECAST.horizonDays, FORECAST.confidence, BACKTEST_TRIALS);
    if (!Number.isFinite(forecast)) continue;
    const actual = items.filter((i) => i.doneAt && Date.parse(i.doneAt) > madeAtMs && Date.parse(i.doneAt) <= end).length;
    results.push({ madeAtMs, forecast, actual, met: actual >= forecast });
  }
  return results.reverse();
}

export function forecastAccuracy(items: WorkItem[], w: Window) {
  const r = forecastBacktest(items, w);
  return r.length ? r.filter((x) => x.met).length / r.length : NaN;
}

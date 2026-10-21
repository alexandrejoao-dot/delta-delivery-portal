import type { MetricId, Unit } from '../metrics/catalogue';
import { METRICS } from '../metrics/catalogue';

export function formatValue(v: number, unit: Unit, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(v)) return '—';
  switch (unit) {
    case 'percent':
      return `${Math.round(v * 100)}%`;
    case 'days':
      return opts.compact ? `${v.toFixed(1)}d` : `${v.toFixed(1)} days`;
    case 'points':
      return `${Math.round(v)} pts`;
    case 'perWeek':
      return opts.compact ? v.toFixed(1) : `${v.toFixed(1)} / wk`;
    case 'count':
      return `${Math.round(v)}`;
    case 'index':
      return `${Math.round(v)}`;
    case 'score':
      return opts.compact ? v.toFixed(1) : `${v.toFixed(1)} / 5`;
    case 'items':
      return opts.compact ? `${Math.round(v)}` : `${Math.round(v)} items`;
  }
}

/**
 * Whole percentages that add up to exactly 100 (largest remainder), so a breakdown never reads 99% or 101%.
 * Non-finite shares stay NaN and are left out of the total.
 */
export function roundPercents(shares: number[]): number[] {
  const finite = shares.map((v) => (Number.isFinite(v) ? v * 100 : NaN));
  const total = Math.round(finite.filter(Number.isFinite).reduce((a, b) => a + b, 0));
  const floors = finite.map((v) => (Number.isFinite(v) ? Math.floor(v) : NaN));
  let missing = total - floors.filter(Number.isFinite).reduce((a, b) => a + b, 0);
  const byRemainder = finite
    .map((v, i) => ({ i, r: Number.isFinite(v) ? v - Math.floor(v) : -1 }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => b.r - a.r);
  for (const { i } of byRemainder) {
    if (missing <= 0) break;
    floors[i] += 1;
    missing--;
  }
  return floors;
}

export const formatMetric = (id: MetricId, v: number, compact = false) => formatValue(v, METRICS[id].unit, { compact });

/** Signed delta text in the metric's unit (pp for percentages). */
export function formatDelta(id: MetricId, curr: number, prev: number): string | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  const unit = METRICS[id].unit;
  const d = curr - prev;
  const shown =
    unit === 'percent'
      ? Math.round(Math.abs(d) * 100)
      : unit === 'points' || unit === 'count' || unit === 'index' || unit === 'items'
        ? Math.round(Math.abs(d))
        : Number(Math.abs(d).toFixed(1));
  if (shown === 0) return unit === 'percent' ? '±0 pp' : unit === 'days' ? '±0.0d' : '±0';
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  const abs = Math.abs(d);
  switch (unit) {
    case 'percent':
      return `${sign}${Math.round(abs * 100)} pp`;
    case 'days':
      return `${sign}${abs.toFixed(1)}d`;
    case 'points':
      return `${sign}${Math.round(abs)} pts`;
    case 'perWeek':
      return `${sign}${abs.toFixed(1)}/wk`;
    case 'count':
    case 'index':
    case 'items':
      return `${sign}${Math.round(abs)}`;
    case 'score':
      return `${sign}${abs.toFixed(1)}`;
  }
}

export const shortDate = (ms: number | string) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const longDate = (ms: number | string) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Download rows as CSV (client-side, no server). */
export function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

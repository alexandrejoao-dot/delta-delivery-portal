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
  }
}

export const formatMetric = (id: MetricId, v: number, compact = false) => formatValue(v, METRICS[id].unit, { compact });

/** Signed delta text in the metric's unit (pp for percentages). */
export function formatDelta(id: MetricId, curr: number, prev: number): string | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  const unit = METRICS[id].unit;
  const d = curr - prev;
  const shown = unit === 'percent' ? Math.round(Math.abs(d) * 100) : unit === 'points' || unit === 'count' ? Math.round(Math.abs(d)) : Number(Math.abs(d).toFixed(1));
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
      return `${sign}${Math.round(abs)}`;
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

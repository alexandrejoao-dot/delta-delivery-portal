import { linear } from './chartKit';

/** Decorative trend line for KPI tiles; the tile itself carries the number and label. */
export function Sparkline({ values, color = '#2a78d6', width = 96, height = 32 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const vals = values.filter(Number.isFinite);
  if (vals.length < 2) return null;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || 1;
  const x = linear(0, vals.length - 1, 2, width - 4);
  const y = linear(lo - pad, hi + pad, height - 2, 2);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r={3} fill={color} stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Tiny SVG chart toolkit — no chart library, so the bundle stays small and every pixel is ours.
 * Conventions (from the dataviz guidelines): thin marks, 2px lines, recessive grid,
 * one y-axis only, hover tooltip on every chart, legend for ≥2 series.
 */

export const CHART = {
  grid: '#e6e8ea',
  axis: '#75777d',
  text: '#45474c',
  surface: '#ffffff',
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
  target: '#75777d',
};

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

export const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** "Nice" tick values for a 0-based or arbitrary domain. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-sm text-on-surface-variant">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.dashed ? (
            <svg width="16" height="8" aria-hidden>
              <line x1="0" y1="4" x2="16" y2="4" stroke={it.color} strokeWidth="2" strokeDasharray="3 3" />
            </svg>
          ) : (
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Tooltip positioned inside a relative container, flipped to stay in bounds. */
export function ChartTooltip({
  x,
  y,
  containerWidth,
  children,
}: {
  x: number;
  y: number;
  containerWidth: number;
  children: ReactNode;
}) {
  const flip = x > containerWidth * 0.6;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[140px] rounded-md border border-outline-variant bg-white px-3 py-2 text-label-sm text-on-surface shadow-[0_4px_12px_-2px_rgb(0_0_0/0.12)]"
      style={{
        left: flip ? undefined : x + 12,
        right: flip ? containerWidth - x + 12 : undefined,
        top: Math.max(0, y - 12),
      }}
    >
      {children}
    </div>
  );
}

export function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="inline-flex items-center gap-1.5 text-on-surface-variant">
        {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
      </span>
      <span className="tabular font-semibold text-on-surface">{value}</span>
    </div>
  );
}

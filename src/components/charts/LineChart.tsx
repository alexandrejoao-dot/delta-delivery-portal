import { useState, type MouseEvent } from 'react';
import { CHART, ChartTooltip, Legend, linear, niceTicks, TooltipRow, useElementWidth } from './chartKit';

export interface LineSeries {
  id: string;
  label: string;
  color?: string;
  /** Points share the same x positions across series (index-aligned). */
  values: (number | null)[];
}

interface Props {
  xLabels: string[];
  series: LineSeries[];
  height?: number;
  yFormat: (v: number) => string;
  yMin?: number;
  yMax?: number;
  target?: { value: number; label: string };
  area?: boolean;
  ariaLabel: string;
}

const M = { top: 12, right: 16, bottom: 28, left: 44 };

export function LineChart({ xLabels, series, height = 240, yFormat, yMin, yMax, target, area, ariaLabel }: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = xLabels.length;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)));
  if (target) all.push(target.value);
  const lo = yMin ?? Math.min(0, ...all);
  const hi = yMax ?? Math.max(...all, lo + 1) * 1.08;
  const ticks = niceTicks(lo, hi, 4).filter((t) => t >= lo && t <= hi * 1.001);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const x = linear(0, Math.max(1, n - 1), M.left, M.left + innerW);
  const y = linear(lo, hi, M.top + innerH, M.top);
  const colors = series.map((s, i) => s.color ?? CHART.series[i % CHART.series.length]);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 64))));

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const idx = Math.round((px / rect.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  };

  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  return (
    <div className="flex flex-col gap-3">
      {series.length > 1 || target ? (
        <Legend
          items={[
            ...series.map((s, i) => ({ label: s.label, color: colors[i] })),
            ...(target ? [{ label: target.label, color: CHART.target, dashed: true }] : []),
          ]}
        />
      ) : null}
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} stroke={CHART.grid} />
                <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill={CHART.text} className="tabular">
                  {yFormat(t)}
                </text>
              </g>
            ))}
            {xLabels.map((l, i) =>
              i % labelEvery === 0 || i === n - 1 ? (
                <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill={CHART.text}>
                  {l}
                </text>
              ) : null,
            )}
            {target && (
              <line
                x1={M.left}
                x2={M.left + innerW}
                y1={y(target.value)}
                y2={y(target.value)}
                stroke={CHART.target}
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
            )}
            {area &&
              series.length === 1 &&
              (() => {
                const d = path(series[0].values);
                if (!d) return null;
                const firstIdx = series[0].values.findIndex((v) => v !== null);
                const lastIdx = series[0].values.length - 1 - [...series[0].values].reverse().findIndex((v) => v !== null);
                return (
                  <path
                    d={`${d}L${x(lastIdx)},${y(lo)}L${x(firstIdx)},${y(lo)}Z`}
                    fill={colors[0]}
                    opacity={0.08}
                  />
                );
              })()}
            {series.map((s, i) => (
              <path key={s.id} d={path(s.values)} fill="none" stroke={colors[i]} strokeWidth={2} strokeLinejoin="round" />
            ))}
            {hover !== null && (
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} stroke={CHART.axis} strokeWidth={1} opacity={0.5} />
            )}
            {series.map((s, i) =>
              s.values.map((v, j) =>
                v !== null && Number.isFinite(v) && (hover === j || n <= 16) ? (
                  <circle
                    key={`${s.id}-${j}`}
                    cx={x(j)}
                    cy={y(v)}
                    r={hover === j ? 5 : 3.5}
                    fill={hover === j ? colors[i] : CHART.surface}
                    stroke={hover === j ? CHART.surface : colors[i]}
                    strokeWidth={2}
                  />
                ) : null,
              ),
            )}
            <rect
              x={M.left}
              y={M.top}
              width={innerW}
              height={innerH}
              fill="transparent"
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
            />
          </svg>
        )}
        {hover !== null && (
          <ChartTooltip x={x(hover)} y={M.top} containerWidth={width}>
            <div className="mb-1 font-semibold">{xLabels[hover]}</div>
            {series.map((s, i) => (
              <TooltipRow
                key={s.id}
                color={colors[i]}
                label={s.label}
                value={s.values[hover] === null || !Number.isFinite(s.values[hover]!) ? '—' : yFormat(s.values[hover]!)}
              />
            ))}
            {target && <TooltipRow label={target.label} value={yFormat(target.value)} />}
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}

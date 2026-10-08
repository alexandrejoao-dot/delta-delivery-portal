import { useState } from 'react';
import { CHART, ChartTooltip, Legend, linear, niceTicks, TooltipRow, useElementWidth } from './chartKit';

export interface BarSeries {
  id: string;
  label: string;
  color?: string;
  values: number[];
}

interface Props {
  xLabels: string[];
  series: BarSeries[];
  height?: number;
  yFormat: (v: number) => string;
  /** Optional dashed reference line (e.g. an average) */
  reference?: { value: number; label: string };
  ariaLabel: string;
  /** Extra tooltip lines per x index */
  tooltipExtra?: (i: number) => { label: string; value: string }[];
}

const M = { top: 12, right: 12, bottom: 28, left: 44 };

/** Grouped (never stacked) bars, anchored at zero, 2px gap between adjacent bars. */
export function BarChart({ xLabels, series, height = 240, yFormat, reference, ariaLabel, tooltipExtra }: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = xLabels.length;
  const max = (Math.max(...series.flatMap((s) => s.values), reference?.value ?? 0) || 1) * 1.1;
  const ticks = niceTicks(0, max, 4).filter((t) => t <= max);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const y = linear(0, max, M.top + innerH, M.top);
  const band = innerW / Math.max(1, n);
  const groupPad = Math.min(12, band * 0.25);
  const barW = Math.max(2, (band - groupPad - (series.length - 1) * 2) / series.length);
  const colors = series.map((s, i) => s.color ?? CHART.series[i % CHART.series.length]);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 56))));
  const r = Math.min(4, barW / 2);

  /** Bar with rounded top only (data-end rounded, baseline square). */
  const barPath = (bx: number, by: number, bw: number, bh: number) => {
    if (bh <= 0) return '';
    const rr = Math.min(r, bh);
    return `M${bx},${by + bh}V${by + rr}Q${bx},${by} ${bx + rr},${by}H${bx + bw - rr}Q${bx + bw},${by} ${bx + bw},${by + rr}V${by + bh}Z`;
  };

  return (
    <div className="flex flex-col gap-3">
      {series.length > 1 || reference ? (
        <Legend
          items={[
            ...series.map((s, i) => ({ label: s.label, color: colors[i] })),
            ...(reference ? [{ label: reference.label, color: CHART.target, dashed: true }] : []),
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
            {xLabels.map((l, i) => {
              const gx = M.left + i * band;
              return (
                <g key={i}>
                  {hover === i && <rect x={gx} y={M.top} width={band} height={innerH} fill="#f0f7ff" />}
                  {series.map((s, si) => {
                    const v = s.values[i] ?? 0;
                    const bx = gx + groupPad / 2 + si * (barW + 2);
                    return <path key={s.id} d={barPath(bx, y(v), barW, y(0) - y(v))} fill={colors[si]} />;
                  })}
                  {(i % labelEvery === 0 || i === n - 1) && (
                    <text x={gx + band / 2} y={height - 8} textAnchor="middle" fontSize="11" fill={CHART.text}>
                      {l}
                    </text>
                  )}
                  <rect
                    x={gx}
                    y={M.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              );
            })}
            <line x1={M.left} x2={M.left + innerW} y1={y(0)} y2={y(0)} stroke={CHART.axis} />
            {reference && (
              <line
                x1={M.left}
                x2={M.left + innerW}
                y1={y(reference.value)}
                y2={y(reference.value)}
                stroke={CHART.target}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                pointerEvents="none"
              />
            )}
          </svg>
        )}
        {hover !== null && (
          <ChartTooltip x={M.left + (hover + 0.5) * band} y={M.top} containerWidth={width}>
            <div className="mb-1 font-semibold">{xLabels[hover]}</div>
            {series.map((s, i) => (
              <TooltipRow key={s.id} color={colors[i]} label={s.label} value={yFormat(s.values[hover] ?? 0)} />
            ))}
            {tooltipExtra?.(hover).map((r) => <TooltipRow key={r.label} label={r.label} value={r.value} />)}
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}

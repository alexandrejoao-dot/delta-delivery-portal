import { useMemo, useState, type MouseEvent } from 'react';
import { CHART, ChartTooltip, Legend, linear, niceTicks, TooltipRow, useElementWidth } from './chartKit';

export interface ScatterPoint {
  x: number; // epoch ms
  y: number;
  id: string;
  label: string;
  meta?: string;
}

interface Props {
  points: ScatterPoint[];
  xDomain: [number, number];
  xFormat: (ms: number) => string;
  yFormat: (v: number) => string;
  yLabel: string;
  references?: { value: number; label: string; color?: string }[];
  height?: number;
  ariaLabel: string;
}

const M = { top: 12, right: 16, bottom: 28, left: 44 };

/** Cycle-time scatter: one dot per finished item, percentile lines as references. */
export function ScatterChart({ points, xDomain, xFormat, yFormat, yLabel, references = [], height = 280, ariaLabel }: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<ScatterPoint | null>(null);
  const yMax = Math.max(1, ...points.map((p) => p.y), ...references.map((r) => r.value)) * 1.05;
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const x = linear(xDomain[0], xDomain[1], M.left, M.left + innerW);
  const y = linear(0, yMax, M.top + innerH, M.top);
  const yTicks = niceTicks(0, yMax, 4).filter((t) => t <= yMax);
  const xTicks = useMemo(() => {
    const count = Math.max(2, Math.floor(innerW / 90));
    return Array.from({ length: count + 1 }, (_, i) => xDomain[0] + ((xDomain[1] - xDomain[0]) * i) / count);
  }, [innerW, xDomain]);
  const refColors = ['#1c5cab', '#eb6834'];

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + M.left;
    const py = e.clientY - rect.top + M.top;
    let best: ScatterPoint | null = null;
    let bestD = 24 * 24;
    for (const p of points) {
      const d = (x(p.x) - px) ** 2 + (y(p.y) - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    setHover(best);
  };

  return (
    <div className="flex flex-col gap-3">
      <Legend
        items={[
          { label: yLabel, color: CHART.series[0] },
          ...references.map((r, i) => ({ label: r.label, color: r.color ?? refColors[i % 2], dashed: true })),
        ]}
      />
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={ariaLabel}>
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} stroke={CHART.grid} />
                <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill={CHART.text}>
                  {Math.round(t)}d
                </text>
              </g>
            ))}
            {xTicks.map((t, i) => (
              <text
                key={i}
                x={x(t)}
                y={height - 8}
                textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
                fontSize="11"
                fill={CHART.text}
              >
                {xFormat(t)}
              </text>
            ))}
            {points.map((p) => (
              <circle
                key={p.id}
                cx={x(p.x)}
                cy={y(p.y)}
                r={hover?.id === p.id ? 6 : 4}
                fill={CHART.series[0]}
                fillOpacity={hover?.id === p.id ? 1 : 0.55}
                stroke={CHART.surface}
                strokeWidth={1.5}
              />
            ))}
            {references.map((r, i) => (
              <g key={r.label}>
                <line
                  x1={M.left}
                  x2={M.left + innerW}
                  y1={y(r.value)}
                  y2={y(r.value)}
                  stroke={r.color ?? refColors[i % 2]}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                />
                <text
                  x={M.left + 6}
                  y={y(r.value) - 5}
                  fontSize="11"
                  fontWeight={600}
                  fill={CHART.text}
                  stroke={CHART.surface}
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {r.label}: {yFormat(r.value)}
                </text>
              </g>
            ))}
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
        {hover && (
          <ChartTooltip x={x(hover.x)} y={y(hover.y)} containerWidth={width}>
            <div className="mb-1 font-semibold">{hover.label}</div>
            {hover.meta && <div className="mb-1 max-w-[220px] text-on-surface-variant">{hover.meta}</div>}
            <TooltipRow label="Finished" value={xFormat(hover.x)} />
            <TooltipRow color={CHART.series[0]} label={yLabel} value={yFormat(hover.y)} />
          </ChartTooltip>
        )}
      </div>
    </div>
  );
}

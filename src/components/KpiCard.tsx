import type { ReactNode } from 'react';
import { isImprovement, METRICS, type MetricId } from '../metrics/catalogue';
import type { Scorecard } from '../metrics/scorecard';
import { formatDelta, formatMetric } from '../lib/format';
import { Sparkline } from './charts/Sparkline';
import { DeltaChip, InfoTip, StatusBadge } from './ui';

interface Props {
  metricId: MetricId;
  sc: Scorecard;
  trend?: number[];
  icon?: ReactNode;
  periodLabel: string;
  /** Override the headline label */
  label?: string;
}

/** KPI tile: label, hero number, delta vs previous period, status, sparkline. */
export function KpiCard({ metricId, sc, trend, icon, periodLabel, label }: Props) {
  const def = METRICS[metricId];
  const curr = sc.current[metricId];
  const prev = sc.previous[metricId];
  const status = sc.status[metricId] ?? 'none';
  const big = formatMetric(metricId, curr, true);
  const [num, suffix] = def.unit === 'days' ? [big.replace(/d$/, ''), 'd'] : def.unit === 'perWeek' ? [big, '/wk'] : [big, ''];
  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
      <div className="pointer-events-none absolute -right-14 -top-14 h-32 w-32 rounded-bl-full bg-primary-fixed/30" />
      <div className="relative flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-label-md uppercase text-on-surface-variant">
          {label ?? def.name}
          <InfoTip text={`${def.description} ${def.caveat ?? ''}`} />
        </h3>
        <span className="text-[22px] text-primary">{icon}</span>
      </div>
      <div className="relative mt-3 flex items-end justify-between gap-3">
        <div className="text-display-lg tabular text-on-surface">
          {num}
          {suffix && <span className="ml-0.5 text-headline-sm font-medium text-on-surface-variant">{suffix}</span>}
        </div>
        {trend && <Sparkline values={trend} />}
      </div>
      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <DeltaChip text={formatDelta(metricId, curr, prev)} improved={isImprovement(metricId, curr, prev)} />
          <span className="text-label-sm text-on-surface-variant">vs prev. {periodLabel}</span>
        </span>
        {status !== 'none' && <StatusBadge status={status} size="sm" />}
      </div>
    </div>
  );
}

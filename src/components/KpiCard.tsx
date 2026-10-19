import type { ReactNode } from 'react';
import { isImprovement, METRICS, type MetricId } from '../metrics/catalogue';
import type { Scorecard } from '../metrics/scorecard';
import { formatDelta, formatMetric } from '../lib/format';
import { Sparkline } from './charts/Sparkline';
import { cx, DeltaChip, InfoTip, StatusBadge } from './ui';
import { Link, navigate } from '../lib/router';
import { MdArrowForward } from 'react-icons/md';

interface Props {
  metricId: MetricId;
  sc: Scorecard;
  trend?: number[];
  icon?: ReactNode;
  periodLabel: string;
  /** Override the headline label */
  label?: string;
  /** Extra context under the status row (e.g. what drives the number) */
  footer?: ReactNode;
  /** Make the whole tile a link to this route */
  to?: string;
  /** Accessible name for the link, e.g. "Open Predictability" */
  toLabel?: string;
  /** Narrow tiles (5 in a row): smaller sparkline */
  compact?: boolean;
}

const SUFFIX: Partial<Record<string, string>> = { perWeek: '/wk', index: '/100', score: '/5' };

/** KPI tile: label, hero number, delta vs previous period, status, sparkline. */
export function KpiCard({ metricId, sc, trend, icon, periodLabel, label, footer, to, toLabel, compact }: Props) {
  const def = METRICS[metricId];
  const curr = sc.current[metricId];
  const prev = sc.previous[metricId];
  const status = sc.status[metricId] ?? 'none';
  const big = formatMetric(metricId, curr, true);
  const [num, suffix] = def.unit === 'days' ? [big.replace(/d$/, ''), 'd'] : [big, Number.isFinite(curr) ? (SUFFIX[def.unit] ?? '') : ''];
  return (
    <div
      className={cx(
        'group/card relative flex flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-5',
        to && 'cursor-pointer transition-colors hover:border-outline focus-within:border-outline',
      )}
      onClick={
        to
          ? (e) => {
              // The inner link handles its own clicks (incl. cmd/ctrl-click to open a new tab)
              if (e.metaKey || e.ctrlKey || (e.target as HTMLElement).closest('a')) return;
              navigate(to);
            }
          : undefined
      }
    >
      {to && (
        // Keyboard / screen-reader entry point; the whole tile is clickable for the mouse
        <Link to={to} className="absolute inset-0 z-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-series-1/40" title={toLabel}>
          <span className="sr-only">{toLabel ?? 'Open'}</span>
        </Link>
      )}
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
        {trend && <Sparkline values={trend} width={compact ? 60 : 96} />}
      </div>
      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <DeltaChip text={formatDelta(metricId, curr, prev)} improved={isImprovement(metricId, curr, prev)} />
          <span className="text-label-sm text-on-surface-variant">vs prev. {periodLabel}</span>
        </span>
        {status !== 'none' && <StatusBadge status={status} size="sm" />}
      </div>
      {footer && <div className="relative mt-4 border-t border-surface-container pt-3 text-label-sm text-on-surface-variant">{footer}</div>}
      {to && toLabel && (
        <div className="relative mt-auto flex items-center gap-1 pt-3 text-label-md text-series-1 opacity-80 group-hover/card:opacity-100">
          {toLabel}
          <MdArrowForward className="text-[14px] transition-transform group-hover/card:translate-x-0.5" aria-hidden />
        </div>
      )}
    </div>
  );
}

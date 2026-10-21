import { useState, type ReactNode } from 'react';
import { WORK_CATEGORIES, type WorkCategory } from '../data/model';
import { formatDelta, roundPercents } from '../lib/format';
import { METRICS } from '../metrics/catalogue';
import { CHART } from './charts/chartKit';
import { DeltaChip, InfoTip, cx } from './ui';

interface Props {
  current: Record<WorkCategory, number>;
  previous: Record<WorkCategory, number>;
  periodLabel: string;
  icon?: ReactNode;
}

/**
 * KPI tile for development categories: headline OKR-aligned share, a 100% bar of the mix
 * and a labelled row per category. No status — the mix is a conversation, not a target.
 */
export function CategoryMixCard({ current, previous, periodLabel, icon }: Props) {
  const def = METRICS.okrShare;
  const [hover, setHover] = useState<WorkCategory | null>(null);
  const colour = (i: number) => (WORK_CATEGORIES[i].id === 'none' ? CHART.neutral : CHART.series[i]);
  // Rounded together so the rows always add up to 100%
  const shown = roundPercents(WORK_CATEGORIES.map((c) => current[c.id]));
  const shownPct = (i: number) => (Number.isFinite(shown[i]) ? `${shown[i]}%` : '—');
  const hasData = WORK_CATEGORIES.some((c) => Number.isFinite(current[c.id]));

  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
      <div className="pointer-events-none absolute -right-14 -top-14 h-32 w-32 rounded-bl-full bg-primary-fixed/30" />
      <div className="relative flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-label-md uppercase text-on-surface-variant">
          {def.name}
          <InfoTip text={`${def.description} ${def.caveat ?? ''}`} />
        </h3>
        <span className="text-[22px] text-primary">{icon}</span>
      </div>
      <div className="relative mt-3 flex items-end gap-2">
        <div className="text-display-lg tabular text-on-surface">{shownPct(WORK_CATEGORIES.findIndex((c) => c.id === 'okr'))}</div>
        <span className="mb-1.5 text-body-sm text-on-surface-variant">OKR aligned</span>
      </div>

      {hasData && (
        <>
          {/* 100% bar, 2px surface gaps between segments */}
          <div className="relative mt-3 flex h-2.5 w-full gap-[2px]" role="img" aria-label="Development category mix">
            {WORK_CATEGORIES.map((c, i) => {
              const v = current[c.id];
              if (!Number.isFinite(v) || v <= 0) return null;
              return (
                <div
                  key={c.id}
                  className={cx('h-full first:rounded-l last:rounded-r transition-opacity', hover && hover !== c.id && 'opacity-35')}
                  style={{ width: `${v * 100}%`, background: colour(i) }}
                  onMouseEnter={() => setHover(c.id)}
                  onMouseLeave={() => setHover(null)}
                  title={`${c.label}: ${shownPct(i)}`}
                />
              );
            })}
          </div>
          <ul className="relative mt-3 flex flex-col gap-1">
            {WORK_CATEGORIES.map((c, i) => (
              <li
                key={c.id}
                className={cx('-mx-1.5 flex items-center justify-between gap-2 rounded px-1.5 py-0.5 text-label-sm', hover === c.id && 'bg-surface-container-low')}
                onMouseEnter={() => setHover(c.id)}
                onMouseLeave={() => setHover(null)}
              >
                <span className="inline-flex items-center gap-1.5 text-on-surface-variant">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colour(i) }} />
                  {c.label}
                </span>
                <span className="flex items-center gap-2">
                  <DeltaChip text={formatDelta('okrShare', current[c.id], previous[c.id])} improved={null} />
                  <span className="w-9 text-right tabular font-semibold text-on-surface">{shownPct(i)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="relative mt-2 text-label-sm text-outline">Share of items finished · change vs prev. {periodLabel}</p>
        </>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { MdFilterList, MdOutlineDonutSmall, MdOutlineMonitorHeart, MdOutlineSentimentSatisfied, MdOutlineTimer } from 'react-icons/md';
import { CategoryMixCard } from '../components/CategoryMixCard';
import { HighlightsCard } from '../components/HighlightsCard';
import { InsightsPanel } from '../components/InsightsPanel';
import { KpiCard } from '../components/KpiCard';
import { SquadMatrix, useSquadRows } from '../components/SquadMatrix';
import { Card, CardHeader, cx, EmptyState, PageHeader, StatusBadge } from '../components/ui';
import { formatMetric } from '../lib/format';
import { Link } from '../lib/router';
import { generateInsights } from '../metrics/insights';
import { categoryMixFor } from '../metrics/investment';
import { windows } from '../metrics/period';
import { pulseDimensions, pulsesFor } from '../metrics/pulse';
import { scorecard, type Health } from '../metrics/scorecard';
import { metricTrend } from '../metrics/trend';
import { useScopedSquads } from '../state/filters';

export function Overview() {
  const { data, squads, period, label, scope } = useScopedSquads();
  const sc = useMemo(() => scorecard(data, squads, period), [data, squads, period]);
  const trends = useMemo(
    () => ({
      health: metricTrend(data, squads, 'healthIndex'),
      pulse: metricTrend(data, squads, 'pulseScore'),
      lead: metricTrend(data, squads, 'leadP85'),
    }),
    [data, squads],
  );
  const extra = useMemo(() => {
    const w = windows(data.asOf, period);
    return {
      lowestPulse: pulseDimensions(pulsesFor(data, squads), w.current).slice(0, 2),
      mix: categoryMixFor(data, squads, w.current),
      mixPrev: categoryMixFor(data, squads, w.previous),
    };
  }, [data, squads, period]);
  const rows = useSquadRows(data, squads, period);
  const [signalFilter, setSignalFilter] = useState<Health | null>(null);
  // A new scope or period is a new question — start unfiltered
  useEffect(() => setSignalFilter(null), [squads, period]);
  const insights = useMemo(() => generateInsights(data, squads, period), [data, squads, period]);
  const indexCounts = rows.reduce<Record<string, number>>((acc, r) => {
    const st = r.sc.status.healthIndex ?? 'none';
    return { ...acc, [st]: (acc[st] ?? 0) + 1 };
  }, { good: 0, watch: 0, attention: 0 });
  const counts = rows.reduce<Record<Health, number>>((acc, r) => ({ ...acc, [r.health]: acc[r.health] + 1 }), { good: 0, watch: 0, attention: 0 });

  const showMatrix = scope.kind !== 'squad';
  const toggleSignal = (h: Health) => {
    const next = signalFilter === h ? null : h;
    setSignalFilter(next);
    if (next) {
      const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => document.getElementById('squad-matrix')?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' }));
    }
  };

  if (!squads.length) return <EmptyState title="No squads in this scope" body="Pick a different scope in the top bar." />;

  const periodLabel = `${period}d`;
  const scrumCount = squads.filter((s) => s.teamType === 'scrum').length;

  return (
    <>
      <PageHeader
        title="Delivery overview"
        subtitle={`${label} · ${squads.length} squad${squads.length > 1 ? 's' : ''} (${scrumCount} Scrum, ${squads.length - scrumCount} Kanban) · last ${period} days`}
      />

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          metricId="healthIndex"
          to="/predictability"
          toLabel="Open Predictability"
          sc={sc}
          trend={trends.health.map((t) => t.value)}
          icon={<MdOutlineMonitorHeart />}
          periodLabel={periodLabel}
          footer={
            squads.length > 1 ? (
              <>
                <span className="font-semibold text-on-surface">{indexCounts.good}</span> of {squads.length} squads on track ·{' '}
                <span className="font-semibold text-on-surface">{indexCounts.attention}</span> need attention
              </>
            ) : (
              'Completion, cycle time, stability, scope, lead time and pulse — equal weight'
            )
          }
        />
        <KpiCard
          metricId="pulseScore"
          sc={sc}
          trend={trends.pulse.map((t) => t.value)}
          icon={<MdOutlineSentimentSatisfied />}
          periodLabel={periodLabel}
          footer={
            extra.lowestPulse.length ? (
              <>
                Lowest:{' '}
                {extra.lowestPulse.map((d, i) => (
                  <span key={d.id}>
                    {i > 0 && ' · '}
                    {d.label} <span className="tabular font-semibold text-on-surface">{d.score.toFixed(1)}</span>
                  </span>
                ))}
              </>
            ) : (
              'No pulse check in this period'
            )
          }
        />
        <KpiCard
          metricId="leadP85"
          label="Lead time (85th pct)"
          sc={sc}
          trend={trends.lead.map((t) => t.value)}
          icon={<MdOutlineTimer />}
          periodLabel={periodLabel}
          footer={
            <>
              Of which in progress (cycle time, 85th pct):{' '}
              <span className="tabular font-semibold text-on-surface">{formatMetric('cycleP85', sc.current.cycleP85, true)}</span>
            </>
          }
        />
        <CategoryMixCard current={extra.mix} previous={extra.mixPrev} periodLabel={periodLabel} icon={<MdOutlineDonutSmall />} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <HighlightsCard data={data} squads={squads} period={period} />
        <Card>
          <CardHeader title="Signals at a glance" subtitle={`${squads.length} squads · ${period} days`} />
          <div className="flex flex-col gap-3 p-5">
            {(['attention', 'watch', 'good'] as Health[]).map((h) => {
              const active = signalFilter === h;
              const clickable = showMatrix && counts[h] > 0;
              return (
                <button
                  key={h}
                  type="button"
                  disabled={!clickable}
                  aria-pressed={active}
                  title={clickable ? (active ? 'Show all squads' : 'Show these squads in the matrix below') : undefined}
                  onClick={() => toggleSignal(h)}
                  className={cx(
                    'flex items-center justify-between rounded-md border px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-series-1/40',
                    active ? 'border-primary bg-surface-container-low' : 'border-surface-container',
                    clickable && !active && 'hover:border-outline-variant hover:bg-surface-container-low',
                    !clickable && 'cursor-default',
                  )}
                >
                  <StatusBadge status={h} />
                  <span className="flex items-center gap-2">
                    <span className="text-headline-md tabular text-on-surface">{counts[h]}</span>
                    {clickable && <MdFilterList className={cx('text-[18px]', active ? 'text-primary' : 'text-outline')} aria-hidden />}
                  </span>
                </button>
              );
            })}
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Signals are derived from thresholds in the{' '}
              <Link to="/metrics" className="font-medium text-series-1 hover:underline">
                metric catalogue
              </Link>
              . Squads see their own data before comparisons are shared more widely.
            </p>
          </div>
        </Card>
      </div>

      {showMatrix && (
        <div className="mb-8">
          <SquadMatrix
            id="squad-matrix"
            data={data}
            squads={squads}
            period={period}
            signalFilter={signalFilter}
            onClearFilter={() => setSignalFilter(null)}
          />
        </div>
      )}

      <InsightsPanel insights={insights} />
    </>
  );
}

import { useMemo } from 'react';
import { MdOutlineAnalytics, MdOutlineBugReport, MdOutlineSpeed, MdOutlineTimer } from 'react-icons/md';
import { InsightsPanel } from '../components/InsightsPanel';
import { KpiCard } from '../components/KpiCard';
import { LineChart } from '../components/charts/LineChart';
import { SquadMatrix, useSquadRows } from '../components/SquadMatrix';
import { Card, CardHeader, EmptyState, PageHeader, StatusBadge } from '../components/ui';
import { shortDate } from '../lib/format';
import { Link } from '../lib/router';
import { generateInsights } from '../metrics/insights';
import { scorecard, type Health } from '../metrics/scorecard';
import { metricTrend } from '../metrics/trend';
import { useScopedSquads } from '../state/filters';

export function Overview() {
  const { data, squads, period, label, scope } = useScopedSquads();
  const sc = useMemo(() => scorecard(data, squads, period), [data, squads, period]);
  const hasScrum = squads.some((s) => s.teamType === 'scrum');
  const predId = hasScrum ? 'sayDo' : 'throughputCv';
  const trends = useMemo(
    () => ({
      pred: metricTrend(data, squads, predId),
      ct: metricTrend(data, squads, 'cycleP85'),
      tp: metricTrend(data, squads, 'throughput'),
      bug: metricTrend(data, squads, 'bugRatio'),
    }),
    [data, squads, predId],
  );
  const rows = useSquadRows(data, squads, period);
  const insights = useMemo(() => generateInsights(data, squads, period), [data, squads, period]);
  const counts = rows.reduce<Record<Health, number>>((acc, r) => ({ ...acc, [r.health]: acc[r.health] + 1 }), { good: 0, watch: 0, attention: 0 });

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
        <KpiCard metricId={predId} sc={sc} trend={trends.pred.map((t) => t.value)} icon={<MdOutlineAnalytics />} periodLabel={periodLabel} />
        <KpiCard metricId="cycleP85" sc={sc} trend={trends.ct.map((t) => t.value)} icon={<MdOutlineTimer />} periodLabel={periodLabel} />
        <KpiCard metricId="throughput" sc={sc} trend={trends.tp.map((t) => t.value)} icon={<MdOutlineSpeed />} periodLabel={periodLabel} />
        <KpiCard metricId="bugRatio" sc={sc} trend={trends.bug.map((t) => t.value)} icon={<MdOutlineBugReport />} periodLabel={periodLabel} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={hasScrum ? 'Commitment reliability by sprint' : 'Throughput variability'}
            subtitle={hasScrum ? 'Say/Do across Scrum squads in scope, per 2-week sprint (points-weighted)' : 'Rolling 8-week variability of weekly throughput'}
          />
          <div className="p-5">
            <LineChart
              ariaLabel="Predictability trend"
              xLabels={trends.pred.map((t) => shortDate(t.endMs))}
              series={[{ id: 'p', label: hasScrum ? 'Say/Do' : 'Throughput variability', values: trends.pred.map((t) => t.value) }]}
              yFormat={(v) => `${Math.round(v * 100)}%`}
              yMin={hasScrum ? 0.4 : 0}
              yMax={hasScrum ? 1 : undefined}
              target={hasScrum ? { value: 0.8, label: 'Target 80%' } : { value: 0.35, label: 'Stable ≤ 35%' }}
              area
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Signals at a glance" subtitle={`${squads.length} squads · ${period} days`} />
          <div className="flex flex-col gap-3 p-5">
            {(['attention', 'watch', 'good'] as Health[]).map((h) => (
              <div key={h} className="flex items-center justify-between rounded-md border border-surface-container px-4 py-3">
                <StatusBadge status={h} />
                <span className="text-headline-md tabular text-on-surface">{counts[h]}</span>
              </div>
            ))}
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

      {scope.kind !== 'squad' && (
        <div className="mb-8">
          <SquadMatrix data={data} squads={squads} period={period} />
        </div>
      )}

      <InsightsPanel insights={insights} />
    </>
  );
}

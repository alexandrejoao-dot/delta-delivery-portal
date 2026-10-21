import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  MdOutlineAnalytics,
  MdOutlineShuffle,
  MdOutlineTimer,
  MdOutlineTrackChanges,
  MdOutlineWaves,
} from 'react-icons/md';
import { BarChart } from '../components/charts/BarChart';
import { LineChart } from '../components/charts/LineChart';
import { Sparkline } from '../components/charts/Sparkline';
import { KpiCard } from '../components/KpiCard';
import { SortableTable, type Column } from '../components/SortableTable';
import { Card, CardHeader, cx, EmptyState, PageHeader, Segmented, SquadAvatar, StatusBadge } from '../components/ui';
import type { Squad, TeamType } from '../data/model';
import { formatMetric, shortDate } from '../lib/format';
import { navigate } from '../lib/router';
import { evaluate, METRICS, type MetricId } from '../metrics/catalogue';
import { weeklyThroughput } from '../metrics/flow';
import { scorecard, type Scorecard } from '../metrics/scorecard';
import { metricTrend, TREND_DEFAULTS } from '../metrics/trend';
import { sprintSayDo, sprintVelocity } from '../metrics/predictability';
import { useScopedSquads } from '../state/filters';

/** Key metrics per team type — Scrum is read from commitments, Kanban from flow. */
interface Box {
  id: MetricId;
  label?: string;
  icon: ReactNode;
}

const SCRUM_BOXES: Box[] = [
  { id: 'cycleP85', label: 'Cycle time (85th pct)', icon: <MdOutlineTimer /> },
  { id: 'sayDo', label: 'Completion ratio', icon: <MdOutlineAnalytics /> },
  { id: 'velocityCv', label: 'Stability', icon: <MdOutlineWaves /> },
  { id: 'scopeChange', label: 'Scope volatility', icon: <MdOutlineShuffle /> },
  { id: 'forecastAccuracy', icon: <MdOutlineTrackChanges /> },
];

const KANBAN_BOXES: Box[] = [
  { id: 'cycleP85', label: 'Cycle time (85th pct)', icon: <MdOutlineTimer /> },
  { id: 'throughputCv', label: 'Stability', icon: <MdOutlineWaves /> },
  { id: 'forecastAccuracy', icon: <MdOutlineTrackChanges /> },
];

type Trend = ReturnType<typeof metricTrend>;

function boxTrends(data: Parameters<typeof metricTrend>[0], squads: Squad[], boxes: Box[]) {
  if (!squads.length) return {} as Record<MetricId, Trend>;
  return Object.fromEntries(boxes.map((b) => [b.id, metricTrend(data, squads, b.id)])) as Record<MetricId, Trend>;
}

function KpiRow({ boxes, sc, trends, periodLabel }: { boxes: Box[]; sc: Scorecard; trends: Record<MetricId, Trend>; periodLabel: string }) {
  return (
    <div className={cx('mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', boxes.length > 3 && 'xl:grid-cols-5')}>
      {boxes.map((b) => (
        <KpiCard
          key={b.id}
          metricId={b.id}
          label={b.label}
          sc={sc}
          trend={trends[b.id]?.map((t) => t.value)}
          icon={b.icon}
          periodLabel={periodLabel}
          compact
        />
      ))}
    </div>
  );
}

function windowText(id: MetricId) {
  const o = TREND_DEFAULTS[id] ?? { windowDays: 28, stepDays: 14 };
  const weeks = (d: number) => Math.round(d / 7);
  return o.windowDays === o.stepDays
    ? `per ${weeks(o.windowDays)}-week window`
    : `trailing ${weeks(o.windowDays)}-week windows, every ${weeks(o.stepDays)} weeks`;
}

/** One trend chart per KPI box, in the same order, with the on-track threshold as the target line. */
function BoxCharts({ boxes, trends }: { boxes: Box[]; trends: Record<MetricId, Trend> }) {
  return (
    <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
      {boxes.map((b, i) => {
        const def = METRICS[b.id];
        const trend = trends[b.id] ?? [];
        const good = def.thresholds?.good;
        const better = def.direction === 'higher' ? 'Higher is better · ' : def.direction === 'lower' ? 'Lower is better · ' : '';
        const name = b.label ?? def.name;
        // Own top: the chart's default floor of 1 would put small percentages (10–20%) against a 100% axis
        const top = Math.max(...trend.map((t) => t.value).filter(Number.isFinite), good ?? 0) * 1.15;
        return (
          <Card key={b.id} className={cx(boxes.length % 2 === 1 && i === boxes.length - 1 && 'lg:col-span-2')}>
            <CardHeader title={name} subtitle={`${better}${windowText(b.id)}`.replace(/^./, (c) => c.toUpperCase())} />
            <div className="p-5">
              <LineChart
                ariaLabel={`${name} over time`}
                xLabels={trend.map((t) => shortDate(t.endMs))}
                series={[{ id: b.id, label: name, values: trend.map((t) => (Number.isFinite(t.value) ? t.value : null)) }]}
                yFormat={(v) => formatMetric(b.id, v, true)}
                yMin={0}
                yMax={def.unit === 'percent' ? Math.min(1, top) : top || undefined}
                target={
                  good === undefined
                    ? undefined
                    : { value: good, label: `On track ${def.direction === 'higher' ? '≥' : '≤'} ${formatMetric(b.id, good, true)}` }
                }
                area
              />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

interface Row {
  squad: Squad;
  index: number;
  sc: Scorecard;
  spark: number[];
}

export function Predictability() {
  const { data, squads, period, label } = useScopedSquads();
  const scrum = useMemo(() => squads.filter((s) => s.teamType === 'scrum'), [squads]);
  const kanban = useMemo(() => squads.filter((s) => s.teamType === 'kanban'), [squads]);
  const scScrum = useMemo(() => scorecard(data, scrum, period), [data, scrum, period]);
  const scKanban = useMemo(() => scorecard(data, kanban, period), [data, kanban, period]);
  const scrumBoxTrends = useMemo(() => boxTrends(data, scrum, SCRUM_BOXES), [data, scrum]);
  const kanbanBoxTrends = useMemo(() => boxTrends(data, kanban, KANBAN_BOXES), [data, kanban]);
  const single = squads.length === 1 ? squads[0] : null;

  // Mixed scope → one team type at a time; a single type (or one squad) just shows its own boxes
  const both = scrum.length > 0 && kanban.length > 0;
  const [view, setView] = useState<TeamType>('scrum');
  useEffect(() => {
    if (!scrum.length && kanban.length) setView('kanban');
    if (!kanban.length && scrum.length) setView('scrum');
  }, [scrum.length, kanban.length]);
  const showScrum = scrum.length > 0 && (!both || view === 'scrum');
  const showKanban = kanban.length > 0 && (!both || view === 'kanban');
  const sprints = useMemo(
    () =>
      single && single.teamType === 'scrum'
        ? data.sprints.filter((s) => s.squadId === single.id).sort((a, b) => a.endDate.localeCompare(b.endDate))
        : [],
    [data, single],
  );

  const scrumRows: Row[] = useMemo(
    () =>
      scrum.map((sq) => ({
        squad: sq,
        index: data.squads.indexOf(sq),
        sc: scorecard(data, [sq], period),
        spark: metricTrend(data, [sq], 'sayDo', { points: 8 }).map((t) => t.value),
      })),
    [data, scrum, period],
  );
  const kanbanRows: Row[] = useMemo(
    () =>
      kanban.map((sq) => ({
        squad: sq,
        index: data.squads.indexOf(sq),
        sc: scorecard(data, [sq], period),
        spark: weeklyThroughput(
          data.workItems.filter((i) => i.squadId === sq.id),
          data.asOf,
          Math.round(period / 7),
        ).map((w) => w.count),
      })),
    [data, kanban, period],
  );

  if (!squads.length) return <EmptyState title="No squads in this scope" />;

  const pl = `${period}d`;
  const squadCol: Column<Row> = {
    key: 'name',
    header: 'Squad',
    sortValue: (r) => r.squad.name,
    render: (r) => (
      <div className="flex items-center gap-3">
        <SquadAvatar name={r.squad.name} index={r.index} />
        <span className="font-semibold">{r.squad.name}</span>
      </div>
    ),
  };
  const metricCol = (id: keyof Scorecard['current'], header: string): Column<Row> => ({
    key: id,
    header,
    tip: METRICS[id].description,
    sortValue: (r) => r.sc.current[id],
    render: (r) => {
      const st = r.sc.status[id];
      return (
        <span className={cx('tabular font-medium', st === 'attention' && 'font-semibold text-bad', st === 'watch' && 'text-warn')}>
          {formatMetric(id, r.sc.current[id], true)}
        </span>
      );
    },
  });

  return (
    <>
      <PageHeader
        title="Health index"
        subtitle={`${label} · can we forecast what we will deliver? · last ${period} days`}
        actions={
          both ? (
            <Segmented
              ariaLabel="Team type"
              value={view}
              onChange={setView}
              options={[
                { value: 'scrum', label: `Scrum (${scrum.length})` },
                { value: 'kanban', label: `Kanban (${kanban.length})` },
              ]}
            />
          ) : undefined
        }
      />

      {showScrum && (
        <>
          <h3 className="mb-3 text-label-md uppercase text-on-surface-variant">Scrum squads ({scrum.length})</h3>
          <KpiRow boxes={SCRUM_BOXES} sc={scScrum} trends={scrumBoxTrends} periodLabel={pl} />

          <BoxCharts boxes={SCRUM_BOXES} trends={scrumBoxTrends} />

          {single && sprints.length > 0 && (
            <Card className="mb-8">
              <CardHeader title="Committed vs completed" subtitle={`${single.name} · points per sprint`} />
              <div className="p-5">
                <BarChart
                  ariaLabel="Committed vs completed points per sprint"
                  xLabels={sprints.map((s) => s.name.replace(`${single.name} Sprint `, 'S'))}
                  series={[
                    { id: 'c', label: 'Committed', values: sprints.map((s) => s.committedPoints) },
                    { id: 'd', label: 'Completed (of committed)', values: sprints.map((s) => s.completedCommittedPoints) },
                    { id: 'a', label: 'Added mid-sprint', values: sprints.map((s) => s.addedPoints) },
                  ]}
                  yFormat={(v) => `${Math.round(v)}`}
                  tooltipExtra={(i) => [
                    { label: 'Say/Do', value: `${Math.round(sprintSayDo(sprints[i]) * 100)}%` },
                    { label: 'Velocity', value: `${sprintVelocity(sprints[i])} pts` },
                    { label: 'Goal met', value: sprints[i].goalMet === null ? 'Not recorded' : sprints[i].goalMet ? 'Yes' : 'No' },
                  ]}
                />
              </div>
            </Card>
          )}

          {scrum.length > 1 && (
            <Card className="mb-8 overflow-hidden">
              <CardHeader title="Scrum squad breakdown" subtitle="Sparkline: Say/Do over the last 8 sprints" />
              <SortableTable
                rows={scrumRows}
                rowKey={(r) => r.squad.id}
                onRowClick={(r) => navigate(`/squads/${r.squad.id}`)}
                initialSort={{ key: 'sayDo', dir: 'asc' }}
                minWidth={820}
                columns={[
                  squadCol,
                  metricCol('sayDo', 'Say/Do'),
                  { key: 'spark', header: 'Trend', render: (r) => <Sparkline values={r.spark} width={88} height={24} /> },
                  metricCol('scopeChange', 'Scope change'),
                  metricCol('velocityCv', 'Velocity var.'),
                  metricCol('goalHitRate', 'Goal hit rate'),
                  {
                    key: 'st',
                    header: 'Say/Do signal',
                    align: 'right',
                    sortValue: (r) => r.sc.current.sayDo,
                    render: (r) => <StatusBadge status={evaluate('sayDo', r.sc.current.sayDo)} size="sm" />,
                  },
                ]}
              />
            </Card>
          )}
        </>
      )}

      {showKanban && (
        <>
          <h3 className="mb-3 text-label-md uppercase text-on-surface-variant">Kanban squads ({kanban.length})</h3>
          <p className="mb-4 max-w-3xl text-body-sm text-on-surface-variant">
            Kanban squads don’t commit to sprints, so predictability is read from how stable weekly throughput is. Stable throughput is what makes
            probabilistic forecasting (e.g. Monte Carlo “when will it be done?”) trustworthy.
          </p>
          <KpiRow boxes={KANBAN_BOXES} sc={scKanban} trends={kanbanBoxTrends} periodLabel={pl} />
          <BoxCharts boxes={KANBAN_BOXES} trends={kanbanBoxTrends} />
          <Card className="overflow-hidden">
            <CardHeader title="Kanban squad breakdown" subtitle={`Sparkline: items finished per week, last ${Math.round(period / 7)} weeks`} />
            <SortableTable
              rows={kanbanRows}
              rowKey={(r) => r.squad.id}
              onRowClick={(r) => navigate(`/squads/${r.squad.id}`)}
              initialSort={{ key: 'throughputCv', dir: 'desc' }}
              minWidth={720}
              columns={[
                squadCol,
                metricCol('throughput', 'Throughput /wk'),
                { key: 'spark', header: 'Weekly', render: (r) => <Sparkline values={r.spark} width={110} height={24} /> },
                metricCol('throughputCv', 'Variability'),
                {
                  key: 'st',
                  header: 'Signal',
                  align: 'right',
                  sortValue: (r) => r.sc.current.throughputCv,
                  render: (r) => <StatusBadge status={evaluate('throughputCv', r.sc.current.throughputCv)} size="sm" />,
                },
              ]}
            />
          </Card>
        </>
      )}
    </>
  );
}

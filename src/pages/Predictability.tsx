import { useMemo } from 'react';
import { MdOutlineAnalytics, MdOutlineFlag, MdOutlineShuffle, MdOutlineWaves } from 'react-icons/md';
import { BarChart } from '../components/charts/BarChart';
import { LineChart } from '../components/charts/LineChart';
import { Sparkline } from '../components/charts/Sparkline';
import { KpiCard } from '../components/KpiCard';
import { SortableTable, type Column } from '../components/SortableTable';
import { Card, CardHeader, cx, EmptyState, PageHeader, SquadAvatar, StatusBadge } from '../components/ui';
import type { Squad } from '../data/model';
import { formatMetric, shortDate } from '../lib/format';
import { navigate } from '../lib/router';
import { evaluate, METRICS } from '../metrics/catalogue';
import { weeklyThroughput } from '../metrics/flow';
import { scorecard, type Scorecard } from '../metrics/scorecard';
import { metricTrend } from '../metrics/trend';
import { sprintSayDo, sprintVelocity } from '../metrics/predictability';
import { useScopedSquads } from '../state/filters';

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
  const kanbanTrend = useMemo(() => metricTrend(data, kanban, 'throughputCv').map((t) => t.value), [data, kanban]);
  const scScrum = useMemo(() => scorecard(data, scrum, period), [data, scrum, period]);
  const scKanban = useMemo(() => scorecard(data, kanban, period), [data, kanban, period]);
  const sayDoTrend = useMemo(() => metricTrend(data, scrum, 'sayDo'), [data, scrum]);
  const scopeTrend = useMemo(() => metricTrend(data, scrum, 'scopeChange'), [data, scrum]);
  const single = squads.length === 1 ? squads[0] : null;
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
      <PageHeader title="Predictability" subtitle={`${label} · can we forecast what we will deliver? · last ${period} days`} />

      {scrum.length > 0 && (
        <>
          <h3 className="mb-3 text-label-md uppercase text-on-surface-variant">Scrum squads ({scrum.length})</h3>
          <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard metricId="sayDo" sc={scScrum} trend={sayDoTrend.map((t) => t.value)} icon={<MdOutlineAnalytics />} periodLabel={pl} />
            <KpiCard metricId="scopeChange" sc={scScrum} trend={scopeTrend.map((t) => t.value)} icon={<MdOutlineShuffle />} periodLabel={pl} />
            <KpiCard metricId="velocityCv" sc={scScrum} icon={<MdOutlineWaves />} periodLabel={pl} />
            <KpiCard metricId="goalHitRate" sc={scScrum} icon={<MdOutlineFlag />} periodLabel={pl} />
          </div>

          <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Say/Do by sprint" subtitle="Share of committed points completed" />
              <div className="p-5">
                <LineChart
                  ariaLabel="Say/Do by sprint"
                  xLabels={sayDoTrend.map((t) => shortDate(t.endMs))}
                  series={[{ id: 'sd', label: 'Say/Do', values: sayDoTrend.map((t) => t.value) }]}
                  yFormat={(v) => `${Math.round(v * 100)}%`}
                  yMin={0.4}
                  yMax={1}
                  target={{ value: 0.8, label: 'Target 80%' }}
                  area
                />
              </div>
            </Card>
            {single && sprints.length ? (
              <Card>
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
                      { label: 'Goal met', value: sprints[i].goalMet ? 'Yes' : 'No' },
                    ]}
                  />
                </div>
              </Card>
            ) : (
              <Card>
                <CardHeader title="Mid-sprint scope change" subtitle="Points added after sprint start ÷ commitment" />
                <div className="p-5">
                  <BarChart
                    ariaLabel="Scope change by sprint"
                    xLabels={scopeTrend.map((t) => shortDate(t.endMs))}
                    series={[{ id: 'sc', label: 'Scope change', values: scopeTrend.map((t) => (Number.isFinite(t.value) ? t.value : 0)), color: '#eb6834' }]}
                    yFormat={(v) => `${Math.round(v * 100)}%`}
                    reference={{ value: 0.15, label: 'Healthy ≤ 15%' }}
                  />
                </div>
              </Card>
            )}
          </div>

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

      {kanban.length > 0 && (
        <>
          <h3 className="mb-3 text-label-md uppercase text-on-surface-variant">Kanban squads ({kanban.length})</h3>
          <p className="mb-4 max-w-3xl text-body-sm text-on-surface-variant">
            Kanban squads don’t commit to sprints, so predictability is read from how stable weekly throughput is. Stable throughput is what makes
            probabilistic forecasting (e.g. Monte Carlo “when will it be done?”) trustworthy.
          </p>
          <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard metricId="throughputCv" sc={scKanban} trend={kanbanTrend} icon={<MdOutlineWaves />} periodLabel={pl} />
            <KpiCard metricId="throughput" sc={scKanban} icon={<MdOutlineAnalytics />} periodLabel={pl} />
          </div>
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

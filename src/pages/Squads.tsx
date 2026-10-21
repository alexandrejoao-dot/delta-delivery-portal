import { useMemo, useState } from 'react';
import {
  MdArrowBack,
  MdOutlineAnalytics,
  MdOutlineBugReport,
  MdOutlineHourglassBottom,
  MdOutlineSpeed,
  MdOutlineVisibility,
  MdOutlineWaves,
} from 'react-icons/md';
import { BarChart } from '../components/charts/BarChart';
import { LineChart } from '../components/charts/LineChart';
import { ScatterChart } from '../components/charts/ScatterChart';
import { InsightsPanel } from '../components/InsightsPanel';
import { KpiCard } from '../components/KpiCard';
import { SortableTable } from '../components/SortableTable';
import { SquadMatrix } from '../components/SquadMatrix';
import { Button, Card, CardHeader, EmptyState, PageHeader, Segmented, SquadAvatar, StatusBadge, TeamTypeTag } from '../components/ui';
import { useDataset } from '../data/DataContext';
import { formatMetric, longDate, shortDate } from '../lib/format';
import { Link } from '../lib/router';
import { completedIn, weeklyThroughput } from '../metrics/flow';
import { generateInsights } from '../metrics/insights';
import { daysBetween, windows } from '../metrics/period';
import { sprintSayDo, sprintVelocity } from '../metrics/predictability';
import { scorecard, squadHealth } from '../metrics/scorecard';
import { metricTrend } from '../metrics/trend';
import { useFilters, useScopedSquads, type TeamTypeFilter } from '../state/filters';
import { AgeingWipTable, ageingRows } from './Flow';

export function SquadList() {
  const { data, squads: inScope, period, label } = useScopedSquads();
  // Filters this list only — the rest of the portal always shows both team types
  const [teamType, setTeamType] = useState<TeamTypeFilter>('all');
  const squads = useMemo(() => (teamType === 'all' ? inScope : inScope.filter((s) => s.teamType === teamType)), [inScope, teamType]);
  return (
    <>
      <PageHeader
        title="Squads"
        subtitle={`${label} · ${squads.length} squads · last ${period} days`}
        actions={
          <Segmented<TeamTypeFilter>
            ariaLabel="Team type"
            value={teamType}
            onChange={setTeamType}
            options={[
              { value: 'all', label: 'All' },
              { value: 'scrum', label: 'Scrum' },
              { value: 'kanban', label: 'Kanban' },
            ]}
          />
        }
      />
      {squads.length ? <SquadMatrix data={data} squads={squads} period={period} title="All squads" /> : <EmptyState title="No squads match" />}
    </>
  );
}

export function SquadDetail({ id }: { id: string }) {
  const data = useDataset();
  const { period, setScope, scope } = useFilters();
  const squad = data.squads.find((s) => s.id === id);
  const squads = useMemo(() => (squad ? [squad] : []), [squad]);
  const items = useMemo(() => data.workItems.filter((i) => i.squadId === id), [data, id]);
  const sc = useMemo(() => scorecard(data, squads, period), [data, squads, period]);
  const sprints = useMemo(
    () => data.sprints.filter((s) => s.squadId === id).sort((a, b) => a.endDate.localeCompare(b.endDate)),
    [data, id],
  );
  const sayDoTrend = useMemo(() => metricTrend(data, squads, 'sayDo'), [data, squads]);
  const ctTrend = useMemo(() => metricTrend(data, squads, 'cycleP85'), [data, squads]);
  const tp = useMemo(() => weeklyThroughput(items, data.asOf, Math.round(period / 7)), [items, data.asOf, period]);
  const insights = useMemo(() => generateInsights(data, squads, period), [data, squads, period]);
  const ageing = useMemo(() => ageingRows(data, squads), [data, squads]);
  const byInitiative = useMemo(() => {
    const done = completedIn(items, windows(data.asOf, period).current);
    const counts = new Map<string, number>();
    done.forEach((i) => counts.set(i.initiativeId ?? 'none', (counts.get(i.initiativeId ?? 'none') ?? 0) + 1));
    return [...counts.entries()]
      .map(([k, n]) => ({ name: k === 'none' ? 'Not linked to an initiative' : data.initiatives.find((x) => x.id === k)?.name ?? k, n, linked: k !== 'none' }))
      .sort((a, b) => Number(b.linked) - Number(a.linked) || b.n - a.n)
      .map((x) => ({ ...x, share: x.n / Math.max(1, done.length) }));
  }, [items, data, period]);
  const done = useMemo(
    () => completedIn(items, windows(data.asOf, period).current).filter((i) => i.startedAt),
    [items, data.asOf, period],
  );

  if (!squad) return <EmptyState title="Squad not found" body="It may have been renamed or removed from the source." />;

  const domain = data.domains.find((d) => d.id === squad.domainId);
  const vs = data.valueStreams.find((v) => v.id === squad.valueStreamId);
  const dl = data.deliveryLeads.find((d) => d.id === squad.deliveryLeadId);
  const health = squadHealth(sc, squad.teamType);
  const isScrum = squad.teamType === 'scrum';
  const pl = `${period}d`;
  const current = windows(data.asOf, period).current;
  const isMyView = scope.kind === 'squad' && scope.id === squad.id;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to="/squads" className="inline-flex items-center gap-1 text-label-md text-on-surface-variant hover:text-on-surface">
            <MdArrowBack /> All squads
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <SquadAvatar name={squad.name} index={data.squads.indexOf(squad)} />
            {squad.name}
            <TeamTypeTag type={squad.teamType} />
            <StatusBadge status={health.health} />
          </span>
        }
        subtitle={`${domain?.name} · ${vs?.name} · Delivery Lead: ${dl?.name} · Board ${squad.boardKey} · last ${period} days`}
        actions={
          <Button icon={<MdOutlineVisibility />} variant={isMyView ? 'secondary' : 'primary'} onClick={() => setScope(isMyView ? { kind: 'all' } : { kind: 'squad', id: squad.id })}>
            {isMyView ? 'Back to all squads view' : 'Make this my view'}
          </Button>
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {isScrum ? (
          <KpiCard metricId="sayDo" sc={sc} trend={sayDoTrend.map((t) => t.value)} icon={<MdOutlineAnalytics />} periodLabel={pl} />
        ) : (
          <KpiCard metricId="throughputCv" sc={sc} trend={metricTrend(data, squads, 'throughputCv').map((t) => t.value)} icon={<MdOutlineWaves />} periodLabel={pl} />
        )}
        <KpiCard metricId="cycleP85" sc={sc} trend={ctTrend.map((t) => t.value)} icon={<MdOutlineHourglassBottom />} periodLabel={pl} />
        {isScrum ? (
          <KpiCard metricId="velocity" sc={sc} icon={<MdOutlineSpeed />} periodLabel={pl} label="Avg velocity" />
        ) : (
          <KpiCard metricId="throughput" sc={sc} icon={<MdOutlineSpeed />} periodLabel={pl} />
        )}
        <KpiCard metricId="bugRatio" sc={sc} icon={<MdOutlineBugReport />} periodLabel={pl} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {isScrum ? (
          <Card>
            <CardHeader title="Sprints: committed vs completed" subtitle="Story points · hover for Say/Do and goal" />
            <div className="p-5">
              <BarChart
                ariaLabel="Committed vs completed points"
                xLabels={sprints.map((s) => s.name.replace(`${squad.name} Sprint `, 'S'))}
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
        ) : (
          <Card>
            <CardHeader title="Weekly throughput" subtitle="Items finished per week" />
            <div className="p-5">
              <BarChart
                ariaLabel="Weekly throughput"
                xLabels={tp.map((w) => shortDate(w.weekEndMs))}
                series={[{ id: 'tp', label: 'Items finished', values: tp.map((w) => w.count) }]}
                yFormat={(v) => `${Math.round(v)}`}
              />
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title="Cycle time (85th pct) trend" subtitle="Rolling 4-week window" />
          <div className="p-5">
            <LineChart
              ariaLabel="Cycle time trend"
              xLabels={ctTrend.map((t) => shortDate(t.endMs))}
              series={[{ id: 'ct', label: 'Cycle time p85', values: ctTrend.map((t) => t.value) }]}
              yFormat={(v) => `${v.toFixed(0)}d`}
              yMin={0}
              target={{ value: 10, label: 'Healthy ≤ 10d' }}
              area
            />
          </div>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader title="Cycle time scatter" subtitle={`${done.length} items finished in the last ${period} days`} />
        <div className="p-5">
          <ScatterChart
            ariaLabel="Cycle time scatter plot"
            points={done.map((i) => ({ id: i.key, x: Date.parse(i.doneAt!), y: daysBetween(i.startedAt!, i.doneAt!), label: i.key, meta: i.summary }))}
            xDomain={[current.startMs, current.endMs]}
            xFormat={(ms) => shortDate(ms)}
            yFormat={(v) => `${v.toFixed(v < 10 ? 1 : 0)}d`}
            yLabel="Cycle time"
            references={[
              { value: sc.current.cycleP50, label: '50th pct' },
              { value: sc.current.cycleP85, label: '85th pct' },
            ]}
            height={240}
          />
        </div>
      </Card>

      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader title="Work in progress" subtitle={`${ageing.length} items · compared with this squad’s 85th pct cycle time (${formatMetric('cycleP85', ageing[0]?.p85 ?? NaN, true)})`} />
          {ageing.length ? <AgeingWipTable rows={ageing} showSquad={false} /> : <EmptyState title="Nothing in progress" />}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Where the work went" subtitle="Finished items by initiative — the longitudinal anchor for value streams and pods" />
          <ul className="flex flex-col gap-3 p-5">
            {byInitiative.map((x) => (
              <li key={x.name}>
                <div className="mb-1 flex justify-between text-body-sm">
                  <span className={x.linked ? 'font-medium text-on-surface' : 'italic text-on-surface-variant'}>{x.name}</span>
                  <span className="tabular text-on-surface-variant">
                    {x.n} · {Math.round(x.share * 100)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                  <div className="h-full rounded-full" style={{ width: `${x.share * 100}%`, background: x.linked ? '#2a78d6' : '#c5c6cd' }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {isScrum && (
        <Card className="mb-8 overflow-hidden">
          <CardHeader title="Sprint history" />
          <SortableTable
            rows={[...sprints].reverse()}
            rowKey={(s) => s.id}
            minWidth={760}
            dense
            columns={[
              { key: 'n', header: 'Sprint', render: (s) => <span className="font-medium">{s.name}</span> },
              { key: 'd', header: 'Ended', sortValue: (s) => s.endDate, render: (s) => longDate(s.endDate) },
              { key: 'c', header: 'Committed', align: 'right', sortValue: (s) => s.committedPoints, render: (s) => <span className="tabular">{s.committedPoints}</span> },
              { key: 'a', header: 'Added', align: 'right', sortValue: (s) => s.addedPoints, render: (s) => <span className="tabular">{s.addedPoints}</span> },
              { key: 'v', header: 'Velocity', align: 'right', sortValue: sprintVelocity, render: (s) => <span className="tabular">{sprintVelocity(s)}</span> },
              {
                key: 'sd',
                header: 'Say/Do',
                align: 'right',
                sortValue: sprintSayDo,
                render: (s) => <span className="tabular font-medium">{Math.round(sprintSayDo(s) * 100)}%</span>,
              },
              {
                key: 'g',
                header: 'Goal',
                align: 'right',
                sortValue: (s) => (s.goalMet === null ? -1 : Number(s.goalMet)),
                render: (s) =>
                  s.goalMet === null ? (
                    <StatusBadge size="sm" status="none" />
                  ) : (
                    <StatusBadge size="sm" status={s.goalMet ? 'good' : 'watch'} label={s.goalMet ? 'Met' : 'Missed'} />
                  ),
              },
            ]}
          />
        </Card>
      )}

      <InsightsPanel insights={insights} title="Conversation starters" />
    </>
  );
}

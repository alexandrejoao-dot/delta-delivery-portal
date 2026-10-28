import { useMemo } from 'react';
import { MdDownload, MdOutlineHourglassBottom, MdOutlineSpeed, MdOutlineTimer, MdOutlineViewKanban } from 'react-icons/md';
import { BarChart } from '../components/charts/BarChart';
import { ScatterChart } from '../components/charts/ScatterChart';
import { KpiCard } from '../components/KpiCard';
import { SortableTable } from '../components/SortableTable';
import { Button, Card, CardHeader, EmptyState, PageHeader, StatusBadge } from '../components/ui';
import type { Dataset, Squad, WorkItem } from '../data/model';
import { downloadCsv, shortDate } from '../lib/format';
import { Link } from '../lib/router';
import { ageingWip, completedIn, itemAgeDays, weeklyThroughput } from '../metrics/flow';
import { daysBetween, windows } from '../metrics/period';
import { scorecard } from '../metrics/scorecard';
import { mean } from '../metrics/stats';
import { metricTrend } from '../metrics/trend';
import { useScopedSquads } from '../state/filters';

export interface AgeingRow {
  item: WorkItem;
  squad: Squad;
  age: number;
  p85: number;
}

/** Ageing WIP rows across squads — each item compared to its OWN squad's p85. */
export function ageingRows(data: Dataset, squads: Squad[]): AgeingRow[] {
  const atMs = Date.parse(data.asOf);
  return squads.flatMap((sq) => {
    const items = data.workItems.filter((i) => i.squadId === sq.id);
    const a = ageingWip(items, data.asOf);
    return a.wip.map((item) => ({ item, squad: sq, age: itemAgeDays(item, atMs), p85: a.p85 }));
  });
}

export function AgeingWipTable({ rows, showSquad = true }: { rows: AgeingRow[]; showSquad?: boolean }) {
  return (
    <SortableTable
      rows={rows}
      rowKey={(r) => r.item.key}
      initialSort={{ key: 'ratio', dir: 'desc' }}
      minWidth={showSquad ? 760 : 520}
      maxHeight={480}
      dense
      columns={[
        { key: 'key', header: 'Item', sortValue: (r) => r.item.key, render: (r) => <span className="font-semibold text-series-1">{r.item.key}</span> },
        { key: 'sum', header: 'Summary', render: (r) => <span className="line-clamp-1">{r.item.summary}</span> },
        ...(showSquad
          ? [
              {
                key: 'sq',
                header: 'Team',
                sortValue: (r: AgeingRow) => r.squad.name,
                render: (r: AgeingRow) => (
                  <Link to={`/teams/${r.squad.id}`} className="hover:underline">
                    {r.squad.name}
                  </Link>
                ),
              },
            ]
          : []),
        { key: 'type', header: 'Type', sortValue: (r) => r.item.type, render: (r) => <span className="capitalize">{r.item.type}</span> },
        { key: 'age', header: 'Age', align: 'right', sortValue: (r) => r.age, render: (r) => <span className="tabular font-medium">{r.age.toFixed(1)}d</span> },
        {
          key: 'ratio',
          header: 'vs team p85',
          align: 'right',
          tip: 'Age relative to the team’s 85th percentile cycle time (last 90 days). Above 1× = older than 85% of recently finished work.',
          sortValue: (r) => r.age / r.p85,
          render: (r) => {
            const ratio = r.age / r.p85;
            return (
              <StatusBadge size="sm" status={ratio > 1.5 ? 'attention' : ratio > 1 ? 'watch' : 'good'} label={`${ratio.toFixed(1)}×`} />
            );
          },
        },
      ]}
    />
  );
}

export function Flow() {
  const { data, squads, period, label } = useScopedSquads();
  const ids = useMemo(() => new Set(squads.map((s) => s.id)), [squads]);
  const items = useMemo(() => data.workItems.filter((i) => ids.has(i.squadId)), [data, ids]);
  const sc = useMemo(() => scorecard(data, squads, period), [data, squads, period]);
  const { current } = windows(data.asOf, period);
  const done = useMemo(
    () => completedIn(items, windows(data.asOf, period).current).filter((i) => i.startedAt),
    [items, data.asOf, period],
  );
  const weeks = Math.round(period / 7);
  const tp = useMemo(() => weeklyThroughput(items, data.asOf, weeks), [items, data.asOf, weeks]);
  const ctTrend = useMemo(() => metricTrend(data, squads, 'cycleP85').map((t) => t.value), [data, squads]);
  const ageing = useMemo(() => ageingRows(data, squads), [data, squads]);
  const squadName = useMemo(() => Object.fromEntries(data.squads.map((s) => [s.id, s.name])), [data]);

  const hist = useMemo(() => {
    const edges = [1, 2, 3, 5, 8, 13, 21, Infinity];
    const labels = ['<1d', '1–2d', '2–3d', '3–5d', '5–8d', '8–13d', '13–21d', '21d+'];
    const counts = new Array(labels.length).fill(0);
    done.forEach((i) => {
      const d = daysBetween(i.startedAt!, i.doneAt!);
      const idx = d < 1 ? 0 : edges.findIndex((e) => d < e);
      counts[idx]++;
    });
    return { labels, counts };
  }, [done]);

  if (!squads.length) return <EmptyState title="No teams in this scope" />;
  const pl = `${period}d`;

  return (
    <>
      <PageHeader title="Flow" subtitle={`${label} · how smoothly does work move from started to done? · last ${period} days`} />

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard metricId="cycleP50" sc={sc} icon={<MdOutlineTimer />} periodLabel={pl} />
        <KpiCard metricId="cycleP85" sc={sc} trend={ctTrend} icon={<MdOutlineHourglassBottom />} periodLabel={pl} />
        <KpiCard metricId="throughput" sc={sc} icon={<MdOutlineSpeed />} periodLabel={pl} />
        <KpiCard metricId="ageingWipShare" sc={sc} icon={<MdOutlineViewKanban />} periodLabel={pl} label={`Ageing WIP (${sc.current.wip} in progress)`} />
      </div>

      <Card className="mb-8">
        <CardHeader
          title="Cycle time scatter"
          subtitle={`${done.length} items finished · each dot is one item · hover for details`}
        />
        <div className="p-5">
          <ScatterChart
            ariaLabel="Cycle time scatter plot"
            points={done.map((i) => ({
              id: i.key,
              x: Date.parse(i.doneAt!),
              y: daysBetween(i.startedAt!, i.doneAt!),
              label: `${i.key} · ${squadName[i.squadId]}`,
              meta: i.summary,
            }))}
            xDomain={[current.startMs, current.endMs]}
            xFormat={(ms) => shortDate(ms)}
            yFormat={(v) => `${v.toFixed(v < 10 ? 1 : 0)}d`}
            yLabel="Cycle time"
            references={[
              { value: sc.current.cycleP50, label: '50th pct' },
              { value: sc.current.cycleP85, label: '85th pct' },
            ]}
          />
        </div>
      </Card>

      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Weekly throughput" subtitle="Items finished per week" />
          <div className="p-5">
            <BarChart
              ariaLabel="Weekly throughput"
              xLabels={tp.map((w) => shortDate(w.weekEndMs))}
              series={[{ id: 'tp', label: 'Items finished', values: tp.map((w) => w.count) }]}
              yFormat={(v) => `${Math.round(v)}`}
              reference={{ value: mean(tp.map((w) => w.count)), label: 'Average' }}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Cycle time distribution" subtitle="How long items took, start → done" />
          <div className="p-5">
            <BarChart
              ariaLabel="Cycle time distribution"
              xLabels={hist.labels}
              series={[{ id: 'h', label: 'Items', values: hist.counts, color: '#1c5cab' }]}
              yFormat={(v) => `${Math.round(v)}`}
              tooltipExtra={(i) => [{ label: 'Share', value: `${Math.round((hist.counts[i] / Math.max(1, done.length)) * 100)}%` }]}
            />
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Work in progress, oldest first"
          subtitle="Items still in progress, compared with their team’s 85th percentile cycle time — the best place to start a stand-up."
          actions={
            <Button
              icon={<MdDownload />}
              onClick={() =>
                downloadCsv(
                  'work-in-progress.csv',
                  ageing.map((r) => ({
                    key: r.item.key,
                    summary: r.item.summary,
                    squad: r.squad.name,
                    type: r.item.type,
                    age_days: r.age.toFixed(1),
                    squad_p85_days: r.p85.toFixed(1),
                  })),
                )
              }
            >
              Export CSV
            </Button>
          }
        />
        {ageing.length ? <AgeingWipTable rows={ageing} /> : <EmptyState title="No work in progress" />}
      </Card>
    </>
  );
}

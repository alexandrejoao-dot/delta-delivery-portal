import { useMemo, type ReactNode } from 'react';
import { MdOutlineAddCircleOutline, MdOutlineBugReport, MdOutlineCheckCircle, MdOutlineCompareArrows } from 'react-icons/md';
import { BarChart } from '../components/charts/BarChart';
import { LineChart } from '../components/charts/LineChart';
import { SortableTable } from '../components/SortableTable';
import { KpiCard } from '../components/KpiCard';
import { Card, CardHeader, cx, DeltaChip, EmptyState, PageHeader, SquadAvatar, StatusBadge } from '../components/ui';
import { formatMetric, shortDate } from '../lib/format';
import { navigate } from '../lib/router';
import { evaluate } from '../metrics/catalogue';
import { weekBuckets, windows } from '../metrics/period';
import { bugBalance } from '../metrics/quality';
import { scorecard } from '../metrics/scorecard';
import { metricTrend } from '../metrics/trend';
import { useScopedSquads } from '../state/filters';

function StatTile({ label, value, icon, delta }: { label: string; value: number; icon: ReactNode; delta: { text: string | null; improved: boolean | null } }) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
      <div className="flex items-start justify-between">
        <h3 className="text-label-md uppercase text-on-surface-variant">{label}</h3>
        <span className="text-[22px] text-primary">{icon}</span>
      </div>
      <div className="mt-3 text-display-lg tabular text-on-surface">{value}</div>
      <div className="mt-3">
        <DeltaChip text={delta.text} improved={delta.improved} />
        <span className="ml-1.5 text-label-sm text-on-surface-variant">vs prev. period</span>
      </div>
    </div>
  );
}

const signed = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `−${Math.abs(d)}` : '±0');

export function Quality() {
  const { data, squads, period, label } = useScopedSquads();
  const ids = useMemo(() => new Set(squads.map((s) => s.id)), [squads]);
  const items = useMemo(() => data.workItems.filter((i) => ids.has(i.squadId)), [data, ids]);
  const sc = useMemo(() => scorecard(data, squads, period), [data, squads, period]);
  const w = windows(data.asOf, period);
  const bal = bugBalance(items, w.current);
  const prevBal = bugBalance(items, w.previous);
  const trend = useMemo(() => metricTrend(data, squads, 'bugRatio', { points: 12, stepDays: 14, windowDays: 28 }), [data, squads]);
  const weekly = useMemo(
    () => weekBuckets(data.asOf, Math.round(period / 7)).map((b) => ({ endMs: b.endMs, ...bugBalance(items, b) })),
    [items, data.asOf, period],
  );
  const rows = useMemo(
    () =>
      squads.map((sq) => {
        const its = data.workItems.filter((i) => i.squadId === sq.id);
        return { squad: sq, index: data.squads.indexOf(sq), sc: scorecard(data, [sq], period), bal: bugBalance(its, windows(data.asOf, period).current) };
      }),
    [data, squads, period],
  );

  if (!squads.length) return <EmptyState title="No teams in this scope" />;
  const net = bal.created - bal.resolved;
  const prevNet = prevBal.created - prevBal.resolved;

  return (
    <>
      <PageHeader title="Quality" subtitle={`${label} · how much capacity goes to fixing rather than building? · last ${period} days`} />

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard metricId="bugRatio" sc={sc} trend={trend.map((t) => t.value)} icon={<MdOutlineBugReport />} periodLabel={`${period}d`} />
        <StatTile label="Bugs raised" value={bal.created} icon={<MdOutlineAddCircleOutline />} delta={{ text: signed(bal.created - prevBal.created), improved: bal.created === prevBal.created ? null : bal.created < prevBal.created }} />
        <StatTile label="Bugs resolved" value={bal.resolved} icon={<MdOutlineCheckCircle />} delta={{ text: signed(bal.resolved - prevBal.resolved), improved: null }} />
        <StatTile label="Net bug backlog change" value={net} icon={<MdOutlineCompareArrows />} delta={{ text: signed(net - prevNet), improved: net === prevNet ? null : net < prevNet }} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Bug ratio trend" subtitle="Share of finished work that was bugs · rolling 4 weeks" />
          <div className="p-5">
            <LineChart
              ariaLabel="Bug ratio trend"
              xLabels={trend.map((t) => shortDate(t.endMs))}
              series={[{ id: 'b', label: 'Bug ratio', values: trend.map((t) => t.value) }]}
              yFormat={(v) => `${Math.round(v * 100)}%`}
              yMin={0}
              target={{ value: 0.2, label: 'Healthy ≤ 20%' }}
              area
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Bugs raised vs resolved" subtitle="Per week — resolved below raised means the bug backlog is growing" />
          <div className="p-5">
            <BarChart
              ariaLabel="Bugs raised vs resolved per week"
              xLabels={weekly.map((x) => shortDate(x.endMs))}
              series={[
                { id: 'c', label: 'Raised', values: weekly.map((x) => x.created), color: '#eb6834' },
                { id: 'r', label: 'Resolved', values: weekly.map((x) => x.resolved), color: '#2a78d6' },
              ]}
              yFormat={(v) => `${Math.round(v)}`}
            />
          </div>
        </Card>
      </div>

      {squads.length > 1 && (
        <Card className="overflow-hidden">
          <CardHeader title="Quality by team" />
          <SortableTable
            rows={rows}
            rowKey={(r) => r.squad.id}
            onRowClick={(r) => navigate(`/teams/${r.squad.id}`)}
            initialSort={{ key: 'ratio', dir: 'desc' }}
            minWidth={720}
            columns={[
              {
                key: 'name',
                header: 'Team',
                sortValue: (r) => r.squad.name,
                render: (r) => (
                  <div className="flex items-center gap-3">
                    <SquadAvatar name={r.squad.name} index={r.index} />
                    <span className="font-semibold">{r.squad.name}</span>
                  </div>
                ),
              },
              {
                key: 'ratio',
                header: 'Bug ratio',
                sortValue: (r) => r.sc.current.bugRatio,
                render: (r) => (
                  <span className={cx('tabular font-medium', r.sc.status.bugRatio === 'attention' && 'font-semibold text-bad', r.sc.status.bugRatio === 'watch' && 'text-warn')}>
                    {formatMetric('bugRatio', r.sc.current.bugRatio)}
                  </span>
                ),
              },
              { key: 'c', header: 'Raised', align: 'right', sortValue: (r) => r.bal.created, render: (r) => <span className="tabular">{r.bal.created}</span> },
              { key: 'r', header: 'Resolved', align: 'right', sortValue: (r) => r.bal.resolved, render: (r) => <span className="tabular">{r.bal.resolved}</span> },
              {
                key: 'n',
                header: 'Net',
                align: 'right',
                sortValue: (r) => r.bal.created - r.bal.resolved,
                render: (r) => <span className="tabular">{signed(r.bal.created - r.bal.resolved)}</span>,
              },
              {
                key: 's',
                header: 'Signal',
                align: 'right',
                sortValue: (r) => r.sc.current.bugRatio,
                render: (r) => <StatusBadge size="sm" status={evaluate('bugRatio', r.sc.current.bugRatio)} />,
              },
            ]}
          />
        </Card>
      )}
    </>
  );
}

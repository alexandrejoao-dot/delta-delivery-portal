import { useMemo } from 'react';
import { MdDownload } from 'react-icons/md';
import type { Dataset, Squad } from '../data/model';
import { downloadCsv, formatMetric } from '../lib/format';
import { navigate } from '../lib/router';
import { METRICS, type MetricId } from '../metrics/catalogue';
import type { PeriodDays } from '../metrics/period';
import { scorecard, squadHealth, type Health, type Scorecard } from '../metrics/scorecard';
import { SortableTable, type Column } from './SortableTable';
import { Button, cx, SquadAvatar, StatusBadge, TeamTypeTag } from './ui';

interface Row {
  squad: Squad;
  index: number;
  domain: string;
  dl: string;
  sc: Scorecard;
  health: Health;
  reasons: MetricId[];
}

const healthRank: Record<Health, number> = { attention: 0, watch: 1, good: 2 };

export function useSquadRows(data: Dataset, squads: Squad[], period: PeriodDays): Row[] {
  return useMemo(
    () =>
      squads.map((sq) => {
        const sc = scorecard(data, [sq], period);
        const h = squadHealth(sc, sq.teamType);
        return {
          squad: sq,
          index: data.squads.indexOf(sq),
          domain: data.domains.find((d) => d.id === sq.domainId)?.name ?? '',
          dl: data.deliveryLeads.find((d) => d.id === sq.deliveryLeadId)?.name ?? '',
          sc,
          health: h.health,
          reasons: h.reasons,
        };
      }),
    [data, squads, period],
  );
}

function Cell({ row, id }: { row: Row; id: MetricId }) {
  const v = row.sc.current[id];
  const st = row.sc.status[id];
  return (
    <span className={cx('tabular font-medium', st === 'attention' && 'font-semibold text-bad', st === 'watch' && 'text-warn')}>
      {formatMetric(id, v, true)}
    </span>
  );
}

/** Predictability column shows the metric that applies to the squad's way of working. */
const predictabilityMetric = (r: Row): MetricId => (r.squad.teamType === 'scrum' ? 'sayDo' : 'throughputCv');

export function SquadMatrix({ data, squads, period, title = 'Squad health matrix' }: { data: Dataset; squads: Squad[]; period: PeriodDays; title?: string }) {
  const rows = useSquadRows(data, squads, period);

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Squad',
      sortValue: (r) => r.squad.name,
      render: (r) => (
        <div className="flex items-center gap-3">
          <SquadAvatar name={r.squad.name} index={r.index} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-semibold">
              {r.squad.name} <TeamTypeTag type={r.squad.teamType} />
            </div>
            <div className="truncate text-[12px] text-on-surface-variant">
              {r.domain} · {r.dl}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'health',
      header: 'Signal',
      tip: 'Any metric needing attention → Needs attention. Two or more on watch → Watch. Hover a badge to see which metrics drove it.',
      sortValue: (r) => healthRank[r.health],
      render: (r) => (
        <span title={r.reasons.length ? `Driven by: ${r.reasons.map((m) => METRICS[m].name).join(', ')}` : 'All signals on track'}>
          <StatusBadge status={r.health} />
        </span>
      ),
    },
    {
      key: 'pred',
      header: 'Predictability',
      tip: 'Scrum squads: Say/Do (higher is better). Kanban squads: throughput variability (lower is better).',
      sortValue: (r) => (r.squad.teamType === 'scrum' ? r.sc.current.sayDo : 1 - r.sc.current.throughputCv),
      render: (r) => (
        <div>
          <Cell row={r} id={predictabilityMetric(r)} />
          <div className="text-[11px] text-on-surface-variant">{r.squad.teamType === 'scrum' ? 'say/do' : 'variability'}</div>
        </div>
      ),
    },
    {
      key: 'scope',
      header: 'Scope change',
      tip: METRICS.scopeChange.description,
      sortValue: (r) => r.sc.current.scopeChange,
      render: (r) => (r.squad.teamType === 'scrum' ? <Cell row={r} id="scopeChange" /> : <span className="text-outline">n/a</span>),
    },
    {
      key: 'tp',
      header: 'Throughput',
      tip: `${METRICS.throughput.description} ${METRICS.throughput.caveat}`,
      sortValue: (r) => r.sc.current.throughput,
      render: (r) => (
        <span className="tabular font-medium">
          {formatMetric('throughput', r.sc.current.throughput, true)}
          <span className="text-[11px] text-on-surface-variant"> /wk</span>
        </span>
      ),
    },
    {
      key: 'ct',
      header: 'Cycle p85',
      tip: METRICS.cycleP85.description,
      sortValue: (r) => r.sc.current.cycleP85,
      render: (r) => <Cell row={r} id="cycleP85" />,
    },
    {
      key: 'age',
      header: 'Ageing WIP',
      tip: METRICS.ageingWipShare.description,
      sortValue: (r) => r.sc.current.ageingWipShare,
      render: (r) => (
        <span>
          <Cell row={r} id="ageingWipShare" />
          <span className="text-[11px] text-on-surface-variant"> of {r.sc.current.wip}</span>
        </span>
      ),
    },
    {
      key: 'bug',
      header: 'Bug ratio',
      tip: METRICS.bugRatio.description,
      sortValue: (r) => r.sc.current.bugRatio,
      render: (r) => <Cell row={r} id="bugRatio" />,
    },
  ];

  const exportCsv = () =>
    downloadCsv(
      `squad-matrix-${period}d.csv`,
      rows.map((r) => ({
        squad: r.squad.name,
        domain: r.domain,
        delivery_lead: r.dl,
        team_type: r.squad.teamType,
        say_do: r.sc.current.sayDo,
        scope_change: r.sc.current.scopeChange,
        throughput_per_week: r.sc.current.throughput,
        throughput_cv: r.sc.current.throughputCv,
        cycle_time_p85_days: r.sc.current.cycleP85,
        ageing_wip_share: r.sc.current.ageingWipShare,
        bug_ratio: r.sc.current.bugRatio,
        signal: r.health,
      })),
    );

  return (
    <section className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
      <div className="flex flex-col gap-3 border-b border-outline-variant px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-headline-sm text-on-surface">{title}</h3>
          <p className="mt-0.5 text-body-sm text-on-surface-variant">
            Last {period} days · click a squad for its detail. Signals start conversations — they are not rankings.
          </p>
        </div>
        <Button icon={<MdDownload />} onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
      <SortableTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.squad.id}
        onRowClick={(r) => navigate(`/squads/${r.squad.id}`)}
        initialSort={{ key: 'health', dir: 'asc' }}
      />
    </section>
  );
}

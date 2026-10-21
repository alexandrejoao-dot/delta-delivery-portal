import { useMemo } from 'react';
import { MdClose, MdDownload } from 'react-icons/md';
import type { Dataset, Squad } from '../data/model';
import { downloadCsv, formatMetric } from '../lib/format';
import { navigate } from '../lib/router';
import { METRICS, type MetricId } from '../metrics/catalogue';
import type { PeriodDays } from '../metrics/period';
import { scorecard, squadHealth, type Health, type Scorecard } from '../metrics/scorecard';
import { SortableTable, type Column } from './SortableTable';
import { Button, cx, MiniBar, SquadAvatar, StatusBadge, TeamTypeTag } from './ui';

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

/** Where Scrum and Kanban are measured differently, the column shows the metric for the squad's way of working. */
const stabilityMetric = (r: Row): MetricId => (r.squad.teamType === 'scrum' ? 'velocityCv' : 'throughputCv');

const Sub = ({ children }: { children: string }) => <div className="whitespace-nowrap text-[11px] text-on-surface-variant">{children}</div>;

interface MatrixProps {
  data: Dataset;
  squads: Squad[];
  period: PeriodDays;
  title?: string;
  /** Show only squads with this signal (e.g. from "Signals at a glance") */
  signalFilter?: Health | null;
  onClearFilter?: () => void;
  id?: string;
}

const filterLabel: Record<Health, string> = { attention: 'Needs attention', watch: 'Watch', good: 'On track' };

export function SquadMatrix({ data, squads, period, title = 'Squad health matrix', signalFilter, onClearFilter, id }: MatrixProps) {
  const allRows = useSquadRows(data, squads, period);
  const rows = signalFilter ? allRows.filter((r) => r.health === signalFilter) : allRows;

  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Squad',
      sortValue: (r) => r.squad.name,
      render: (r) => (
        <div className="flex items-center gap-3">
          <SquadAvatar name={r.squad.name} index={r.index} />
          <div className="min-w-0 max-w-[200px]">
            <div className="flex items-center gap-2 font-semibold">
              {r.squad.name} <TeamTypeTag type={r.squad.teamType} />
            </div>
            <div className="truncate text-[12px] text-on-surface-variant" title={`${r.domain} · ${r.dl}`}>
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
      key: 'hi',
      header: 'Health index',
      tip: `${METRICS.healthIndex.description} (0–100)`,
      sortValue: (r) => r.sc.current.healthIndex,
      render: (r) => (
        <div className="flex items-center gap-2">
          <Cell row={r} id="healthIndex" />
          <MiniBar value={r.sc.current.healthIndex / 100} status={r.sc.status.healthIndex ?? 'none'} className="w-10" />
        </div>
      ),
    },
    {
      key: 'completion',
      header: 'Completion ratio',
      tip: `Say/Do — ${METRICS.sayDo.description} Scrum only — Kanban has no sprint commitment.`,
      sortValue: (r) => (r.squad.teamType === 'scrum' ? r.sc.current.sayDo : NaN),
      render: (r) => (r.squad.teamType === 'scrum' ? <Cell row={r} id="sayDo" /> : <span className="text-outline">n/a</span>),
    },
    {
      key: 'ct',
      header: 'Cycle time',
      tip: METRICS.cycleP85.description,
      sortValue: (r) => r.sc.current.cycleP85,
      render: (r) => (
        <div>
          <Cell row={r} id="cycleP85" />
          <Sub>85th pct</Sub>
        </div>
      ),
    },
    {
      key: 'stability',
      header: 'Stability',
      tip: 'Variability (lower is steadier). Scrum: velocity sprint to sprint. Kanban: weekly throughput.',
      sortValue: (r) => r.sc.current[stabilityMetric(r)],
      render: (r) => (
        <div>
          <Cell row={r} id={stabilityMetric(r)} />
          <Sub>{r.squad.teamType === 'scrum' ? 'velocity' : 'throughput'}</Sub>
        </div>
      ),
    },
    {
      key: 'scope',
      header: 'Scope volatility',
      tip: `${METRICS.scopeChange.description} Scrum only — Kanban has no fixed commitment.`,
      sortValue: (r) => (r.squad.teamType === 'scrum' ? r.sc.current.scopeChange : NaN),
      render: (r) => (r.squad.teamType === 'scrum' ? <Cell row={r} id="scopeChange" /> : <span className="text-outline">n/a</span>),
    },
    {
      key: 'forecastAccuracy',
      header: 'Forecasting accuracy',
      tip: `${METRICS.forecastAccuracy.description} ${METRICS.forecastAccuracy.caveat}`,
      sortValue: (r) => r.sc.current.forecastAccuracy,
      render: (r) => (
        <div>
          <Cell row={r} id="forecastAccuracy" />
          <Sub>2-wk forecasts met</Sub>
        </div>
      ),
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
        signal: r.health,
        health_index: r.sc.current.healthIndex,
        completion_ratio: r.squad.teamType === 'scrum' ? r.sc.current.sayDo : '',
        cycle_time_p85_days: r.sc.current.cycleP85,
        stability_cv: r.sc.current[stabilityMetric(r)],
        stability_metric: stabilityMetric(r),
        scope_volatility: r.squad.teamType === 'scrum' ? r.sc.current.scopeChange : '',
        forecasting_accuracy: r.sc.current.forecastAccuracy,
      })),
    );

  return (
    <section id={id} className="scroll-mt-24 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest">
      <div className="flex flex-col gap-3 border-b border-outline-variant px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-headline-sm text-on-surface">{title}</h3>
          <p className="mt-0.5 text-body-sm text-on-surface-variant">
            Last {period} days · click a squad for its detail. Signals start conversations — they are not rankings.
          </p>
          {signalFilter && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-body-sm text-on-surface-variant" role="status">
              <span>Showing</span>
              <StatusBadge status={signalFilter} size="sm" label={filterLabel[signalFilter]} />
              <span>
                {rows.length} of {allRows.length} squads
              </span>
              {onClearFilter && (
                <button type="button" onClick={onClearFilter} className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-label-md text-series-1 hover:bg-surface-container-low">
                  <MdClose className="text-[14px]" aria-hidden />
                  Clear
                </button>
              )}
            </div>
          )}
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
        fitWidth
      />
    </section>
  );
}

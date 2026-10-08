import type { Dataset, Squad, TeamType } from '../data/model';
import { evaluate, METRICS, type MetricId, type Status } from './catalogue';
import { ageingWip, cycleTimePercentile, leadTimes, throughputPerWeek, throughputVariability } from './flow';
import { windows, type PeriodDays, type Window } from './period';
import { avgVelocity, goalHitRate, sayDo, scopeChange, sprintsEndingIn, velocityVariability } from './predictability';
import { bugRatio } from './quality';
import { percentile } from './stats';

export type MetricValues = Record<MetricId, number>;

export interface Scorecard {
  current: MetricValues;
  previous: MetricValues;
  status: Partial<Record<MetricId, Status>>;
  squadCount: number;
  teamTypes: TeamType[];
}

const median = (xs: number[]) => percentile(xs.filter(Number.isFinite), 50);

/** All metric values for a group of squads over one window (pooled where pooling is valid). */
export function computeValues(data: Dataset, squads: Squad[], w: Window): MetricValues {
  const ids = new Set(squads.map((s) => s.id));
  const items = data.workItems.filter((i) => ids.has(i.squadId));
  const scrumIds = new Set(squads.filter((s) => s.teamType === 'scrum').map((s) => s.id));
  const kanbanSquads = squads.filter((s) => s.teamType === 'kanban');
  const sprints = sprintsEndingIn(
    data.sprints.filter((s) => scrumIds.has(s.squadId)),
    w,
  );
  const isCurrent = w.endMs === Date.parse(data.asOf);
  const ageing = ageingWip(items, data.asOf);

  return {
    sayDo: sayDo(sprints),
    scopeChange: scopeChange(sprints),
    velocity: squads.length === 1 ? avgVelocity(sprints) : NaN, // never aggregated across squads
    velocityCv: median([...scrumIds].map((id) => velocityVariability(sprints.filter((s) => s.squadId === id)))),
    goalHitRate: goalHitRate(sprints),
    throughput: throughputPerWeek(items, w),
    throughputCv: median(
      kanbanSquads.map((s) => throughputVariability(items.filter((i) => i.squadId === s.id), w)),
    ),
    cycleP50: cycleTimePercentile(items, w, 50),
    cycleP85: cycleTimePercentile(items, w, 85),
    leadP85: percentile(leadTimes(items, w), 85),
    wip: isCurrent ? ageing.wip.length : NaN,
    ageingWipShare: isCurrent ? ageing.share : NaN,
    bugRatio: bugRatio(items, w),
  };
}

export function scorecard(data: Dataset, squads: Squad[], period: PeriodDays): Scorecard {
  const { current, previous } = windows(data.asOf, period);
  const cur = computeValues(data, squads, current);
  const prev = computeValues(data, squads, previous);
  const teamTypes = [...new Set(squads.map((s) => s.teamType))];
  const status: Partial<Record<MetricId, Status>> = {};
  (Object.keys(cur) as MetricId[]).forEach((id) => {
    if (METRICS[id].appliesTo.some((t) => teamTypes.includes(t))) status[id] = evaluate(id, cur[id]);
  });
  return { current: cur, previous: prev, status, squadCount: squads.length, teamTypes };
}

export type Health = 'good' | 'watch' | 'attention';

/** Metrics that feed the overall squad health signal, by team type. */
export const HEALTH_SIGNALS: Record<TeamType, MetricId[]> = {
  scrum: ['sayDo', 'scopeChange', 'velocityCv', 'cycleP85', 'ageingWipShare', 'bugRatio'],
  kanban: ['throughputCv', 'cycleP85', 'ageingWipShare', 'bugRatio'],
};

/**
 * Overall health: any metric needing attention → attention; two or more on watch → watch; else good.
 * Deliberately simple and explainable — every badge can be traced to the metrics behind it.
 */
export function squadHealth(sc: Scorecard, teamType: TeamType): { health: Health; reasons: MetricId[] } {
  const signals = HEALTH_SIGNALS[teamType];
  const attention = signals.filter((m) => sc.status[m] === 'attention');
  const watch = signals.filter((m) => sc.status[m] === 'watch');
  if (attention.length) return { health: 'attention', reasons: [...attention, ...watch] };
  if (watch.length >= 2) return { health: 'watch', reasons: watch };
  return { health: 'good', reasons: watch };
}

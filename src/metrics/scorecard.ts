import type { Dataset, Squad, TeamType } from '../data/model';
import { evaluate, metricScore, METRICS, type MetricId, type Status } from './catalogue';
import { ageingWip, cycleTimePercentile, leadTimes, throughputPerWeek, throughputVariability } from './flow';
import { deliveryForecast, forecastAccuracy } from './forecast';
import { windows, type PeriodDays, type Window } from './period';
import { avgVelocity, goalHitRate, sayDo, scopeChange, sprintsEndingIn, velocityVariability } from './predictability';
import { categoryMix } from './investment';
import { pulseScore } from './pulse';
import { bugRatio } from './quality';
import { mean, percentile } from './stats';

export type MetricValues = Record<MetricId, number>;

export interface Scorecard {
  current: MetricValues;
  previous: MetricValues;
  status: Partial<Record<MetricId, Status>>;
  squadCount: number;
  teamTypes: TeamType[];
}

const median = (xs: number[]) => percentile(xs.filter(Number.isFinite), 50);

type DerivedId = 'healthIndex';
type BaseValues = Omit<MetricValues, DerivedId>;

/**
 * All metric values for a group of squads over one window (pooled where pooling is valid).
 * `need` limits the expensive metrics (Monte Carlo, health index) to the ones the caller uses;
 * anything not needed comes back as NaN. Omit it to get everything.
 */
export function computeValues(data: Dataset, squads: Squad[], w: Window, need?: MetricId[]): MetricValues {
  const base = baseValues(data, squads, w, need);
  if (need && !need.includes('healthIndex')) return { ...base, healthIndex: NaN };
  // Health index is per squad, then averaged, so each squad counts once. A single squad can reuse
  // `base` only when it was computed in full — a `need` list may have left the index inputs out.
  const perSquad = squads.map((s) =>
    squadHealthIndex(squads.length === 1 && !need ? base : baseValues(data, [s], w, HEALTH_INDEX_INPUTS[s.teamType]), s.teamType),
  );
  return { ...base, healthIndex: mean(perSquad.filter(Number.isFinite)) };
}

/** Health index inputs by team type — the matrix indicators plus lead time and pulse, equally weighted. */
export const HEALTH_INDEX_INPUTS: Record<TeamType, MetricId[]> = {
  scrum: ['sayDo', 'cycleP85', 'velocityCv', 'scopeChange', 'leadP85', 'pulseScore'],
  kanban: ['cycleP85', 'throughputCv', 'leadP85', 'pulseScore'],
};

/** Below this many scorable inputs the index is not shown — too little to summarise. */
export const MIN_HEALTH_INDEX_INPUTS = 3;

/** 0–100: equal-weight mean of the squad's input scores (see `metricScore`). */
export function squadHealthIndex(values: Partial<MetricValues>, teamType: TeamType): number {
  const scores = HEALTH_INDEX_INPUTS[teamType].map((m) => metricScore(m, values[m] ?? NaN)).filter(Number.isFinite);
  return scores.length >= MIN_HEALTH_INDEX_INPUTS ? mean(scores) : NaN;
}

function baseValues(data: Dataset, squads: Squad[], w: Window, need?: MetricId[]): BaseValues {
  const ids = new Set(squads.map((s) => s.id));
  const items = data.workItems.filter((i) => ids.has(i.squadId));
  const scrumIds = new Set(squads.filter((s) => s.teamType === 'scrum').map((s) => s.id));
  const kanbanSquads = squads.filter((s) => s.teamType === 'kanban');
  const sprints = sprintsEndingIn(
    data.sprints.filter((s) => scrumIds.has(s.squadId)),
    w,
  );
  const isCurrent = w.endMs === Date.parse(data.asOf);
  // WIP and ageing are measured at the end of the window, so past windows (deltas, trends) work too
  let ageingMemo: ReturnType<typeof ageingWip> | undefined;
  const ageing = () => (ageingMemo ??= ageingWip(items, new Date(w.endMs).toISOString()));

  // Each metric is computed only if needed — trends ask for one metric at a time
  const calc: { [K in keyof BaseValues]: () => number } = {
    sayDo: () => sayDo(sprints),
    scopeChange: () => scopeChange(sprints),
    velocity: () => (squads.length === 1 ? avgVelocity(sprints) : NaN), // never aggregated across squads
    velocityCv: () => median([...scrumIds].map((id) => velocityVariability(sprints.filter((s) => s.squadId === id)))),
    goalHitRate: () => goalHitRate(sprints),
    throughput: () => throughputPerWeek(items, w),
    throughputCv: () => median(kanbanSquads.map((s) => throughputVariability(items.filter((i) => i.squadId === s.id), w))),
    cycleP50: () => cycleTimePercentile(items, w, 50),
    cycleP85: () => cycleTimePercentile(items, w, 85),
    leadP85: () => percentile(leadTimes(items, w), 85),
    wip: () => (isCurrent ? ageing().wip.length : NaN),
    ageingWipShare: () => (ageing().wip.length ? ageing().share : NaN),
    bugRatio: () => bugRatio(items, w),
    pulseScore: () =>
      pulseScore(
        data.pulseChecks.filter((p) => ids.has(p.squadId)),
        w,
      ),
    featureShare: () => categoryMix(items, w).feature,
    deliveryForecast: () => deliveryForecast(items, w),
    forecastAccuracy: () => forecastAccuracy(items, w),
  };
  const out = {} as BaseValues;
  for (const id of Object.keys(calc) as (keyof BaseValues)[]) out[id] = !need || need.includes(id) ? calc[id]() : NaN;
  return out;
}

/**
 * Scorecards are pure functions of (dataset, squads, period) and several views ask for the same ones
 * (matrix, highlights, insights), so they're memoised per dataset. Datasets are never mutated.
 */
const cache = new WeakMap<Dataset, Map<string, Scorecard>>();

export function scorecard(data: Dataset, squads: Squad[], period: PeriodDays): Scorecard {
  const key = `${period}|${squads.map((s) => s.id).join(',')}`;
  let byKey = cache.get(data);
  if (!byKey) cache.set(data, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit) return hit;
  const sc = buildScorecard(data, squads, period);
  byKey.set(key, sc);
  return sc;
}

function buildScorecard(data: Dataset, squads: Squad[], period: PeriodDays): Scorecard {
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

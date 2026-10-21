import type { TeamType } from '../data/model';

/**
 * Metric catalogue — the in-app mirror of the KPI Playbook.
 * One definition per metric: what it means, how it is computed, where the data comes from,
 * and the thresholds used for signals. Change thresholds HERE only.
 */

export type MetricId =
  | 'sayDo'
  | 'scopeChange'
  | 'velocity'
  | 'velocityCv'
  | 'goalHitRate'
  | 'throughput'
  | 'throughputCv'
  | 'cycleP50'
  | 'cycleP85'
  | 'leadP85'
  | 'wip'
  | 'ageingWipShare'
  | 'bugRatio'
  | 'healthIndex'
  | 'pulseScore'
  | 'okrShare'
  | 'deliveryForecast'
  | 'forecastAccuracy';

export type MetricCategory = 'Health' | 'Predictability' | 'Flow' | 'Quality' | 'Investment' | 'Forecast';
export type Direction = 'higher' | 'lower' | 'neutral';
export type Unit = 'percent' | 'days' | 'points' | 'perWeek' | 'count' | 'index' | 'score' | 'items';
export type Status = 'good' | 'watch' | 'attention' | 'none';

export interface MetricDefinition {
  id: MetricId;
  name: string;
  category: MetricCategory;
  unit: Unit;
  direction: Direction;
  appliesTo: TeamType[];
  description: string;
  formula: string;
  source: string;
  /** For 'higher': value >= good → good, >= watch → watch, else attention. For 'lower': mirrored. */
  thresholds?: { good: number; watch: number };
  caveat?: string;
}

export const METRICS: Record<MetricId, MetricDefinition> = {
  sayDo: {
    id: 'sayDo',
    name: 'Commitment reliability (Say/Do)',
    category: 'Predictability',
    unit: 'percent',
    direction: 'higher',
    appliesTo: ['scrum'],
    description: 'How much of what the squad committed to at sprint start was actually completed.',
    formula: 'Σ completed committed points ÷ Σ committed points (sprints ending in period)',
    source: 'eazyBI — Sprint scope report (committed / completed-of-committed)',
    thresholds: { good: 0.8, watch: 0.65 },
    caveat: 'Not a productivity score. 100% every sprint can signal sandbagging; aim for a stable 80–90%.',
  },
  scopeChange: {
    id: 'scopeChange',
    name: 'Mid-sprint scope change',
    category: 'Predictability',
    unit: 'percent',
    direction: 'lower',
    appliesTo: ['scrum'],
    description: 'Work added after the sprint started, relative to the original commitment.',
    formula: 'Σ added points ÷ Σ committed points',
    source: 'eazyBI — Sprint scope report (added after start)',
    thresholds: { good: 0.15, watch: 0.3 },
    caveat: 'Some added scope is healthy (urgent bugs). Look at the trend and the cause, not the absolute number.',
  },
  velocity: {
    id: 'velocity',
    name: 'Velocity',
    category: 'Predictability',
    unit: 'points',
    direction: 'neutral',
    appliesTo: ['scrum'],
    description: 'Story points completed per sprint (committed + added).',
    formula: 'mean(completed committed + completed added) per sprint',
    source: 'eazyBI — Sprint scope report',
    caveat: 'Planning input for the squad itself. Never compare velocity across squads — points are not a shared currency.',
  },
  velocityCv: {
    id: 'velocityCv',
    name: 'Velocity variability',
    category: 'Predictability',
    unit: 'percent',
    direction: 'lower',
    appliesTo: ['scrum'],
    description: 'How much velocity swings sprint to sprint. Lower = easier to forecast.',
    formula: 'stdev(velocity) ÷ mean(velocity) — per squad; groups show the median squad',
    source: 'Derived from sprint scope report',
    thresholds: { good: 0.2, watch: 0.3 },
  },
  goalHitRate: {
    id: 'goalHitRate',
    name: 'Sprint goal hit rate',
    category: 'Predictability',
    unit: 'percent',
    direction: 'higher',
    appliesTo: ['scrum'],
    description: 'Share of sprints where the sprint goal was met.',
    formula: 'sprints with goal met ÷ sprints',
    source: 'Sprint review outcome (Jira sprint field / custom field)',
    thresholds: { good: 0.7, watch: 0.5 },
  },
  throughput: {
    id: 'throughput',
    name: 'Throughput',
    category: 'Flow',
    unit: 'perWeek',
    direction: 'neutral',
    appliesTo: ['scrum', 'kanban'],
    description: 'Work items finished per week.',
    formula: 'count(items moved to Done in period) ÷ weeks in period',
    source: 'eazyBI — Issues resolved (Done status category)',
    caveat: 'Item sizes differ between squads. Use for a squad’s own trend and forecasting, not for ranking.',
  },
  throughputCv: {
    id: 'throughputCv',
    name: 'Throughput variability',
    category: 'Predictability',
    unit: 'percent',
    direction: 'lower',
    appliesTo: ['kanban'],
    description: 'Week-to-week stability of throughput — the Kanban equivalent of Say/Do for forecasting.',
    formula: 'stdev(weekly throughput) ÷ mean(weekly throughput)',
    source: 'Derived from issues resolved',
    thresholds: { good: 0.35, watch: 0.5 },
  },
  cycleP50: {
    id: 'cycleP50',
    name: 'Cycle time (50th pct)',
    category: 'Flow',
    unit: 'days',
    direction: 'lower',
    appliesTo: ['scrum', 'kanban'],
    description: 'Typical time from starting work to finishing it.',
    formula: '50th percentile of (Done − first In Progress), items done in period',
    source: 'eazyBI / Jira changelog — status category transitions',
  },
  cycleP85: {
    id: 'cycleP85',
    name: 'Cycle time (85th pct)',
    category: 'Flow',
    unit: 'days',
    direction: 'lower',
    appliesTo: ['scrum', 'kanban'],
    description: '85% of items finish within this many days — the number to use for service-level expectations.',
    formula: '85th percentile of (Done − first In Progress), items done in period',
    source: 'eazyBI / Jira changelog — status category transitions',
    thresholds: { good: 10, watch: 15 },
  },
  leadP85: {
    id: 'leadP85',
    name: 'Lead time (85th pct)',
    category: 'Flow',
    unit: 'days',
    direction: 'lower',
    appliesTo: ['scrum', 'kanban'],
    description: 'Time from the item being created to it being done — what a stakeholder experiences.',
    formula: '85th percentile of (Done − Created), items done in period',
    source: 'eazyBI — Issue created / resolved dates',
    thresholds: { good: 20, watch: 28 },
    caveat: 'Includes time waiting in the backlog, so it reflects prioritisation as much as delivery speed.',
  },
  wip: {
    id: 'wip',
    name: 'Work in progress',
    category: 'Flow',
    unit: 'count',
    direction: 'neutral',
    appliesTo: ['scrum', 'kanban'],
    description: 'Items started but not finished at the snapshot.',
    formula: 'count(items In Progress at snapshot)',
    source: 'eazyBI — current status category',
  },
  ageingWipShare: {
    id: 'ageingWipShare',
    name: 'Ageing WIP',
    category: 'Flow',
    unit: 'percent',
    direction: 'lower',
    appliesTo: ['scrum', 'kanban'],
    description: 'Share of in-progress items already older than the squad’s 85th percentile cycle time.',
    formula: 'count(WIP with age > p85 cycle time of the 90 days before) ÷ WIP — at the end of the period',
    source: 'Derived — current WIP vs recent cycle time',
    thresholds: { good: 0.2, watch: 0.4 },
    caveat: 'A leading indicator: these items are where forecasts break. Great input for daily stand-ups.',
  },
  bugRatio: {
    id: 'bugRatio',
    name: 'Bug ratio',
    category: 'Quality',
    unit: 'percent',
    direction: 'lower',
    appliesTo: ['scrum', 'kanban'],
    description: 'Share of finished work that was fixing bugs rather than delivering new value.',
    formula: 'bugs done ÷ all items done (period)',
    source: 'eazyBI — Issues resolved by issue type',
    thresholds: { good: 0.2, watch: 0.3 },
  },
  healthIndex: {
    id: 'healthIndex',
    name: 'Health index',
    category: 'Health',
    unit: 'index',
    direction: 'higher',
    appliesTo: ['scrum', 'kanban'],
    description:
      'One consolidated number: completion ratio, cycle time, stability, scope volatility, lead time and pulse check, each scored 0–100 against its own thresholds and weighted equally.',
    formula:
      'per squad: mean of input scores (100 at the on-track threshold, 50 at watch, 0 one band beyond; needs ≥ 3 inputs). Scrum: 6 inputs, Kanban: 4 (no completion ratio or scope volatility). Groups: mean of squads',
    source: 'Derived — see each input metric for its source',
    thresholds: { good: 80, watch: 50 },
    caveat: 'A summary, not a grade. Open the squad to see which inputs move it; each squad counts once, whatever its size.',
  },
  pulseScore: {
    id: 'pulseScore',
    name: 'Pulse check',
    category: 'Health',
    unit: 'score',
    direction: 'higher',
    appliesTo: ['scrum', 'kanban'],
    description: 'How the squad feels about how it works — the squad health check (value, release, codebase, fun, learning…).',
    formula: 'mean of dimension scores (1–5) from each squad’s latest pulse in period; groups: mean of squads',
    source: 'Squad health check survey (monthly)',
    thresholds: { good: 3.8, watch: 3.3 },
    caveat: 'The squad’s own read of itself — use it to start a conversation, never to rank squads. Pulses with fewer than 3 respondents are hidden.',
  },
  okrShare: {
    id: 'okrShare',
    name: 'Development categories',
    category: 'Investment',
    unit: 'percent',
    direction: 'neutral',
    appliesTo: ['scrum', 'kanban'],
    description: 'Where effort goes: OKR aligned, non-OKR aligned, keep the lights on and L&D. Headline shows the OKR-aligned share.',
    formula: 'items done per category ÷ all items done (period)',
    source: 'eazyBI — Issues resolved by work category',
    caveat: 'There is no right mix. Agree a target split with product and engineering, then watch for drift.',
  },
  deliveryForecast: {
    id: 'deliveryForecast',
    name: 'Delivery forecast',
    category: 'Forecast',
    unit: 'items',
    direction: 'neutral',
    appliesTo: ['scrum', 'kanban'],
    description: 'How many items the squad will finish in the next 2 weeks, with 85% confidence.',
    formula: 'Monte Carlo: 2,000 simulations of 14 days, each day resampled from the last 84 days of daily throughput; 15th percentile of totals',
    source: 'Derived from issues resolved',
    caveat: 'A forecast for the squad’s own planning, built from its own history. Item sizes differ, so do not compare squads.',
  },
  forecastAccuracy: {
    id: 'forecastAccuracy',
    name: 'Forecasting accuracy',
    category: 'Forecast',
    unit: 'percent',
    direction: 'higher',
    appliesTo: ['scrum', 'kanban'],
    description: 'How often the 2-week delivery forecast came true — can stakeholders rely on what we say we’ll deliver?',
    formula: 'backtest: each week in the period, forecast items for the next 14 days (85% confidence) from the history available then; share of forecasts where actual ≥ forecast',
    source: 'Derived from issues resolved',
    thresholds: { good: 0.8, watch: 0.65 },
    caveat: 'An 85% forecast should be met about 85% of the time. Consistently 100% can mean the history is unusually steady — or that the squad is pacing to the forecast.',
  },
};

export const METRIC_LIST = Object.values(METRICS);

export function evaluate(id: MetricId, value: number): Status {
  const def = METRICS[id];
  if (!def.thresholds || !Number.isFinite(value)) return 'none';
  const { good, watch } = def.thresholds;
  if (def.direction === 'higher') return value >= good ? 'good' : value >= watch ? 'watch' : 'attention';
  if (def.direction === 'lower') return value <= good ? 'good' : value <= watch ? 'watch' : 'attention';
  return 'none';
}

/**
 * 0–100 score anchored on the metric's own thresholds, so metrics in different units can be averaged
 * with equal weight: 100 at the "good" threshold (capped — beating the target earns nothing extra),
 * 50 at the "watch" threshold, 0 one band further out ("floor"), linear in between.
 * Bands line up with `evaluate`: on track = 100, watch = 50–99, needs attention = below 50.
 */
export function scoreAnchors(id: MetricId) {
  const t = METRICS[id].thresholds;
  return t ? { full: t.good, half: t.watch, zero: t.watch + (t.watch - t.good) } : null;
}

export function metricScore(id: MetricId, value: number): number {
  const a = scoreAnchors(id);
  if (!a || !Number.isFinite(value)) return NaN;
  const t = (value - a.zero) / (a.full - a.zero); // same formula for higher- and lower-is-better
  return Math.min(1, Math.max(0, t)) * 100;
}

/** Is a change from prev → curr an improvement? null when neutral / unknown. */
export function isImprovement(id: MetricId, curr: number, prev: number): boolean | null {
  const dir = METRICS[id].direction;
  if (dir === 'neutral' || !Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  // Ignore changes that disappear at display precision (avoids red/green on "±0")
  const unit = METRICS[id].unit;
  const scale = unit === 'percent' ? 100 : unit === 'index' || unit === 'items' ? 1 : 10;
  if (Math.round(curr * scale) === Math.round(prev * scale)) return null;
  return dir === 'higher' ? curr > prev : curr < prev;
}

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
  | 'bugRatio';

export type MetricCategory = 'Predictability' | 'Flow' | 'Quality';
export type Direction = 'higher' | 'lower' | 'neutral';
export type Unit = 'percent' | 'days' | 'points' | 'perWeek' | 'count';
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
    formula: 'count(WIP with age > p85 cycle time, last 90d) ÷ WIP',
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

/** Is a change from prev → curr an improvement? null when neutral / unknown. */
export function isImprovement(id: MetricId, curr: number, prev: number): boolean | null {
  const dir = METRICS[id].direction;
  if (dir === 'neutral' || !Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  // Ignore changes that disappear at display precision (avoids red/green on "±0")
  const scale = METRICS[id].unit === 'percent' ? 100 : 10;
  if (Math.round(curr * scale) === Math.round(prev * scale)) return null;
  return dir === 'higher' ? curr > prev : curr < prev;
}

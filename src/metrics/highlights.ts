import type { Dataset, Squad } from '../data/model';
import { evaluate, metricScore, METRICS, type MetricId, type Status } from './catalogue';
import { windows, type PeriodDays } from './period';
import { HEALTH_INDEX_INPUTS, HEALTH_SIGNALS, scorecard } from './scorecard';

/**
 * Highlights — the "news" of the period: what dropped and needs a heads-up, and what is worth celebrating.
 * Changes are compared on the 0–100 threshold-anchored score (see `metricScore`), so a move in days,
 * percentages or survey points is weighed on the same scale. Rule-based and traceable to one metric each.
 */

export type HighlightKind = 'drop' | 'milestone' | 'rise';

export interface Highlight {
  id: string;
  kind: HighlightKind;
  squadId: string;
  metricId: MetricId;
  from: number;
  to: number;
  status: Status;
  /** Score points gained (+) or lost (−) on the 0–100 scale — used to rank */
  delta: number;
}

/** A drop of this many score points (or a status getting worse) makes the news. */
export const DROP_MIN = 20;
/** A rise of this many points is news even without crossing a threshold. */
export const RISE_MIN = 25;

const rank: Record<Status, number> = { good: 2, watch: 1, attention: 0, none: -1 };

/** Indicators considered: the health index inputs plus the signal-badge inputs for the squad's team type. */
const candidates = (sq: Squad): MetricId[] =>
  [...new Set([...HEALTH_INDEX_INPUTS[sq.teamType], ...HEALTH_SIGNALS[sq.teamType]])].filter((id) => METRICS[id].thresholds);

/** Earliest work item creation — the start of usable history. */
export const historyStartMs = (data: Dataset) => Math.min(...data.workItems.map((i) => Date.parse(i.createdAt)));

/** A period-over-period comparison is only fair when the previous period is fully covered by data. */
export const canCompare = (data: Dataset, period: PeriodDays) => windows(data.asOf, period).previous.startMs >= historyStartMs(data);

export function findHighlights(data: Dataset, squads: Squad[], period: PeriodDays): Highlight[] {
  if (!canCompare(data, period)) return [];
  const out: Highlight[] = [];
  for (const sq of squads) {
    const sc = scorecard(data, [sq], period);
    for (const id of candidates(sq)) {
      const to = sc.current[id];
      const from = sc.previous[id];
      if (!Number.isFinite(to) || !Number.isFinite(from)) continue;
      const delta = metricScore(id, to) - metricScore(id, from);
      const st = evaluate(id, to);
      const prevSt = evaluate(id, from);
      let kind: HighlightKind | null = null;
      if (delta < 0 && (delta <= -DROP_MIN || rank[st] < rank[prevSt])) kind = 'drop';
      else if (st === 'good' && prevSt !== 'good') kind = 'milestone';
      else if (delta >= RISE_MIN) kind = 'rise';
      if (kind) out.push({ id: `${sq.id}-${id}-${kind}`, kind, squadId: sq.id, metricId: id, from, to, status: st, delta });
    }
  }
  return out;
}

/**
 * Pick a balanced set: the biggest drop, the biggest win, then whichever is bigger of the next of each.
 * Wins rank target-met milestones above plain rises of the same size.
 */
export function pickHighlights(all: Highlight[], count = 3): Highlight[] {
  const drops = all.filter((h) => h.kind === 'drop').sort((a, b) => a.delta - b.delta);
  const wins = all
    .filter((h) => h.kind !== 'drop')
    .sort((a, b) => b.delta + (b.kind === 'milestone' ? 10 : 0) - (a.delta + (a.kind === 'milestone' ? 10 : 0)));
  const picked: Highlight[] = [];
  const usedSquads = new Set<string>();
  // Prefer different squads, so the frame isn't three stories about one team
  const take = (list: Highlight[]) => {
    const h = list.find((x) => !picked.includes(x) && !usedSquads.has(x.squadId)) ?? list.find((x) => !picked.includes(x));
    if (h) {
      picked.push(h);
      usedSquads.add(h.squadId);
    }
    return h;
  };
  take(drops);
  take(wins);
  while (picked.length < count) {
    const d = drops.find((x) => !picked.includes(x));
    const w = wins.find((x) => !picked.includes(x));
    if (!d && !w) break;
    take(!w || (d && -d.delta > w.delta) ? drops : wins);
  }
  return picked;
}

export const highlights = (data: Dataset, squads: Squad[], period: PeriodDays, count = 3) =>
  pickHighlights(findHighlights(data, squads, period), count);

/** Coaching prompt for a drop — what to look at first. */
const DROP_PROMPTS: Partial<Record<MetricId, string>> = {
  sayDo: 'Is the team planning to recent velocity, or to capacity?',
  scopeChange: 'Where is the mid-sprint work coming from — could some of it wait for planning?',
  velocityCv: 'Are sprints disrupted by unplanned work, or is estimation drifting?',
  throughputCv: 'Is unplanned work or item size making weeks uneven?',
  cycleP85: 'Are items waiting on reviews, environments or other teams?',
  leadP85: 'Is work waiting longer in the backlog before it is picked up?',
  pulseScore: 'Look at the lowest pulse dimensions together at the next retro.',
  bugRatio: 'Is there a common source — a release or a component — worth a focused fix?',
  ageingWipShare: 'Start the next stand-up with the oldest items in progress.',
};

export interface HighlightText {
  label: string;
  headline: string;
  body: string;
  prompt: string;
}

/** Plain-language story for a highlight. `fmt` formats a value in the metric's unit. */
export function describeHighlight(h: Highlight, squadName: string, period: PeriodDays, fmt: (id: MetricId, v: number) => string): HighlightText {
  const def = METRICS[h.metricId];
  const name = def.name.replace(/\s*\(.*\)$/, '');
  const metric = name.charAt(0).toLowerCase() + name.slice(1);
  const higherIsBetter = def.direction === 'higher';
  const went = h.to > h.from ? 'Up' : 'Down';
  const since = `the previous ${period} days`;
  if (h.kind === 'drop') {
    return {
      label: 'Heads-up',
      headline: `${squadName}: ${metric} ${higherIsBetter ? 'fell' : 'rose'} to ${fmt(h.metricId, h.to)}`,
      body: `${went} from ${fmt(h.metricId, h.from)} in ${since} — now ${h.status === 'attention' ? 'needs attention' : 'on watch'}.`,
      prompt: DROP_PROMPTS[h.metricId] ?? 'What changed for the team this period?',
    };
  }
  if (h.kind === 'milestone') {
    return {
      label: 'Target met',
      headline: `${squadName}: ${metric} is on track`,
      body: `${went} from ${fmt(h.metricId, h.from)} to ${fmt(h.metricId, h.to)} — ${higherIsBetter ? 'at or above' : 'within'} the ${fmt(h.metricId, def.thresholds!.good)} target.`,
      prompt: 'What made the difference? Worth sharing with other teams.',
    };
  }
  return {
    label: 'Big improvement',
    headline: `${squadName}: ${metric} improved to ${fmt(h.metricId, h.to)}`,
    body: `${went} from ${fmt(h.metricId, h.from)} in ${since}. Not on track yet, but clearly moving the right way.`,
    prompt: 'Keep going — what is helping, and can the team protect it?',
  };
}

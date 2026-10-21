import { describe, expect, it } from 'vitest';
import { PULSE_DIMENSIONS, type PulseCheck, type PulseDimension, type Sprint, type WorkItem } from '../../data/model';
import { generateDataset } from '../../data/sources/mock/generator';
import { evaluate, isImprovement, metricScore } from '../catalogue';
import { ageingWip, cycleTimes, throughputPerWeek, wipAt } from '../flow';
import { dailyThroughput, forecastAccuracy, forecastBacktest, forecastItems } from '../forecast';
import { categoryMix } from '../investment';
import { canCompare, findHighlights, pickHighlights, type Highlight } from '../highlights';
import { latestPulses, pulseDimensions, pulseScore } from '../pulse';
import { DAY_MS, windows } from '../period';
import { sayDo, scopeChange, velocityVariability } from '../predictability';
import { bugRatio } from '../quality';
import { scorecard, squadHealth, squadHealthIndex } from '../scorecard';
import { cv, percentile } from '../stats';
import { metricTrend } from '../trend';

const AS_OF = '2026-10-02T00:00:00.000Z';
const day = (n: number) => new Date(Date.parse(AS_OF) - n * DAY_MS).toISOString();

const item = (over: Partial<WorkItem>): WorkItem => ({
  key: 'T-1',
  squadId: 'sq',
  type: 'story',
  category: 'feature',
  summary: '',
  storyPoints: 3,
  initiativeId: null,
  podId: null,
  createdAt: day(30),
  startedAt: day(10),
  doneAt: day(5),
  ...over,
});

const sprint = (committed: number, done: number, added = 0): Sprint => ({
  id: `s${committed}${done}`,
  squadId: 'sq',
  name: 'S',
  startDate: day(20),
  endDate: day(6),
  committedPoints: committed,
  completedCommittedPoints: done,
  addedPoints: added,
  completedAddedPoints: 0,
  removedPoints: 0,
  goal: '',
  goalMet: true,
});

describe('stats', () => {
  it('percentile interpolates', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
    expect(percentile([], 50)).toBeNaN();
  });
  it('cv is stdev / mean', () => {
    expect(cv([10, 10, 10])).toBe(0);
    expect(cv([0, 0])).toBeNaN();
  });
});

describe('predictability', () => {
  it('Say/Do is points-weighted across sprints', () => {
    expect(sayDo([sprint(10, 10), sprint(30, 15)])).toBeCloseTo(25 / 40);
  });
  it('scope change is added ÷ committed', () => {
    expect(scopeChange([sprint(20, 20, 5)])).toBeCloseTo(0.25);
  });
  it('velocity variability needs at least 3 sprints', () => {
    expect(velocityVariability([sprint(10, 10), sprint(20, 20)])).toBeNaN();
    expect(velocityVariability([sprint(10, 10), sprint(10, 10), sprint(10, 10)])).toBe(0);
  });
});

describe('flow', () => {
  const w = windows(AS_OF, 30).current;
  it('cycle time = done − started, for items finished in window', () => {
    const ct = cycleTimes([item({}), item({ doneAt: day(40), startedAt: day(45) })], w);
    expect(ct).toHaveLength(1);
    expect(ct[0]).toBeCloseTo(5);
  });
  it('throughput per week', () => {
    const items = Array.from({ length: 6 }, (_, i) => item({ key: `T-${i}` }));
    expect(throughputPerWeek(items, w)).toBeCloseTo(6 / (30 / 7));
  });
  it('WIP = started and not done at the snapshot', () => {
    const wip = wipAt([item({}), item({ key: 'T-2', doneAt: null }), item({ key: 'T-3', startedAt: null, doneAt: null })], Date.parse(AS_OF));
    expect(wip.map((i) => i.key)).toEqual(['T-2']);
  });
  it('ageing WIP compares against p85 of recent cycle times', () => {
    const finished = Array.from({ length: 10 }, (_, i) => item({ key: `D-${i}`, startedAt: day(12), doneAt: day(10) })); // 2d cycle time
    const old = item({ key: 'OLD', startedAt: day(9), doneAt: null });
    const fresh = item({ key: 'NEW', startedAt: day(1), doneAt: null });
    const a = ageingWip([...finished, old, fresh], AS_OF);
    expect(a.ageing.map((i) => i.key)).toEqual(['OLD']);
    expect(a.share).toBe(0.5);
  });
});

describe('quality', () => {
  it('bug ratio = bugs ÷ all finished', () => {
    const w = windows(AS_OF, 30).current;
    expect(bugRatio([item({}), item({ key: 'B', type: 'bug' })], w)).toBe(0.5);
  });
});

describe('catalogue thresholds', () => {
  it('higher-is-better', () => {
    expect(evaluate('sayDo', 0.85)).toBe('good');
    expect(evaluate('sayDo', 0.7)).toBe('watch');
    expect(evaluate('sayDo', 0.5)).toBe('attention');
  });
  it('lower-is-better', () => {
    expect(evaluate('bugRatio', 0.1)).toBe('good');
    expect(evaluate('bugRatio', 0.25)).toBe('watch');
    expect(evaluate('bugRatio', 0.4)).toBe('attention');
  });
  it('neutral metrics never get a status', () => {
    expect(evaluate('throughput', 5)).toBe('none');
    expect(isImprovement('throughput', 5, 4)).toBeNull();
  });
});

describe('mock dataset', () => {
  const data = generateDataset();
  it('is deterministic', () => {
    expect(generateDataset().workItems.length).toBe(data.workItems.length);
  });
  it('never has work finishing before it starts', () => {
    for (const i of data.workItems) {
      if (i.doneAt) expect(Date.parse(i.doneAt)).toBeGreaterThanOrEqual(Date.parse(i.startedAt!));
    }
  });
  it('tells the intended stories', () => {
    const health = (id: string) => {
      const sq = data.squads.find((s) => s.id === id)!;
      return squadHealth(scorecard(data, [sq], 90), sq.teamType).health;
    };
    expect(health('sq-granite')).toBe('attention'); // chronic over-commitment
    expect(health('sq-kestrel')).toBe('good');
  });
});

const pulse = (over: Partial<PulseCheck> & { score?: number }): PulseCheck => {
  const { score = 4, ...rest } = over;
  return {
    id: 'p',
    squadId: 'sq',
    date: day(5),
    respondents: 6,
    scores: Object.fromEntries(PULSE_DIMENSIONS.map((d) => [d.id, score])) as Record<PulseDimension, number>,
    ...rest,
  };
};

describe('health index', () => {
  it('scores each metric against its own thresholds: 100 at good (capped), 50 at watch, 0 one band beyond', () => {
    // Say/Do: good 80%, watch 65% → floor 50%
    expect(metricScore('sayDo', 0.8)).toBe(100);
    expect(metricScore('sayDo', 1)).toBe(100);
    expect(metricScore('sayDo', 0.65)).toBeCloseTo(50);
    expect(metricScore('sayDo', 0.725)).toBeCloseTo(75);
    expect(metricScore('sayDo', 0.4)).toBe(0);
    // Cycle time (lower is better): good 10d, watch 15d → floor 20d
    expect(metricScore('cycleP85', 12)).toBeCloseTo(80);
    expect(metricScore('cycleP85', 15)).toBeCloseTo(50);
    expect(metricScore('throughput', 5)).toBeNaN(); // no thresholds → not scorable
  });
  it('score bands match the status badges', () => {
    for (const v of [0.5, 0.6, 0.66, 0.7, 0.79, 0.8, 0.9]) {
      const st = evaluate('sayDo', v);
      const sc = metricScore('sayDo', v);
      expect(st === 'good' ? sc === 100 : st === 'watch' ? sc >= 50 && sc < 100 : sc < 50).toBe(true);
    }
  });
  it('is the equal-weight mean of the inputs for the team type', () => {
    // Kanban inputs: cycleP85, throughputCv, leadP85, pulseScore — bug ratio is ignored
    const v = { cycleP85: 15, throughputCv: 0.2, leadP85: 20, pulseScore: 3.3, bugRatio: 0.9 };
    expect(squadHealthIndex(v, 'kanban')).toBeCloseTo((50 + 100 + 100 + 50) / 4);
  });
  it('needs at least 3 scorable inputs', () => {
    expect(squadHealthIndex({ cycleP85: 5, leadP85: 10 }, 'kanban')).toBeNaN();
  });
  it('groups average squads, so each squad counts once', () => {
    const data = generateDataset();
    const [a, b] = data.squads;
    const one = (s: typeof a) => scorecard(data, [s], 90).current.healthIndex;
    expect(scorecard(data, [a, b], 90).current.healthIndex).toBeCloseTo((one(a) + one(b)) / 2);
  });
});

describe('pulse check', () => {
  const w = windows(AS_OF, 30).current;
  it('uses each squad’s latest pulse in the window and averages squads', () => {
    const ps = [pulse({ id: 'old', date: day(20), score: 2 }), pulse({ id: 'new', date: day(3), score: 4 }), pulse({ id: 'b', squadId: 'sq2', score: 3 })];
    expect(latestPulses(ps, w).map((p) => p.id).sort()).toEqual(['b', 'new']);
    expect(pulseScore(ps, w)).toBeCloseTo(3.5);
  });
  it('hides pulses below the anonymity threshold', () => {
    expect(pulseScore([pulse({ respondents: 2 })], w)).toBeNaN();
  });
  it('lists dimensions lowest first', () => {
    const p = pulse({});
    p.scores.codebase = 2;
    expect(pulseDimensions([p], w)[0]).toMatchObject({ id: 'codebase', score: 2 });
  });
});

describe('development categories', () => {
  it('shares of finished items per category sum to 1', () => {
    const w = windows(AS_OF, 30).current;
    const mix = categoryMix([item({}), item({ key: 'B', category: 'defect' }), item({ key: 'T', category: 'techDebt' }), item({ key: 'F' })], w);
    expect(mix).toEqual({ feature: 0.5, techDebt: 0.25, maintenance: 0, defect: 0.25 });
  });
});

describe('delivery forecast', () => {
  it('counts daily throughput into day buckets', () => {
    const endMs = Date.parse(AS_OF);
    expect(dailyThroughput([item({ doneAt: day(0.5) }), item({ key: 'X', doneAt: day(2.5) })], endMs, 3)).toEqual([1, 0, 1]);
  });
  it('a constant history forecasts exactly', () => {
    expect(forecastItems(new Array(84).fill(1), 14)).toBe(14);
  });
  it('is deterministic and conservative (85% confidence ≤ mean)', () => {
    const daily = Array.from({ length: 84 }, (_, i) => (i % 3 === 0 ? 3 : 0)); // mean 1/day
    expect(forecastItems(daily)).toBe(forecastItems(daily));
    expect(forecastItems(daily)).toBeLessThan(14);
  });
  it('no history → no forecast', () => {
    expect(forecastItems(new Array(84).fill(0))).toBeNaN();
  });
});

describe('mock pulse checks', () => {
  const data = generateDataset();
  const score = (id: string) => {
    const sq = data.squads.find((s) => s.id === id)!;
    return scorecard(data, [sq], 30).current.pulseScore;
  };
  it('tell the intended stories', () => {
    expect(score('sq-granite')).toBeLessThan(3.3); // over-commitment shows up in how the squad feels
    expect(score('sq-kestrel')).toBeGreaterThan(3.8);
  });
});

describe('highlights', () => {
  const h = (kind: Highlight['kind'], squadId: string, delta: number): Highlight => ({
    id: `${squadId}-${kind}-${delta}`, kind, squadId, metricId: 'cycleP85', from: 0, to: 0, status: 'good', delta,
  });
  it('picks the biggest drop, the biggest win, then the bigger of the next two', () => {
    const all = [h('drop', 'a', -30), h('drop', 'b', -60), h('rise', 'c', 40), h('milestone', 'd', 25), h('drop', 'e', -45)];
    expect(pickHighlights(all).map((x) => x.squadId)).toEqual(['b', 'c', 'e']);
  });
  it('prefers different squads', () => {
    const all = [h('drop', 'a', -60), h('drop', 'a', -50), h('drop', 'b', -30), h('rise', 'c', 40)];
    expect(pickHighlights(all).map((x) => x.squadId)).toEqual(['a', 'c', 'b']);
  });
  it('returns fewer stories when there is less news', () => {
    expect(pickHighlights([h('rise', 'a', 30)])).toHaveLength(1);
    expect(pickHighlights([])).toHaveLength(0);
  });
  it('skips comparisons the history cannot support', () => {
    const data = generateDataset(); // ~220 days of history
    expect(canCompare(data, 90)).toBe(true);
    expect(canCompare(data, 180)).toBe(false);
    expect(findHighlights(data, data.squads, 180)).toEqual([]);
  });
  it('tells the intended stories in the dummy data', () => {
    const data = generateDataset();
    const found = findHighlights(data, data.squads, 90);
    expect(found).toContainEqual(expect.objectContaining({ kind: 'drop', squadId: 'sq-borealis', metricId: 'pulseScore' }));
    expect(found).toContainEqual(expect.objectContaining({ kind: 'milestone', squadId: 'sq-iris', metricId: 'pulseScore' }));
  });
});

describe('forecasting accuracy', () => {
  const w = windows(AS_OF, 30).current;
  // One item finished every day for the last 200 days
  const steady = Array.from({ length: 200 }, (_, i) => item({ key: `S-${i}`, startedAt: day(i + 1.6), doneAt: day(i + 0.5) }));
  it('replays a forecast each week whose 2-week horizon ends in the period', () => {
    const r = forecastBacktest(steady, w);
    expect(r.length).toBe(5); // horizons ending at 0, 7, 14, 21, 28 days before the snapshot
    expect(r.every((x) => x.forecast === 14 && x.actual === 14)).toBe(true);
  });
  it('steady delivery → forecasts are met', () => {
    expect(forecastAccuracy(steady, w)).toBe(1);
  });
  it('a sudden stop → forecasts are missed', () => {
    const stopped = steady.filter((i) => Date.parse(i.doneAt!) < Date.parse(day(30)));
    expect(forecastAccuracy(stopped, w)).toBe(0);
  });
});

describe('work item age at a past date', () => {
  it('scorecard measures ageing WIP at the end of each window, so the previous period has a value', () => {
    const data = generateDataset();
    const sq = data.squads.find((s) => s.id === 'sq-borealis')!;
    expect(Number.isFinite(scorecard(data, [sq], 90).previous.ageingWipShare)).toBe(true);
  });
});

describe('health index trend', () => {
  it('works for a single squad, not just groups', () => {
    const data = generateDataset();
    const values = metricTrend(data, [data.squads[0]], 'healthIndex', { points: 8 }).map((t) => t.value);
    expect(values.filter(Number.isFinite).length).toBeGreaterThan(0);
  });
});

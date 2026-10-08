import { describe, expect, it } from 'vitest';
import type { Sprint, WorkItem } from '../../data/model';
import { generateDataset } from '../../data/sources/mock/generator';
import { evaluate, isImprovement } from '../catalogue';
import { ageingWip, cycleTimes, throughputPerWeek, wipAt } from '../flow';
import { DAY_MS, windows } from '../period';
import { sayDo, scopeChange, velocityVariability } from '../predictability';
import { bugRatio } from '../quality';
import { scorecard, squadHealth } from '../scorecard';
import { cv, percentile } from '../stats';

const AS_OF = '2026-10-02T00:00:00.000Z';
const day = (n: number) => new Date(Date.parse(AS_OF) - n * DAY_MS).toISOString();

const item = (over: Partial<WorkItem>): WorkItem => ({
  key: 'T-1',
  squadId: 'sq',
  type: 'story',
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

import { describe, expect, it } from 'vitest';
import { generateDataset } from '../mock/generator';
import { scorecard } from '../../../metrics/scorecard';
import { ConvertError, convertEazybi, parseCsv, parseDate, parseNumber, type SquadConfig } from './convert';
import { SAMPLE_COLUMNS, toEazybiExports } from './sample';

const squad = (over: Partial<SquadConfig> = {}): SquadConfig => ({ name: 'Payments', teamType: 'scrum', domain: 'Money', issueMatch: ['PAY'], ...over });
const ISSUES = 'Issue,Issue type,Issue created date,First in progress date,Issue resolution date,Issue Story Points\n';
const SPRINTS = 'Sprint,Board,Sprint start date,Sprint end date,Sprint Story Points committed,Sprint Story Points added,Sprint Story Points removed,Sprint Story Points completed\n';

describe('eazyBI CSV parsing', () => {
  it('handles quotes, doubled quotes, newlines in quotes and semicolons', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
    expect(parseCsv('a;b\r\n1;"2\n3"\r\n')).toEqual([['a', 'b'], ['1', '2\n3']]);
  });
  it('reads ISO and month-name dates, refuses ambiguous ones', () => {
    expect(parseDate('2026-03-05', 'x')).toBe('2026-03-05T00:00:00.000Z');
    expect(parseDate('2026-03-05 14:20:10', 'x')).toBe('2026-03-05T14:20:10.000Z');
    expect(parseDate('Mar 05 2026', 'x')).toBe('2026-03-05T00:00:00.000Z');
    expect(parseDate('5 March 2026', 'x')).toBe('2026-03-05T00:00:00.000Z');
    expect(parseDate('', 'x')).toBeNull();
    expect(() => parseDate('05/03/2026', 'x')).toThrow(ConvertError);
  });
  it('reads decimal commas and thousands separators', () => {
    expect(parseNumber('3,5', 'x')).toBe(3.5);
    expect(parseNumber('1,234.5', 'x')).toBe(1234.5);
    expect(parseNumber('(none)', 'x')).toBeNull();
  });
});

describe('eazyBI conversion', () => {
  it('names the missing column and lists the ones present — without cell values', () => {
    const bad = 'Issue,Type\nPAY-1 Secret summary,Story\n';
    try {
      convertEazybi({ issuesCsv: bad, sprintsCsv: SPRINTS, squads: [squad()] });
      throw new Error('expected a ConvertError');
    } catch (e) {
      expect(e).toBeInstanceOf(ConvertError);
      expect((e as Error).message).toContain('"Issue type"');
      expect((e as Error).message).toContain('"Type"');
      expect((e as Error).message).not.toContain('Secret');
    }
  });
  it('matches squads by project key, skips epics and non-issue rows, estimates completed-of-committed', () => {
    const issues =
      ISSUES +
      'PAY-1 First,Story,2026-01-01,2026-01-03,2026-01-06,3\n' +
      'PAY-2 An epic,Epic,2026-01-01,,,\n' +
      'OTH-9 Elsewhere,Story,2026-01-01,,,\n' +
      'Total,,,,,\n';
    const sprints = SPRINTS + 'PAY Sprint 1,Payments board,2026-01-01,2026-01-14,20,5,2,19\n';
    const { dataset, summary } = convertEazybi({
      issuesCsv: issues,
      sprintsCsv: sprints,
      squads: [squad({ sprintMatch: ['Payments board'] })],
      asOf: '2026-02-01T00:00:00.000Z',
    });
    expect(dataset.workItems.map((i) => i.key)).toEqual(['PAY-1']);
    expect(dataset.workItems[0].summary).toBe('First');
    expect(summary.issues).toMatchObject({ excludedType: 1, noSquad: 1, used: 1 });
    expect(dataset.sprints[0]).toMatchObject({ completedCommittedPoints: 18, completedAddedPoints: 1, goalMet: null });
    expect(summary.warnings.some((w) => w.includes('estimated'))).toBe(true);
  });
  it('blank and unknown work categories count as None; unknown ones are reported', () => {
    const issues =
      'Issue,Issue type,Issue created date,First in progress date,Issue resolution date,Issue Story Points,Work category\n' +
      'PAY-1 A,Story,2026-01-01,2026-01-02,2026-01-05,3,OKR aligned\n' +
      'PAY-2 B,Story,2026-01-01,2026-01-02,2026-01-05,3,\n' +
      'PAY-3 C,Story,2026-01-01,2026-01-02,2026-01-05,3,Roadmap\n';
    const { dataset, summary } = convertEazybi({ issuesCsv: issues, sprintsCsv: SPRINTS, squads: [squad()], columns: { issues: { category: 'Work category' } } });
    expect(dataset.workItems.map((i) => i.category)).toEqual(['okr', 'none', 'none']);
    expect(summary.issues.unmappedCategory).toBe(1);
    expect(summary.unmappedCategoryValues).toEqual(['Roadmap']);
  });
  it('round-trips the mock data: same metrics after export and conversion', () => {
    const mock = generateDataset();
    const { issuesCsv, sprintsCsv, squads } = toEazybiExports(mock);
    const { dataset } = convertEazybi({ issuesCsv, sprintsCsv, squads, columns: SAMPLE_COLUMNS, asOf: mock.asOf });
    expect(dataset.workItems.length).toBe(mock.workItems.length);
    expect(dataset.sprints.length).toBe(mock.sprints.filter((s) => Date.parse(s.endDate) <= Date.parse(mock.asOf)).length);
    const a = scorecard(mock, mock.squads, 90).current;
    const b = scorecard(dataset, dataset.squads, 90).current;
    for (const id of ['sayDo', 'scopeChange', 'velocityCv', 'throughputCv', 'cycleP85', 'leadP85', 'bugRatio', 'okrShare'] as const) {
      // Exports drop milliseconds, so allow for that (4 decimals of a day is under 10 seconds)
      expect(b[id], id).toBeCloseTo(a[id], 4);
    }
  });
});

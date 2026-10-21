import type { Dataset } from '../../model';
import { DEFAULT_COLUMNS, type SquadConfig } from './convert';

/**
 * Writes a Dataset out in the shape of the eazyBI exports described in docs/eazybi-reports.md.
 * Used for the fictional example files (`npm run snapshot:sample`) and the round-trip test —
 * never with real data.
 */
export function toEazybiExports(data: Dataset): { issuesCsv: string; sprintsCsv: string; squads: SquadConfig[] } {
  const q = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const line = (cells: (string | number | null)[]) => cells.map(q).join(',');
  // eazyBI-style "yyyy-mm-dd hh:mm:ss"
  const d = (iso: string | null) => (iso ? iso.slice(0, 19).replace('T', ' ') : '');
  const squadById = new Map(data.squads.map((s) => [s.id, s]));
  const initiative = new Map(data.initiatives.map((i) => [i.id, i.name]));

  const c = DEFAULT_COLUMNS.issues;
  const issueRows = data.workItems.map((i) =>
    line([
      `${i.key} ${i.summary}`,
      i.type === 'bug' ? 'Bug' : i.type === 'story' ? 'Story' : 'Task',
      d(i.createdAt),
      d(i.startedAt),
      d(i.doneAt),
      i.storyPoints,
      i.initiativeId ? initiative.get(i.initiativeId) ?? '' : '',
      { okr: 'OKR aligned', nonOkr: 'Non-OKR aligned', ktlo: 'Keep the lights on', learning: 'L&D', none: '' }[i.category],
    ]),
  );
  const issuesCsv = [line([c.issue, c.type, c.created, c.started, c.done, c.points, c.epic!, 'Work category']), ...issueRows].join('\n') + '\n';

  const s = DEFAULT_COLUMNS.sprints;
  const sprintRows = data.sprints.map((sp) =>
    line([
      sp.name,
      `${squadById.get(sp.squadId)?.name} board`,
      d(sp.startDate),
      d(sp.endDate),
      sp.committedPoints,
      sp.addedPoints,
      sp.removedPoints,
      sp.completedCommittedPoints + sp.completedAddedPoints,
      sp.completedCommittedPoints,
      sp.goalMet === null ? '' : sp.goalMet ? 'Yes' : 'No',
    ]),
  );
  const sprintsCsv =
    [line([s.sprint, s.board!, s.start, s.end, s.committed, s.added, s.removed, s.completed, s.completedOfCommitted!, 'Sprint goal met']), ...sprintRows].join(
      '\n',
    ) + '\n';

  const squads: SquadConfig[] = data.squads.map((sq) => ({
    name: sq.name,
    teamType: sq.teamType,
    domain: data.domains.find((x) => x.id === sq.domainId)?.name ?? '',
    valueStream: data.valueStreams.find((x) => x.id === sq.valueStreamId)?.name,
    deliveryLead: data.deliveryLeads.find((x) => x.id === sq.deliveryLeadId)?.name,
    issueMatch: [sq.boardKey],
    ...(sq.teamType === 'scrum' ? { sprintMatch: [`${sq.name} board`] } : {}),
  }));
  return { issuesCsv, sprintsCsv, squads };
}

/** columns.json for the sample: the defaults plus the optional columns the sample includes. */
export const SAMPLE_COLUMNS = {
  issues: { category: 'Work category' },
  sprints: { goalMet: 'Sprint goal met' },
};

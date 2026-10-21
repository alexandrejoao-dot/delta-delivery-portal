import type { Dataset, Initiative, Sprint, Squad, TeamType, WorkCategory, WorkItem, WorkItemType } from '../../model';

/**
 * eazyBI CSV exports → canonical Dataset.
 *
 * Pure functions, no file access: `scripts/eazybi-snapshot.mjs` reads the files and writes the snapshot.
 * The exports hold real company data, so error messages and the summary name columns, rows and counts —
 * never cell values (dates excepted, so a format problem can be diagnosed).
 * See docs/eazybi-reports.md for the reports this expects.
 */

/** One squad, written by hand in eazybi-data/squads.json. */
export interface SquadConfig {
  name: string;
  teamType: TeamType;
  domain: string;
  valueStream?: string;
  deliveryLead?: string;
  /** Values of the issue "squad" column that belong to this squad — by default the Jira project key, e.g. ["PAY"] */
  issueMatch: string[];
  /** Sprint board names, or sprint name prefixes when the export has no board column. Defaults to issueMatch. */
  sprintMatch?: string[];
}

/** Column names in the exports. Override any of them in eazybi-data/columns.json. */
export interface ColumnConfig {
  issues: {
    /** eazyBI's Issue member: "KEY-123 Summary" */
    issue: string;
    type: string;
    created: string;
    started: string;
    done: string;
    points: string;
    /** Optional: which squad an issue belongs to. Without it, the project key from the issue key is used. */
    squad?: string;
    /** Optional: epic, used as the initiative */
    epic?: string;
    /** Optional: work category field or label */
    category?: string;
  };
  sprints: {
    sprint: string;
    /** Optional: board name. Without it, squads are matched on the sprint name prefix. */
    board?: string;
    start: string;
    end: string;
    committed: string;
    added: string;
    removed: string;
    completed: string;
    /** Optional: when missing, estimated as min(completed, committed − removed) */
    completedOfCommitted?: string;
    /** Optional: "Yes"/"No" — Jira doesn't record whether a sprint goal was met */
    goalMet?: string;
  };
  /** Issue type → model type; anything not listed becomes "task" */
  typeMap: Record<string, WorkItemType>;
  /** Issue types left out entirely (they aren't units of delivered work) */
  excludeTypes: string[];
  /** Category value → work category; unmapped values fall back to the issue type */
  categoryMap: Record<string, WorkCategory>;
}

export const DEFAULT_COLUMNS: ColumnConfig = {
  issues: {
    issue: 'Issue',
    type: 'Issue type',
    created: 'Issue created date',
    started: 'First in progress date',
    done: 'Issue resolution date',
    points: 'Issue Story Points',
    epic: 'Issue Epic Link',
  },
  sprints: {
    sprint: 'Sprint',
    board: 'Board',
    start: 'Sprint start date',
    end: 'Sprint end date',
    committed: 'Sprint Story Points committed',
    added: 'Sprint Story Points added',
    removed: 'Sprint Story Points removed',
    completed: 'Sprint Story Points completed',
    completedOfCommitted: 'Sprint Story Points completed of committed',
  },
  typeMap: { story: 'story', bug: 'bug', task: 'task' },
  excludeTypes: ['epic', 'sub-task', 'subtask'],
  categoryMap: {
    feature: 'feature',
    'new feature': 'feature',
    'tech debt': 'techDebt',
    'technical debt': 'techDebt',
    maintenance: 'maintenance',
    defect: 'defect',
    bug: 'defect',
  },
};

export class ConvertError extends Error {}

export interface ConvertSummary {
  asOf: string;
  issues: { rows: number; used: number; excludedType: number; noSquad: number; noStart: number; notDone: number; noPoints: number };
  sprints: { rows: number; used: number; noSquad: number; notClosed: number; estimatedCompletedOfCommitted: number };
  squads: { name: string; teamType: TeamType; issues: number; sprints: number }[];
  /** Distinct squad-column values that matched no squad — local diagnostics only, never paste these outside */
  unmatchedSquadValues: string[];
  warnings: string[];
}

export interface ConvertInput {
  issuesCsv: string;
  sprintsCsv: string;
  squads: SquadConfig[];
  columns?: DeepPartial<ColumnConfig>;
  /** Snapshot time; defaults to now */
  asOf?: string;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

// ---------- CSV ----------

/** RFC 4180 CSV (quoted fields, doubled quotes, newlines in quotes). Comma or semicolon, detected from the header. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

interface Table {
  file: string;
  headers: string[];
  rows: string[][];
}

function table(file: string, text: string): Table {
  const [headers = [], ...rows] = parseCsv(text);
  if (!headers.length) throw new ConvertError(`${file}: the file is empty.`);
  return { file, headers: headers.map((h) => h.trim()), rows };
}

const norm = (s: string) => s.trim().toLowerCase();

/** Column index by name (case-insensitive). Required columns throw a message that lists what the file does have. */
function col(t: Table, name: string | undefined, what: string, required: boolean): number {
  const i = name ? t.headers.findIndex((h) => norm(h) === norm(name)) : -1;
  if (i < 0 && required) {
    throw new ConvertError(
      `${t.file}: column "${name}" (${what}) not found.\n` +
        `  Columns in the file: ${t.headers.map((h) => `"${h}"`).join(', ')}\n` +
        `  If it has another name, set it in eazybi-data/columns.json.`,
    );
  }
  return i;
}

// ---------- values ----------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Accepts the formats eazyBI exports produce: ISO (2026-03-05, 2026-03-05 14:20[:10], 2026-03-05T14:20:10Z)
 * and month-name dates (Mar 05 2026, 05 Mar 2026, with an optional time). Ambiguous dd/mm/yyyy is refused.
 */
export function parseDate(v: string, where: string): string | null {
  const s = v.trim();
  if (!s || s === '(none)' || s === '-') return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return iso(+m[1], +m[2], +m[3], m[4], m[5], m[6]);
  m = s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m && MONTHS.includes(m[1].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2], m[4], m[5], m[6]);
  m = s.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]*\.? (\d{4})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m && MONTHS.includes(m[2].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1], m[4], m[5], m[6]);
  throw new ConvertError(
    `${where}: date "${s}" is in a format the converter doesn't read.\n` +
      `  Use yyyy-mm-dd (in eazyBI: measure formatting → Date → custom yyyy-mm-dd) or "Mar 05 2026".`,
  );
}

function iso(y: number, mo: number, d: number, h?: string, mi?: string, se?: string) {
  return `${y}-${pad(mo)}-${pad(d)}T${h ?? '00'}:${mi ?? '00'}:${se ?? '00'}.000Z`;
}

/** "3", "3.5", "3,5", "1,234.5" → number; blank or "(none)" → null. */
export function parseNumber(v: string, where: string): number | null {
  const s = v.trim().replace(/\s/g, '');
  if (!s || s === '(none)' || s === '-') return null;
  const normalised = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  const n = Number(normalised);
  if (!Number.isFinite(n)) throw new ConvertError(`${where}: expected a number, found text that isn't one.`);
  return n;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'x';

// ---------- conversion ----------

export function mergeColumns(over: DeepPartial<ColumnConfig> = {}): ColumnConfig {
  return {
    issues: { ...DEFAULT_COLUMNS.issues, ...over.issues },
    sprints: { ...DEFAULT_COLUMNS.sprints, ...over.sprints },
    typeMap: { ...DEFAULT_COLUMNS.typeMap, ...over.typeMap } as Record<string, WorkItemType>,
    excludeTypes: (over.excludeTypes as string[] | undefined) ?? DEFAULT_COLUMNS.excludeTypes,
    categoryMap: { ...DEFAULT_COLUMNS.categoryMap, ...over.categoryMap } as Record<string, WorkCategory>,
  };
}

function validateSquads(squads: SquadConfig[]) {
  if (!Array.isArray(squads) || !squads.length) throw new ConvertError('squads.json: no squads defined.');
  squads.forEach((s, i) => {
    const where = `squads.json, squad #${i + 1}`;
    if (!s.name) throw new ConvertError(`${where}: "name" is missing.`);
    if (s.teamType !== 'scrum' && s.teamType !== 'kanban') throw new ConvertError(`${where}: "teamType" must be "scrum" or "kanban".`);
    if (!s.domain) throw new ConvertError(`${where}: "domain" is missing.`);
    if (!s.issueMatch?.length) throw new ConvertError(`${where}: "issueMatch" needs at least one value (e.g. the Jira project key).`);
  });
}

export function convertEazybi(input: ConvertInput): { dataset: Dataset; summary: ConvertSummary } {
  validateSquads(input.squads);
  const cfg = mergeColumns(input.columns);
  const asOf = input.asOf ?? new Date().toISOString();
  const asOfMs = Date.parse(asOf);
  const warnings: string[] = [];

  // Organisation: domains, value streams and Delivery Leads come from squads.json
  const domains = new Map<string, { id: string; name: string; manager: string }>();
  const valueStreams = new Map<string, { id: string; name: string; domainId: string }>();
  const leads = new Map<string, { id: string; name: string }>();
  const squads: Squad[] = input.squads.map((s) => {
    const domainId = `dom-${slug(s.domain)}`;
    if (!domains.has(domainId)) domains.set(domainId, { id: domainId, name: s.domain, manager: '' });
    const vsName = s.valueStream ?? s.domain;
    const valueStreamId = `vs-${slug(vsName)}`;
    if (!valueStreams.has(valueStreamId)) valueStreams.set(valueStreamId, { id: valueStreamId, name: vsName, domainId });
    const dlName = s.deliveryLead ?? 'Not set';
    const deliveryLeadId = `dl-${slug(dlName)}`;
    if (!leads.has(deliveryLeadId)) leads.set(deliveryLeadId, { id: deliveryLeadId, name: dlName });
    return { id: `sq-${slug(s.name)}`, name: s.name, domainId, valueStreamId, deliveryLeadId, teamType: s.teamType, boardKey: s.issueMatch[0] };
  });
  const issueOwner = new Map<string, number>();
  input.squads.forEach((s, i) => s.issueMatch.forEach((v) => issueOwner.set(norm(v), i)));

  // ---- issues ----
  const it = table('issues.csv', input.issuesCsv);
  const c = cfg.issues;
  const ix = {
    issue: col(it, c.issue, 'issue key and summary', true),
    type: col(it, c.type, 'issue type', true),
    created: col(it, c.created, 'created date', true),
    started: col(it, c.started, 'first date in progress', true),
    done: col(it, c.done, 'done / resolution date', true),
    points: col(it, c.points, 'story points', true),
    squad: col(it, c.squad, 'squad', !!c.squad),
    epic: col(it, c.epic, 'epic', false),
    category: col(it, c.category, 'work category', !!c.category),
  };
  if (ix.epic < 0) warnings.push('No epic column — issues will show as "Not linked to an initiative".');
  if (ix.category < 0) warnings.push('No work category column — the investment mix counts bugs as defects and everything else as new features.');

  const typeMap = new Map(Object.entries(cfg.typeMap).map(([k, v]) => [norm(k), v]));
  const excluded = new Set(cfg.excludeTypes.map(norm));
  const categoryMap = new Map(Object.entries(cfg.categoryMap).map(([k, v]) => [norm(k), v]));
  const initiatives = new Map<string, Initiative>();
  const unmatched = new Set<string>();
  const is = { rows: it.rows.length, used: 0, excludedType: 0, noSquad: 0, noStart: 0, notDone: 0, noPoints: 0 };
  const workItems: WorkItem[] = [];
  const seenKeys = new Set<string>();

  it.rows.forEach((r, n) => {
    const where = `issues.csv row ${n + 2}`;
    const cell = (i: number) => (i >= 0 ? (r[i] ?? '') : '');
    const m = cell(ix.issue).trim().match(/^([A-Za-z][A-Za-z0-9_]*-\d+)\b\s*(.*)$/);
    if (!m) {
      // eazyBI adds total / parent rows to some exports; anything without an issue key isn't an issue
      return;
    }
    const [, key, summary] = m;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    const rawType = norm(cell(ix.type));
    if (excluded.has(rawType)) {
      is.excludedType++;
      return;
    }
    const squadValue = ix.squad >= 0 ? cell(ix.squad).trim() : key.split('-')[0];
    const owner = issueOwner.get(norm(squadValue));
    if (owner === undefined) {
      is.noSquad++;
      unmatched.add(squadValue || '(blank)');
      return;
    }
    const squad = squads[owner];
    const createdAt = parseDate(cell(ix.created), `${where}, "${c.created}"`);
    if (!createdAt) throw new ConvertError(`${where}: created date is empty — every issue needs one.`);
    const startedAt = parseDate(cell(ix.started), `${where}, "${c.started}"`);
    const doneAt = parseDate(cell(ix.done), `${where}, "${c.done}"`);
    const points = parseNumber(cell(ix.points), `${where}, "${c.points}"`);
    if (!startedAt) is.noStart++;
    if (!doneAt) is.notDone++;
    if (points === null) is.noPoints++;
    const type = typeMap.get(rawType) ?? 'task';
    const rawCategory = norm(cell(ix.category));
    const category: WorkCategory = categoryMap.get(rawCategory) ?? (type === 'bug' ? 'defect' : 'feature');
    const epic = cell(ix.epic).trim();
    let initiativeId: string | null = null;
    if (epic && epic !== '(none)') {
      initiativeId = `ini-${slug(epic)}`;
      if (!initiatives.has(initiativeId)) {
        initiatives.set(initiativeId, {
          id: initiativeId,
          name: epic,
          domainId: squad.domainId,
          valueStreamId: squad.valueStreamId,
          targetDate: asOf,
          status: 'in_progress',
        });
      }
    }
    workItems.push({
      key,
      squadId: squad.id,
      type,
      category,
      summary,
      storyPoints: points,
      initiativeId,
      podId: null,
      createdAt,
      // A start after done (re-opened work) would give negative cycle time — treat as unknown
      startedAt: startedAt && doneAt && startedAt > doneAt ? null : startedAt,
      doneAt,
    });
    is.used++;
  });
  if (!is.used) throw new ConvertError('issues.csv: no rows matched a squad in squads.json — check "issueMatch" (by default the Jira project key).');

  // ---- sprints ----
  const st = table('sprints.csv', input.sprintsCsv);
  const sc = cfg.sprints;
  const sx = {
    sprint: col(st, sc.sprint, 'sprint name', true),
    board: col(st, sc.board, 'board', false),
    start: col(st, sc.start, 'sprint start date', true),
    end: col(st, sc.end, 'sprint end date', true),
    committed: col(st, sc.committed, 'story points committed', true),
    added: col(st, sc.added, 'story points added', true),
    removed: col(st, sc.removed, 'story points removed', true),
    completed: col(st, sc.completed, 'story points completed', true),
    completedOfCommitted: col(st, sc.completedOfCommitted, 'completed of committed', false),
    goalMet: col(st, sc.goalMet, 'sprint goal met', false),
  };
  const ss = { rows: st.rows.length, used: 0, noSquad: 0, notClosed: 0, estimatedCompletedOfCommitted: 0 };
  const sprintOwner = (board: string, name: string) => {
    for (let i = 0; i < input.squads.length; i++) {
      if (input.squads[i].teamType !== 'scrum') continue;
      const keys = (input.squads[i].sprintMatch ?? input.squads[i].issueMatch).map(norm);
      if (sx.board >= 0 ? keys.includes(norm(board)) : keys.some((k) => norm(name).startsWith(k))) return i;
    }
    return undefined;
  };
  const sprints: Sprint[] = [];
  st.rows.forEach((r, n) => {
    const where = `sprints.csv row ${n + 2}`;
    const cell = (i: number) => (i >= 0 ? (r[i] ?? '') : '');
    const name = cell(sx.sprint).trim();
    if (!name || /^(all |total)/i.test(name)) return;
    const owner = sprintOwner(cell(sx.board).trim(), name);
    if (owner === undefined) {
      ss.noSquad++;
      return;
    }
    const startDate = parseDate(cell(sx.start), `${where}, "${sc.start}"`);
    const endDate = parseDate(cell(sx.end), `${where}, "${sc.end}"`);
    if (!startDate || !endDate || Date.parse(endDate) > asOfMs) {
      ss.notClosed++;
      return;
    }
    const num = (i: number, label: string) => parseNumber(cell(i), `${where}, "${label}"`) ?? 0;
    const committed = num(sx.committed, sc.committed);
    const added = num(sx.added, sc.added);
    const removed = num(sx.removed, sc.removed);
    const completed = num(sx.completed, sc.completed);
    let completedCommitted: number;
    if (sx.completedOfCommitted >= 0 && cell(sx.completedOfCommitted).trim() !== '') {
      completedCommitted = num(sx.completedOfCommitted, sc.completedOfCommitted!);
    } else {
      completedCommitted = Math.min(completed, Math.max(0, committed - removed));
      ss.estimatedCompletedOfCommitted++;
    }
    const goal = cell(sx.goalMet).trim().toLowerCase();
    const squad = squads[owner];
    sprints.push({
      id: `${squad.id}-${slug(name)}`,
      squadId: squad.id,
      name,
      startDate,
      endDate,
      committedPoints: committed,
      completedCommittedPoints: completedCommitted,
      addedPoints: added,
      completedAddedPoints: Math.max(0, completed - completedCommitted),
      removedPoints: removed,
      goal: '',
      goalMet: ['yes', 'true', 'met', '1', 'y'].includes(goal) ? true : ['no', 'false', 'missed', '0', 'n'].includes(goal) ? false : null,
    });
    ss.used++;
  });
  if (ss.estimatedCompletedOfCommitted) {
    warnings.push(
      `${ss.estimatedCompletedOfCommitted} sprint(s) had no "completed of committed" value — estimated as min(completed, committed − removed), so completion ratio may read slightly high.`,
    );
  }
  if (sx.goalMet < 0) warnings.push('No sprint goal column — sprint goal hit rate will show as "—".');
  const scrumWithoutSprints = squads.filter((s) => s.teamType === 'scrum' && !sprints.some((sp) => sp.squadId === s.id));
  if (scrumWithoutSprints.length) {
    warnings.push(`${scrumWithoutSprints.length} Scrum squad(s) have no closed sprints — check "sprintMatch" in squads.json.`);
  }
  const noIssues = squads.filter((s) => !workItems.some((i) => i.squadId === s.id));
  if (noIssues.length) warnings.push(`${noIssues.length} squad(s) have no issues — check "issueMatch" in squads.json.`);

  const dataset: Dataset = {
    asOf,
    source: { id: 'eazybi', label: 'eazyBI snapshot', isDummy: false },
    domains: [...domains.values()],
    valueStreams: [...valueStreams.values()],
    deliveryLeads: [...leads.values()],
    squads,
    initiatives: [...initiatives.values()],
    workItems,
    sprints,
    pulseChecks: [],
  };
  const summary: ConvertSummary = {
    asOf,
    issues: is,
    sprints: ss,
    squads: squads.map((s) => ({
      name: s.name,
      teamType: s.teamType,
      issues: workItems.filter((i) => i.squadId === s.id).length,
      sprints: sprints.filter((sp) => sp.squadId === s.id).length,
    })),
    unmatchedSquadValues: [...unmatched].sort(),
    warnings,
  };
  return { dataset, summary };
}

/**
 * Canonical data model.
 *
 * Everything in the portal reads these shapes and nothing else. Data sources
 * (mock today, eazyBI next, raw Jira later) only have to map *into* this model,
 * so swapping a source never touches metrics or UI code.
 *
 * Design rules carried over from the platform decisions:
 *  - `teamType` is a first-class dimension: Scrum and Kanban are measured differently.
 *  - A pod is a group of teams (squads), like a domain or a Delivery Lead's portfolio.
 *  - All dates are ISO strings (UTC, yyyy-mm-dd or full ISO) to keep snapshots serialisable.
 */

export type ISODate = string;

export type TeamType = 'scrum' | 'kanban';

export interface Domain {
  id: string;
  name: string;
  /** Domain manager — the "domain altitude" audience */
  manager: string;
}

export interface ValueStream {
  id: string;
  name: string;
  domainId: string;
}

export interface DeliveryLead {
  id: string;
  name: string;
}

/** A group of teams. */
export interface Pod {
  id: string;
  name: string;
}

export interface Squad {
  id: string;
  name: string;
  domainId: string;
  valueStreamId: string;
  deliveryLeadId: string;
  /** null when the team isn't part of a pod */
  podId: string | null;
  teamType: TeamType;
  /** Jira project / board key the squad's data is sourced from */
  boardKey: string;
}

export interface Initiative {
  id: string;
  name: string;
  domainId: string;
  valueStreamId: string;
  targetDate: ISODate;
  status: 'not_started' | 'in_progress' | 'done';
}

export type WorkItemType = 'story' | 'bug' | 'task';

/**
 * Development category — where effort goes (investment mix). Independent of issue type:
 * in Jira this comes from a "Work category" field or label, mapped by the source.
 */
export type WorkCategory = 'okr' | 'nonOkr' | 'ktlo' | 'learning' | 'none';

/** Fixed display order — also the categorical colour order. */
export const WORK_CATEGORIES: { id: WorkCategory; label: string }[] = [
  { id: 'okr', label: 'OKR aligned' },
  { id: 'nonOkr', label: 'Non-OKR aligned' },
  { id: 'ktlo', label: 'Keep the lights on' },
  { id: 'learning', label: 'L&D' },
  /** Not categorised in Jira — shown so the mix always adds up to every item finished */
  { id: 'none', label: 'None' },
];

export interface WorkItem {
  /** Jira issue key */
  key: string;
  squadId: string;
  type: WorkItemType;
  category: WorkCategory;
  summary: string;
  storyPoints: number | null;
  initiativeId: string | null;
  createdAt: ISODate;
  /** First transition into an "In Progress" status category */
  startedAt: ISODate | null;
  /** Transition into a "Done" status category */
  doneAt: ISODate | null;
}

/** Sprint report as eazyBI / Jira expose it — Scrum squads only. */
export interface Sprint {
  id: string;
  squadId: string;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  /** Points committed at sprint start */
  committedPoints: number;
  /** Of the committed points, how many were completed */
  completedCommittedPoints: number;
  /** Points added after sprint start */
  addedPoints: number;
  /** Of the added points, how many were completed */
  completedAddedPoints: number;
  /** Points removed from the sprint after start */
  removedPoints: number;
  goal: string;
  /** Not a Jira field — null when the source doesn't record it (e.g. eazyBI) */
  goalMet: boolean | null;
}

/** Squad health check dimensions (after the Spotify squad health check model). */
export const PULSE_DIMENSIONS = [
  { id: 'value', label: 'Delivering value' },
  { id: 'release', label: 'Easy to release' },
  { id: 'codebase', label: 'Health of codebase' },
  { id: 'speed', label: 'Speed' },
  { id: 'process', label: 'Suitable process' },
  { id: 'mission', label: 'Mission' },
  { id: 'fun', label: 'Fun' },
  { id: 'learning', label: 'Learning' },
  { id: 'support', label: 'Support' },
  { id: 'autonomy', label: 'Pawns or players' },
] as const;

export type PulseDimension = (typeof PULSE_DIMENSIONS)[number]['id'];

/**
 * One pulse check (squad health check survey) — aggregated per squad, never per person.
 * Scores are the mean response on a 1–5 scale.
 */
export interface PulseCheck {
  id: string;
  squadId: string;
  date: ISODate;
  respondents: number;
  scores: Record<PulseDimension, number>;
}

export interface Dataset {
  /** Snapshot timestamp — every "current" metric is relative to this, not wall-clock time. */
  asOf: ISODate;
  source: { id: string; label: string; isDummy: boolean };
  domains: Domain[];
  valueStreams: ValueStream[];
  deliveryLeads: DeliveryLead[];
  pods: Pod[];
  squads: Squad[];
  initiatives: Initiative[];
  workItems: WorkItem[];
  sprints: Sprint[];
  pulseChecks: PulseCheck[];
}

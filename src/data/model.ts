/**
 * Canonical data model.
 *
 * Everything in the portal reads these shapes and nothing else. Data sources
 * (mock today, eazyBI next, raw Jira later) only have to map *into* this model,
 * so swapping a source never touches metrics or UI code.
 *
 * Design rules carried over from the platform decisions:
 *  - `teamType` is a first-class dimension: Scrum and Kanban are measured differently.
 *  - `podId` is a point-in-time attribute of a work item, NOT a grouping key.
 *    Longitudinal trends anchor on squad / initiative / value stream.
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

export interface Squad {
  id: string;
  name: string;
  domainId: string;
  valueStreamId: string;
  deliveryLeadId: string;
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

export interface WorkItem {
  /** Jira issue key */
  key: string;
  squadId: string;
  type: WorkItemType;
  summary: string;
  storyPoints: number | null;
  initiativeId: string | null;
  /** Point-in-time pod membership (null for stable squads). Never group trends by this. */
  podId: string | null;
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
  goalMet: boolean;
}

export interface Dataset {
  /** Snapshot timestamp — every "current" metric is relative to this, not wall-clock time. */
  asOf: ISODate;
  source: { id: string; label: string; isDummy: boolean };
  domains: Domain[];
  valueStreams: ValueStream[];
  deliveryLeads: DeliveryLead[];
  squads: Squad[];
  initiatives: Initiative[];
  workItems: WorkItem[];
  sprints: Sprint[];
}

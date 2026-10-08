import type { WorkItem } from '../data/model';
import { DAY_MS, daysBetween, inWindow, weekBuckets, type Window } from './period';
import { cv, percentile } from './stats';

export const completedIn = (items: WorkItem[], w: Window) => items.filter((i) => inWindow(i.doneAt, w));

/** Average items completed per week in the window. */
export const throughputPerWeek = (items: WorkItem[], w: Window) => completedIn(items, w).length / (w.days / 7);

export function weeklyThroughput(items: WorkItem[], asOf: string, weeks: number) {
  return weekBuckets(asOf, weeks).map((b) => ({ weekEndMs: b.endMs, count: completedIn(items, b).length }));
}

/** CV of weekly throughput — lower is more predictable (Kanban predictability proxy). */
export function throughputVariability(items: WorkItem[], w: Window) {
  const weeks = Math.max(2, Math.round(w.days / 7));
  const buckets = weekBuckets(new Date(w.endMs).toISOString(), weeks);
  return cv(buckets.map((b) => completedIn(items, b).length));
}

/** Cycle time in days: first In Progress → Done, for items completed in the window. */
export const cycleTimes = (items: WorkItem[], w: Window) =>
  completedIn(items, w)
    .filter((i) => i.startedAt)
    .map((i) => daysBetween(i.startedAt!, i.doneAt!));

/** Lead time in days: Created → Done, for items completed in the window. */
export const leadTimes = (items: WorkItem[], w: Window) =>
  completedIn(items, w).map((i) => daysBetween(i.createdAt, i.doneAt!));

export const cycleTimePercentile = (items: WorkItem[], w: Window, p: number) => percentile(cycleTimes(items, w), p);

/** Items in progress at the snapshot. */
export const wipAt = (items: WorkItem[], atMs: number) =>
  items.filter((i) => i.startedAt && Date.parse(i.startedAt) <= atMs && (!i.doneAt || Date.parse(i.doneAt) > atMs));

export const itemAgeDays = (i: WorkItem, atMs: number) => (i.startedAt ? (atMs - Date.parse(i.startedAt)) / DAY_MS : 0);

/**
 * Ageing WIP: in-progress items already older than the 85th percentile cycle time
 * of recently completed work (last 90 days). These are the items most likely to blow forecasts.
 */
export function ageingWip(items: WorkItem[], asOf: string) {
  const atMs = Date.parse(asOf);
  const ref: Window = { startMs: atMs - 90 * DAY_MS, endMs: atMs, days: 90 };
  const p85 = cycleTimePercentile(items, ref, 85);
  const wip = wipAt(items, atMs);
  const ageing = Number.isFinite(p85) ? wip.filter((i) => itemAgeDays(i, atMs) > p85) : [];
  return { wip, ageing, p85, share: wip.length ? ageing.length / wip.length : 0 };
}

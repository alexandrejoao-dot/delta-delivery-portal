import type { Sprint } from '../data/model';
import { inWindow, type Window } from './period';
import { cv, mean, sum } from './stats';

export const sprintsEndingIn = (sprints: Sprint[], w: Window) => sprints.filter((s) => inWindow(s.endDate, w));

/** Say/Do: share of committed points completed. Pooled across sprints (points-weighted). */
export function sayDo(sprints: Sprint[]) {
  const committed = sum(sprints.map((s) => s.committedPoints));
  return committed ? sum(sprints.map((s) => s.completedCommittedPoints)) / committed : NaN;
}

export const sprintSayDo = (s: Sprint) => (s.committedPoints ? s.completedCommittedPoints / s.committedPoints : NaN);

/** Scope change: points added after sprint start, relative to the commitment. */
export function scopeChange(sprints: Sprint[]) {
  const committed = sum(sprints.map((s) => s.committedPoints));
  return committed ? sum(sprints.map((s) => s.addedPoints)) / committed : NaN;
}

export const sprintVelocity = (s: Sprint) => s.completedCommittedPoints + s.completedAddedPoints;

export const avgVelocity = (sprints: Sprint[]) => mean(sprints.map(sprintVelocity));

/**
 * Velocity variability (CV) — computed per squad. Pooling squads would measure
 * team-size differences, not instability, so groups use the median of squad CVs.
 */
export const velocityVariability = (sprints: Sprint[]) =>
  sprints.length >= 3 ? cv(sprints.map(sprintVelocity)) : NaN; // too noisy below 3 sprints

/** Only sprints where the goal outcome was recorded count; NaN when none were. */
export const goalHitRate = (sprints: Sprint[]) => {
  const known = sprints.filter((s) => s.goalMet !== null);
  return known.length ? known.filter((s) => s.goalMet).length / known.length : NaN;
};

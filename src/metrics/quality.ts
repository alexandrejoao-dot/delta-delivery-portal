import type { WorkItem } from '../data/model';
import { inWindow, type Window } from './period';
import { completedIn } from './flow';

/** Share of completed items that are bugs. */
export function bugRatio(items: WorkItem[], w: Window) {
  const done = completedIn(items, w);
  return done.length ? done.filter((i) => i.type === 'bug').length / done.length : NaN;
}

export function bugBalance(items: WorkItem[], w: Window) {
  const bugs = items.filter((i) => i.type === 'bug');
  return {
    created: bugs.filter((i) => inWindow(i.createdAt, w)).length,
    resolved: bugs.filter((i) => inWindow(i.doneAt, w)).length,
  };
}

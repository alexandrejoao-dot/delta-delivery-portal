import { WORK_CATEGORIES, type Dataset, type Squad, type WorkCategory, type WorkItem } from '../data/model';
import { completedIn } from './flow';
import type { Window } from './period';

/** Share of finished items per development category (item counts — points aren't comparable across squads). */
export function categoryMix(items: WorkItem[], w: Window): Record<WorkCategory, number> {
  const done = completedIn(items, w);
  return Object.fromEntries(
    WORK_CATEGORIES.map((c) => [c.id, done.length ? done.filter((i) => i.category === c.id).length / done.length : NaN]),
  ) as Record<WorkCategory, number>;
}

export function categoryMixFor(data: Dataset, squads: Squad[], w: Window) {
  const ids = new Set(squads.map((s) => s.id));
  return categoryMix(data.workItems.filter((i) => ids.has(i.squadId)), w);
}

import type { Dataset } from '../../model';
import type { DataSource } from '../types';

/**
 * eazyBI adapter: loads the canonical snapshot that `npm run snapshot` builds from eazyBI CSV exports
 * (converter in ./convert.ts, report spec in docs/eazybi-reports.md). Never calls eazyBI from the
 * browser — credentials and real data stay with the extraction step.
 */
export const eazybiSource: DataSource = {
  id: 'eazybi',
  label: 'eazyBI snapshot',
  async load(): Promise<Dataset> {
    const url = import.meta.env.VITE_SNAPSHOT_URL as string | undefined;
    if (!url) throw new Error('eazyBI source selected but VITE_SNAPSHOT_URL is not set.');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Snapshot fetch failed: ${res.status}`);
    const data = (await res.json()) as Dataset;
    // Snapshots built before pods existed have none
    const pods = data.pods ?? [];
    const squads = data.squads.map((s) => ({ ...s, podId: s.podId ?? null }));
    return { ...data, pods, squads, source: { id: 'eazybi', label: 'eazyBI snapshot', isDummy: false } };
  },
};

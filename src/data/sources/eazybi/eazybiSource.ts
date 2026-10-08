import type { Dataset } from '../../model';
import type { DataSource } from '../types';

/**
 * eazyBI adapter — NOT IMPLEMENTED (next step after the POC).
 *
 * Intended approach (see CLAUDE.md → "Wiring eazyBI"):
 *  1. Do NOT call eazyBI from the browser (credentials + CORS). Run a small
 *     extraction job (Python or Node) that calls the eazyBI report export API
 *     (`/accounts/{id}/export/report/{report_id}.json`) on a schedule.
 *  2. Map each export into the canonical model (src/data/model.ts) and write a
 *     dated snapshot (JSON/Parquet/DuckDB) — this preserves history for when eazyBI
 *     is deprecated and lets us validate a future Jira pipeline against it.
 *  3. This adapter then just fetches the latest snapshot JSON from `VITE_SNAPSHOT_URL`.
 *
 * Reports needed from eazyBI:
 *  - Issues with created / first "In Progress" / resolution dates, type, points, epic → initiative
 *  - Sprint scope: committed, added, removed, completed-of-committed, completed-of-added
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
    return { ...data, source: { id: 'eazybi', label: 'eazyBI snapshot', isDummy: false } };
  },
};

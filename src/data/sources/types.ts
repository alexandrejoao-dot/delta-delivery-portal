import type { Dataset } from '../model';

/**
 * A data source maps an upstream system into the canonical model.
 * Only this layer changes when eazyBI is replaced — metrics and UI never import a source directly.
 */
export interface DataSource {
  id: string;
  label: string;
  load(): Promise<Dataset>;
}

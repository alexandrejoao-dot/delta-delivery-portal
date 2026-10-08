import type { DataSource } from './sources/types';
import { mockSource } from './sources/mock/mockSource';
import { eazybiSource } from './sources/eazybi/eazybiSource';

const sources: Record<string, DataSource> = {
  mock: mockSource,
  eazybi: eazybiSource,
};

/** Select with VITE_DATA_SOURCE=mock|eazybi (defaults to mock). */
export function getDataSource(): DataSource {
  const id = (import.meta.env?.VITE_DATA_SOURCE as string | undefined) ?? 'mock';
  return sources[id] ?? mockSource;
}

export const availableSources = Object.values(sources);

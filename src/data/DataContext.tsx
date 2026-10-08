import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Dataset } from './model';
import { getDataSource } from './index';

const DataCtx = createContext<Dataset | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDataSource()
      .load()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-body-sm text-bad">
        Could not load data: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-body-sm text-on-surface-variant">
        Loading delivery data…
      </div>
    );
  }
  return <DataCtx.Provider value={data}>{children}</DataCtx.Provider>;
}

export function useDataset(): Dataset {
  const d = useContext(DataCtx);
  if (!d) throw new Error('useDataset must be used inside <DataProvider>');
  return d;
}

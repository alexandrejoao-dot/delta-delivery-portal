import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Dataset, Squad, TeamType } from '../data/model';
import { useDataset } from '../data/DataContext';
import type { PeriodDays } from '../metrics/period';

/**
 * Scope = the "altitude" the user is looking from.
 *  - all     → Global Platforms (leadership)
 *  - domain  → domain manager view
 *  - dl      → a Delivery Lead's squads
 *  - pod     → a pod (group of teams)
 *  - squad   → a single squad (squads see their own data first)
 */
export type Scope =
  | { kind: 'all' }
  | { kind: 'domain'; id: string }
  | { kind: 'dl'; id: string }
  | { kind: 'pod'; id: string }
  | { kind: 'squad'; id: string };

export type TeamTypeFilter = 'all' | TeamType;

interface Filters {
  scope: Scope;
  setScope: (s: Scope) => void;
  period: PeriodDays;
  setPeriod: (p: PeriodDays) => void;
}

const Ctx = createContext<Filters | null>(null);
const KEY = 'delivery-portal:filters:v1';

function readSaved(): Partial<Pick<Filters, 'scope' | 'period'>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  const saved = readSaved();
  const [scope, setScope] = useState<Scope>(saved.scope ?? { kind: 'all' });
  const [period, setPeriod] = useState<PeriodDays>(saved.period ?? 90);

  // Team type is deliberately not a global filter: a page-level toggle once hid Kanban squads everywhere,
  // and kept doing so after reload. Saving only scope + period also drops any old saved team type.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ scope, period }));
    } catch {
      /* storage unavailable — filters just won't persist */
    }
  }, [scope, period]);

  const value = useMemo(() => ({ scope, setScope, period, setPeriod }), [scope, period]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilters(): Filters {
  const f = useContext(Ctx);
  if (!f) throw new Error('useFilters must be used inside <FiltersProvider>');
  return f;
}

export function squadsInScope(data: Dataset, scope: Scope, teamType: TeamTypeFilter = 'all'): Squad[] {
  let squads = data.squads;
  if (scope.kind === 'domain') squads = squads.filter((s) => s.domainId === scope.id);
  if (scope.kind === 'dl') squads = squads.filter((s) => s.deliveryLeadId === scope.id);
  if (scope.kind === 'pod') squads = squads.filter((s) => s.podId === scope.id);
  if (scope.kind === 'squad') squads = squads.filter((s) => s.id === scope.id);
  if (teamType !== 'all') squads = squads.filter((s) => s.teamType === teamType);
  return squads;
}

export function scopeLabel(data: Dataset, scope: Scope): string {
  switch (scope.kind) {
    case 'all':
      return 'Global Platforms';
    case 'domain':
      return data.domains.find((d) => d.id === scope.id)?.name ?? 'Domain';
    case 'dl':
      return `${data.deliveryLeads.find((d) => d.id === scope.id)?.name ?? 'Delivery Lead'}'s teams`;
    case 'pod':
      return `${data.pods.find((p) => p.id === scope.id)?.name ?? 'Pod'} pod`;
    case 'squad':
      return data.squads.find((s) => s.id === scope.id)?.name ?? 'Team';
  }
}

/** Convenience hook: dataset + squads matching the current filters. */
export function useScopedSquads() {
  const data = useDataset();
  const f = useFilters();
  const squads = useMemo(() => squadsInScope(data, f.scope), [data, f.scope]);
  return { data, squads, ...f, label: scopeLabel(data, f.scope) };
}

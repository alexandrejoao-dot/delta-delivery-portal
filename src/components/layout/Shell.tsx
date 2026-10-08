import { useState, type ReactNode } from 'react';
import {
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdHelpOutline,
  MdLockOutline,
  MdMenu,
  MdOutlineAnalytics,
  MdOutlineBugReport,
  MdOutlineEngineering,
  MdOutlineEuro,
  MdOutlineGroups,
  MdOutlineHome,
  MdOutlineMenuBook,
  MdOutlineSecurity,
  MdOutlineStorage,
  MdOutlineSupportAgent,
  MdOutlineTimer,
  MdSearch,
} from 'react-icons/md';
import { useDataset } from '../../data/DataContext';
import { Link, navigate } from '../../lib/router';
import { longDate } from '../../lib/format';
import type { PeriodDays } from '../../metrics/period';
import { useFilters, type Scope } from '../../state/filters';
import { cx } from '../ui';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Delivery',
    items: [
      { to: '/', label: 'Overview', icon: <MdOutlineHome /> },
      { to: '/predictability', label: 'Predictability', icon: <MdOutlineAnalytics /> },
      { to: '/flow', label: 'Flow', icon: <MdOutlineTimer /> },
      { to: '/quality', label: 'Quality', icon: <MdOutlineBugReport /> },
      { to: '/squads', label: 'Squads', icon: <MdOutlineGroups /> },
    ],
  },
  {
    title: 'KPI Playbook',
    items: [{ to: '/metrics', label: 'Metric catalogue', icon: <MdOutlineMenuBook /> }],
  },
  {
    title: 'Coming next',
    items: [
      { to: '/coming/engineering', label: 'Engineering (DORA)', icon: <MdOutlineEngineering />, disabled: true },
      { to: '/coming/service', label: 'Service & Ops', icon: <MdOutlineSupportAgent />, disabled: true },
      { to: '/coming/risk', label: 'Risk & Security', icon: <MdOutlineSecurity />, disabled: true },
      { to: '/coming/finance', label: 'Finance', icon: <MdOutlineEuro />, disabled: true },
    ],
  },
];

function isActive(to: string, path: string) {
  return to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`);
}

function Sidebar({ path, collapsed, onToggle, onNavigate }: { path: string; collapsed: boolean; onToggle: () => void; onNavigate?: () => void }) {
  return (
    <nav className={cx('flex h-full flex-col bg-primary text-body-sm text-primary-fixed transition-[width] duration-300', collapsed ? 'w-20' : 'w-[260px]')}>
      <div className={cx('flex items-center gap-3 border-b border-on-primary-fixed-variant/40 py-6', collapsed ? 'justify-center px-2' : 'px-5')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-secondary-fixed text-[13px] font-bold text-primary">
          S
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[16px] font-bold leading-6 text-on-primary">Performance Portal</div>
            <div className="truncate text-label-sm text-primary-fixed-dim/70">Sinal · Insights & Performance</div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {sections.map((sec) => (
          <div key={sec.title} className="mb-3">
            {!collapsed && (
              <div className="px-5 pb-2 pt-2 text-label-md uppercase text-primary-fixed-dim/50">{sec.title}</div>
            )}
            {sec.items.map((it) => {
              const active = isActive(it.to, path);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  title={collapsed ? it.label : undefined}
                  onClick={onNavigate}
                  className={cx(
                    'flex items-center gap-3 border-l-4 py-2.5 transition-colors',
                    collapsed ? 'justify-center px-0' : 'px-4',
                    active
                      ? 'border-secondary-fixed bg-on-primary-fixed-variant text-primary-fixed'
                      : 'border-transparent text-on-primary-container hover:bg-on-primary-fixed-variant/50 hover:text-primary-fixed',
                    it.disabled && !active && 'opacity-60',
                  )}
                >
                  <span className="text-[22px]">{it.icon}</span>
                  {!collapsed && <span className="flex-1 truncate font-medium">{it.label}</span>}
                  {!collapsed && it.disabled && <MdLockOutline className="text-[14px]" aria-label="Not live yet" />}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-on-primary-fixed-variant/40 py-3">
        <Link
          to="/data"
          onClick={onNavigate}
          className={cx(
            'flex items-center gap-3 border-l-4 py-2.5',
            collapsed ? 'justify-center' : 'px-4',
            isActive('/data', path) ? 'border-secondary-fixed bg-on-primary-fixed-variant text-primary-fixed' : 'border-transparent text-on-primary-container hover:bg-on-primary-fixed-variant/50',
          )}
        >
          <MdOutlineStorage className="text-[22px]" />
          {!collapsed && <span className="font-medium">Data sources</span>}
        </Link>
        <button
          onClick={onToggle}
          className={cx('hidden w-full items-center gap-3 py-2.5 text-on-primary-container hover:bg-on-primary-fixed-variant/50 md:flex', collapsed ? 'justify-center' : 'px-5')}
        >
          {collapsed ? <MdChevronRight className="text-[22px]" /> : <MdChevronLeft className="text-[22px]" />}
          {!collapsed && <span className="font-medium">Collapse sidebar</span>}
        </button>
      </div>
    </nav>
  );
}

function encodeScope(s: Scope) {
  return s.kind === 'all' ? 'all' : `${s.kind}:${s.id}`;
}
function decodeScope(v: string): Scope {
  if (v === 'all') return { kind: 'all' };
  const [kind, id] = v.split(':');
  return { kind, id } as Scope;
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const data = useDataset();
  const { scope, setScope, period, setPeriod } = useFilters();
  const [q, setQ] = useState('');

  const goSearch = (value: string) => {
    const sq = data.squads.find((s) => s.name.toLowerCase() === value.trim().toLowerCase());
    if (sq) {
      navigate(`/squads/${sq.id}`);
      setQ('');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-outline-variant bg-surface/95 px-4 backdrop-blur md:px-6">
      <button className="text-[24px] text-on-surface-variant md:hidden" onClick={onMenu} aria-label="Open menu">
        <MdMenu />
      </button>
      <div className="relative hidden w-56 lg:block">
        <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline" />
        <input
          list="squad-names"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            goSearch(e.target.value);
          }}
          onKeyDown={(e) => e.key === 'Enter' && goSearch(q)}
          placeholder="Jump to squad…"
          className="w-full rounded border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-3 text-body-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
        <datalist id="squad-names">
          {data.squads.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
        <label className="flex min-w-0 items-center gap-2 text-body-sm text-on-surface-variant">
          <span className="hidden whitespace-nowrap sm:inline">Viewing</span>
          <span className="relative min-w-0">
            <select
              value={encodeScope(scope)}
              onChange={(e) => setScope(decodeScope(e.target.value))}
              className="w-full max-w-[220px] cursor-pointer truncate rounded border border-outline-variant bg-surface-container-lowest py-2 pl-3 pr-8 text-body-sm font-medium text-on-surface focus:border-primary focus:outline-none"
              aria-label="Scope"
            >
              <option value="all">All of Global Platforms</option>
              <optgroup label="Domain">
                {data.domains.map((d) => (
                  <option key={d.id} value={`domain:${d.id}`}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Delivery Lead">
                {data.deliveryLeads.map((d) => (
                  <option key={d.id} value={`dl:${d.id}`}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Squad">
                {data.squads.map((s) => (
                  <option key={s.id} value={`squad:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <MdChevronRight className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-outline" />
          </span>
        </label>
        <div className="hidden items-center rounded border border-outline-variant bg-surface-container-lowest p-0.5 sm:inline-flex" role="radiogroup" aria-label="Period">
          {([30, 90, 180] as PeriodDays[]).map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={p === period}
              onClick={() => setPeriod(p)}
              className={cx(
                'rounded-[3px] px-2.5 py-1.5 text-label-md',
                p === period ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low',
              )}
            >
              {p}d
            </button>
          ))}
        </div>
        <Link to="/metrics" className="hidden h-9 w-9 items-center justify-center rounded-full text-[22px] text-on-surface-variant hover:bg-surface-container-high md:flex" title="How metrics are defined">
          <MdHelpOutline />
        </Link>
        <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-secondary-fixed text-[12px] font-bold text-primary md:flex" title="Signed in (demo)">
          JA
        </div>
      </div>
    </header>
  );
}

export function Shell({ path, children }: { path: string; children: ReactNode }) {
  const data = useDataset();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden md:block">
        <Sidebar path={path} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full w-[260px]">
            <Sidebar path={path} collapsed={false} onToggle={() => undefined} onNavigate={() => setMobileOpen(false)} />
            <button className="absolute right-3 top-3 text-[22px] text-on-primary" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <MdClose />
            </button>
          </div>
        </div>
      )}
      <div className={cx('flex min-h-screen flex-col transition-[margin] duration-300', collapsed ? 'md:ml-20' : 'md:ml-[260px]')}>
        <TopBar onMenu={() => setMobileOpen(true)} />
        {data.source.isDummy && (
          <div className="border-b border-warn-border bg-warn-bg px-4 py-1.5 text-center text-label-sm text-warn md:px-6">
            Proof of concept · dummy data generated for demonstration · snapshot {longDate(data.asOf)}
          </div>
        )}
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 md:px-6">{children}</main>
      </div>
    </div>
  );
}

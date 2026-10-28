import { Card, CardHeader, PageHeader, StatusBadge } from '../components/ui';
import { useDataset } from '../data/DataContext';
import { longDate } from '../lib/format';

const adapters = [
  { id: 'mock', name: 'Dummy data', desc: 'Seeded generator with behavioural team profiles. Deterministic — same data on every load.', status: 'Live in POC' },
  { id: 'eazybi', name: 'eazyBI snapshot', desc: 'Scheduled export from eazyBI reports → canonical snapshot JSON. Trusted numbers the organisation already uses.', status: 'Next' },
  { id: 'jira', name: 'Jira changelog (direct)', desc: 'REST API + changelog extraction. Replaces eazyBI when it is deprecated; validated against historical snapshots.', status: 'Later' },
];

const steps = ['Jira', 'eazyBI reports', 'Extraction job', 'Canonical snapshot', 'Metrics engine', 'Portal'];

export function DataSources() {
  const data = useDataset();
  const entities = [
    ['Domains', data.domains.length],
    ['Value streams', data.valueStreams.length],
    ['Delivery Leads', data.deliveryLeads.length],
    ['Teams', data.squads.length],
    ['Initiatives', data.initiatives.length],
    ['Work items', data.workItems.length],
    ['Sprints', data.sprints.length],
    ['Pulse checks', data.pulseChecks.length],
  ] as const;
  return (
    <>
      <PageHeader title="Data sources" subtitle="Where the numbers come from, and how the platform is protected from any single vendor." />
      <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Active source" />
          <div className="flex flex-col gap-3 p-5 text-body-sm">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Source</span>
              <span className="font-semibold">{data.source.label}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant">Snapshot</span>
              <span className="font-semibold">{longDate(data.asOf)}</span>
            </div>
            <div className="mt-2 border-t border-surface-container pt-3">
              {entities.map(([k, v]) => (
                <div key={k} className="flex justify-between py-1">
                  <span className="text-on-surface-variant">{k}</span>
                  <span className="tabular font-medium">{v.toLocaleString('en-GB')}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Adapters" subtitle="Sources map into one canonical model — swapping a source never touches metrics or UI." />
          <ul className="divide-y divide-surface-container">
            {adapters.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div>
                  <div className="font-semibold text-on-surface">{a.name}</div>
                  <p className="mt-0.5 text-body-sm text-on-surface-variant">{a.desc}</p>
                </div>
                <StatusBadge size="sm" status={a.id === data.source.id ? 'good' : a.status === 'Next' ? 'watch' : 'none'} label={a.id === data.source.id ? 'Active' : a.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader title="Target pipeline" subtitle="Thin abstraction layer: only the extraction step changes when eazyBI is retired." />
        <div className="flex flex-wrap items-center gap-2 p-5">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`rounded-md border px-3 py-2 text-body-sm font-medium ${i === 3 ? 'border-series-1 bg-primary-fixed/40 text-on-surface' : 'border-outline-variant bg-surface-container-low text-on-surface'}`}>
                {s}
              </span>
              {i < steps.length - 1 && <span className="text-outline">→</span>}
            </div>
          ))}
        </div>
        <p className="px-5 pb-5 text-body-sm text-on-surface-variant">
          Snapshots are kept per extraction date (JSON / Parquet / DuckDB), so history survives a source migration and can be used to validate the replacement pipeline.
        </p>
      </Card>
    </>
  );
}

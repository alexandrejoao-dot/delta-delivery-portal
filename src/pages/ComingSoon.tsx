import { MdLockOutline } from 'react-icons/md';
import { Card, PageHeader } from '../components/ui';

const plans: Record<string, { title: string; maturity: string; metrics: string[]; note: string }> = {
  engineering: {
    title: 'Engineering (DORA)',
    maturity: 'Not tracked yet',
    metrics: ['Deployment frequency', 'Lead time for changes', 'Change failure rate', 'Failed deployment recovery time', 'PR review time'],
    note: 'Needs CI/CD and incident data sources. Same canonical-model pattern: add entities (deployments, incidents) and an adapter.',
  },
  service: {
    title: 'Service & Ops',
    maturity: 'Scattered across tools',
    metrics: ['Incident volume by severity', 'MTTA / MTTR', 'SLO attainment', 'Toil share'],
    note: 'First step is consolidating definitions into the KPI Playbook before building views.',
  },
  risk: {
    title: 'Risk & Security',
    maturity: 'To be scoped',
    metrics: ['Vulnerability age by severity', 'Overdue security actions', 'Audit findings open'],
    note: 'Scope with Security partners; likely a team-level view first.',
  },
  finance: {
    title: 'Finance',
    maturity: 'No metrics yet',
    metrics: ['Capitalisable vs operational effort', 'Spend by initiative', 'Cost per value stream'],
    note: 'Depends on initiative-level effort attribution — the work-item → initiative link built here is the foundation.',
  },
};

export function ComingSoon({ id }: { id: string }) {
  const p = plans[id] ?? plans.engineering;
  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant px-2.5 py-1 text-label-sm text-on-surface-variant">
            <MdLockOutline /> Not live yet
          </span>
        }
        title={p.title}
        subtitle={`Current maturity: ${p.maturity}. Delivery metrics come first — a small, defensible MVP before expanding.`}
      />
      <Card className="max-w-3xl p-6">
        <h3 className="mb-3 text-title-lg">Candidate metrics</h3>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-body-sm text-on-surface">
          {p.metrics.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <p className="text-body-sm text-on-surface-variant">{p.note}</p>
      </Card>
    </>
  );
}

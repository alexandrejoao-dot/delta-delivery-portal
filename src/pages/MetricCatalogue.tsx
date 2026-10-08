import { useState } from 'react';
import { MdSearch } from 'react-icons/md';
import { Card, PageHeader, StatusBadge, TeamTypeTag } from '../components/ui';
import { formatValue } from '../lib/format';
import { METRIC_LIST, type MetricCategory, type MetricDefinition } from '../metrics/catalogue';

const categories: MetricCategory[] = ['Predictability', 'Flow', 'Quality'];

function Thresholds({ m }: { m: MetricDefinition }) {
  if (!m.thresholds) return <span className="text-body-sm text-on-surface-variant">Context metric — no target (used for trends and forecasting, not judgement)</span>;
  const { good, watch } = m.thresholds;
  const f = (v: number) => formatValue(v, m.unit, { compact: true });
  const [g, w, a] =
    m.direction === 'higher' ? [`≥ ${f(good)}`, `${f(watch)} – ${f(good)}`, `< ${f(watch)}`] : [`≤ ${f(good)}`, `${f(good)} – ${f(watch)}`, `> ${f(watch)}`];
  return (
    <div className="flex flex-wrap gap-2">
      <StatusBadge size="sm" status="good" label={`On track ${g}`} />
      <StatusBadge size="sm" status="watch" label={`Watch ${w}`} />
      <StatusBadge size="sm" status="attention" label={`Attention ${a}`} />
    </div>
  );
}

export function MetricCatalogue() {
  const [q, setQ] = useState('');
  const match = (m: MetricDefinition) => `${m.name} ${m.description} ${m.category}`.toLowerCase().includes(q.toLowerCase());
  return (
    <>
      <PageHeader
        title="Metric catalogue"
        subtitle="The KPI Playbook, live: every number in the portal is defined here — meaning, formula, data source and thresholds."
        actions={
          <div className="relative w-64">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter metrics…"
              className="w-full rounded border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-3 text-body-sm focus:border-primary focus:outline-none"
            />
          </div>
        }
      />
      {categories.map((cat) => {
        const list = METRIC_LIST.filter((m) => m.category === cat && match(m));
        if (!list.length) return null;
        return (
          <section key={cat} className="mb-8">
            <h3 className="mb-3 text-label-md uppercase text-on-surface-variant">{cat}</h3>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {list.map((m) => (
                <Card key={m.id} className="p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h4 className="text-title-lg text-on-surface">{m.name}</h4>
                    {m.appliesTo.map((t) => (
                      <TeamTypeTag key={t} type={t} />
                    ))}
                    <span className="ml-auto text-label-sm text-on-surface-variant">
                      {m.direction === 'higher' ? 'Higher is better' : m.direction === 'lower' ? 'Lower is better' : 'Context'}
                    </span>
                  </div>
                  <p className="mb-3 text-body-sm text-on-surface-variant">{m.description}</p>
                  <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 text-body-sm">
                    <dt className="text-label-md uppercase text-on-surface-variant">Formula</dt>
                    <dd>
                      <code className="rounded bg-surface-container-low px-1.5 py-0.5 font-mono text-[12.5px] text-on-surface">{m.formula}</code>
                    </dd>
                    <dt className="text-label-md uppercase text-on-surface-variant">Source</dt>
                    <dd className="text-on-surface">{m.source}</dd>
                    <dt className="text-label-md uppercase text-on-surface-variant">Signals</dt>
                    <dd>
                      <Thresholds m={m} />
                    </dd>
                  </dl>
                  {m.caveat && (
                    <p className="mt-3 rounded-md border-l-4 border-tertiary-fixed-dim bg-tertiary-fixed/25 px-3 py-2 text-body-sm text-on-surface">
                      {m.caveat}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

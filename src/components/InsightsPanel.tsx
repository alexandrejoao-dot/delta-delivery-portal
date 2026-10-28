import { MdCheckCircleOutline, MdErrorOutline, MdLightbulbOutline, MdWarningAmber } from 'react-icons/md';
import type { Insight, InsightTone } from '../metrics/insights';
import { Link } from '../lib/router';
import { cx } from './ui';

const tone: Record<InsightTone, { box: string; icon: string; Icon: typeof MdErrorOutline; label: string }> = {
  attention: { box: 'border-bad-border bg-bad-bg/60', icon: 'text-bad', Icon: MdErrorOutline, label: 'Needs attention' },
  watch: { box: 'border-warn-border bg-warn-bg/70', icon: 'text-warn', Icon: MdWarningAmber, label: 'Watch' },
  positive: { box: 'border-good-border bg-good-bg/70', icon: 'text-good', Icon: MdCheckCircleOutline, label: 'Positive' },
};

export function InsightsPanel({ insights, limit = 6, title = 'Actionable insights' }: { insights: Insight[]; limit?: number; title?: string }) {
  const shown = insights.slice(0, limit);
  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
      <div className="mb-4 flex items-center gap-2 border-b border-outline-variant/40 pb-3">
        <MdLightbulbOutline className="text-[22px] text-tertiary-fixed-dim" />
        <h3 className="text-headline-sm text-on-surface">{title}</h3>
        <span className="ml-auto text-label-sm text-on-surface-variant">
          {insights.length} signal{insights.length === 1 ? '' : 's'} · rule-based
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">Nothing stands out for this scope and period.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((i) => {
            const t = tone[i.tone];
            return (
              <article key={i.id} className={cx('flex gap-3 rounded-md border p-3.5', t.box)}>
                <t.Icon className={cx('mt-0.5 shrink-0 text-[20px]', t.icon)} aria-label={t.label} />
                <div className="min-w-0">
                  <h4 className="text-body-sm font-semibold text-on-surface">{i.title}</h4>
                  <p className="mt-1 text-body-sm text-on-surface-variant">{i.body}</p>
                  <p className="mt-2 border-l-2 border-outline-variant pl-2 text-[13px] italic text-on-surface-variant">{i.prompt}</p>
                  <Link to={`/teams/${i.squadId}`} className="mt-2 inline-block text-label-md text-series-1 hover:underline">
                    Open team →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

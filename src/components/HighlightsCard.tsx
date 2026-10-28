import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MdAutoAwesome, MdChevronLeft, MdChevronRight, MdPause, MdPlayArrow } from 'react-icons/md';
import type { Dataset, Squad } from '../data/model';
import { formatMetric } from '../lib/format';
import { Link } from '../lib/router';
import { canCompare, describeHighlight, highlights } from '../metrics/highlights';
import type { PeriodDays } from '../metrics/period';
import { metricTrend } from '../metrics/trend';
import { Sparkline } from './charts/Sparkline';
import { CHART } from './charts/chartKit';
import { cx, SquadAvatar, StatusBadge } from './ui';

const ROTATE_MS = 8000;

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Highlights — up to three rotating "news" stories for the scope and period:
 * what dropped and deserves a heads-up, and what is worth celebrating. Experimental.
 */
export function HighlightsCard({ data, squads, period }: { data: Dataset; squads: Squad[]; period: PeriodDays }) {
  const stories = useMemo(() => {
    return highlights(data, squads, period).map((h) => {
      const squad = data.squads.find((s) => s.id === h.squadId)!;
      return {
        h,
        squad,
        index: data.squads.indexOf(squad),
        text: describeHighlight(h, squad.name, period, (id, v) => formatMetric(id, v, true)),
        trend: metricTrend(data, [squad], h.metricId).map((t) => t.value),
      };
    });
  }, [data, squads, period]);

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [hovering, setHovering] = useState(false);
  const n = stories.length;

  useEffect(() => setI(0), [stories]);
  useEffect(() => {
    if (paused || hovering || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, hovering, n]);

  const go = (d: number) => setI((x) => (x + d + n) % n);
  const s = stories[i];

  return (
    <section
      className="flex flex-col rounded-lg border border-outline-variant bg-surface-container-lowest lg:col-span-2"
      aria-roledescription="carousel"
      aria-label="Highlights"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <div className="flex items-center gap-3 border-b border-outline-variant px-5 py-4">
        <MdAutoAwesome className="text-[22px] text-tertiary-fixed-dim" aria-hidden />
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-title-lg text-on-surface">
            Highlights
            <span className="rounded border border-outline-variant px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Experiment
            </span>
          </h3>
          <p className="mt-0.5 text-body-sm text-on-surface-variant">What moved most in the last {period} days vs the {period} before</p>
        </div>
        {n > 1 && (
          <div className="ml-auto flex items-center gap-1">
            <span className="mr-1 text-label-sm tabular text-on-surface-variant">
              {i + 1} / {n}
            </span>
            <IconButton label="Previous story" onClick={() => go(-1)}>
              <MdChevronLeft />
            </IconButton>
            <IconButton label={paused ? 'Play' : 'Pause'} onClick={() => setPaused((p) => !p)}>
              {paused ? <MdPlayArrow /> : <MdPause />}
            </IconButton>
            <IconButton label="Next story" onClick={() => go(1)}>
              <MdChevronRight />
            </IconButton>
          </div>
        )}
      </div>

      {!s ? (
        <div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-body-sm text-on-surface-variant">
          {canCompare(data, period)
            ? 'Nothing moved much this period — steady is good news too.'
            : `Not enough history yet to compare two ${period}-day periods. Try a shorter period.`}
        </div>
      ) : (
        <div className="flex flex-1 flex-col p-5">
          <article
            key={s.h.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${n}`}
            className="flex flex-1 flex-col gap-5 motion-safe:animate-[highlight-in_350ms_ease-out] md:flex-row md:items-stretch"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={s.h.kind === 'drop' ? s.h.status : 'good'} label={s.text.label} />
                <span className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                  <SquadAvatar name={s.squad.name} index={s.index} />
                  {s.squad.name}
                </span>
              </div>
              <h4 className="mt-3 text-headline-sm text-on-surface">{s.text.headline}</h4>
              <p className="mt-1 text-body-sm text-on-surface-variant">{s.text.body}</p>
              <p className="mt-4 border-l-2 border-outline-variant pl-3 text-body-sm italic text-on-surface-variant">{s.text.prompt}</p>
              <Link to={`/teams/${s.squad.id}`} className="mt-auto pt-4 text-label-md text-series-1 hover:underline">
                Open {s.squad.name} →
              </Link>
            </div>
            <div className="flex shrink-0 flex-col justify-center gap-3 rounded-md bg-surface-container-low px-5 py-4 md:w-60">
              <div className="flex items-baseline gap-2 tabular">
                <span className="text-title-lg text-on-surface-variant line-through decoration-outline/50">{formatMetric(s.h.metricId, s.h.from, true)}</span>
                <span className="text-on-surface-variant" aria-hidden>
                  →
                </span>
                <span className={cx('text-display-lg', s.h.kind === 'drop' ? (s.h.status === 'attention' ? 'text-bad' : 'text-warn') : 'text-good')}>
                  {formatMetric(s.h.metricId, s.h.to, true)}
                </span>
              </div>
              <div>
                <Sparkline values={s.trend} width={200} height={44} color={CHART.series[0]} />
                <div className="mt-1 text-label-sm text-on-surface-variant">Trend over the last ~6 months</div>
              </div>
            </div>
          </article>
          {n > 1 && (
            <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="Choose a story">
              {stories.map((x, k) => (
                <button
                  key={x.h.id}
                  role="tab"
                  aria-selected={k === i}
                  aria-label={`Story ${k + 1}: ${x.text.headline}`}
                  onClick={() => setI(k)}
                  className={cx('h-1.5 rounded-full transition-all', k === i ? 'w-6 bg-primary' : 'w-1.5 bg-outline-variant hover:bg-outline')}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded text-[20px] text-on-surface-variant hover:bg-surface-container-low focus:outline-none focus-visible:ring-2 focus-visible:ring-series-1/40"
    >
      {children}
    </button>
  );
}

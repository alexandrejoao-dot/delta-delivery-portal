import type { ReactNode } from 'react';
import {
  MdArrowDownward,
  MdArrowUpward,
  MdCheckCircleOutline,
  MdErrorOutline,
  MdInfoOutline,
  MdRemove,
  MdWarningAmber,
} from 'react-icons/md';
import type { Status } from '../../metrics/catalogue';
import type { Health } from '../../metrics/scorecard';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-outline-variant bg-surface-container-lowest', className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-outline-variant px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="text-title-lg text-on-surface">{title}</h3>
        {subtitle && <p className="mt-0.5 text-body-sm text-on-surface-variant">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h2 className="text-headline-md text-on-surface">{title}</h2>
        {subtitle && <p className="mt-1 text-body-md text-on-surface-variant">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  icon,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'tertiary';
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-2 rounded px-4 py-2 text-label-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-series-1/40',
        variant === 'primary' && 'bg-primary-container text-on-primary hover:bg-primary',
        variant === 'secondary' &&
          'border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low',
        variant === 'tertiary' && 'text-on-surface-variant hover:bg-surface-container-high',
      )}
    >
      {icon && <span className="text-[18px]">{icon}</span>}
      {children}
    </button>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded border border-outline-variant bg-surface-container-lowest p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-[3px] px-3 py-1.5 text-label-md transition-colors',
            o.value === value ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const statusStyle: Record<Exclude<Status, 'none'>, { cls: string; dot: string; label: string; Icon: typeof MdCheckCircleOutline }> = {
  good: { cls: 'bg-good-bg text-good border-good-border', dot: 'bg-good', label: 'On track', Icon: MdCheckCircleOutline },
  watch: { cls: 'bg-warn-bg text-warn border-warn-border', dot: 'bg-warn-dot', label: 'Watch', Icon: MdWarningAmber },
  attention: { cls: 'bg-bad-bg text-bad border-bad-border', dot: 'bg-bad-dot', label: 'Needs attention', Icon: MdErrorOutline },
};

/** Status pill — always icon + label, never colour alone. */
export function StatusBadge({ status, label, size = 'md' }: { status: Status | Health; label?: string; size?: 'sm' | 'md' }) {
  if (status === 'none') return <span className="text-label-sm text-outline">—</span>;
  const s = statusStyle[status];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-medium',
        size === 'md' ? 'px-2.5 py-1 text-[12px]' : 'px-2 py-0.5 text-[11px]',
        s.cls,
      )}
    >
      <s.Icon className={size === 'md' ? 'text-[14px]' : 'text-[12px]'} aria-hidden />
      {label ?? s.label}
    </span>
  );
}

/** Delta vs previous period. Colour reflects good/bad direction, arrow reflects up/down. */
export function DeltaChip({ text, improved }: { text: string | null; improved: boolean | null }) {
  if (!text) return <span className="text-label-sm text-outline">no prior data</span>;
  const up = text.startsWith('+');
  const flat = text.startsWith('±');
  const Icon = flat ? MdRemove : up ? MdArrowUpward : MdArrowDownward;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-0.5 text-[12px] font-semibold tabular',
        improved === true && 'text-good',
        improved === false && 'text-bad',
        improved === null && 'text-on-surface-variant',
      )}
    >
      <Icon className="text-[14px]" aria-hidden />
      {text.replace(/^[+−±]/, '')}
    </span>
  );
}

const avatarTones = ['bg-primary-fixed text-primary', 'bg-tertiary-fixed text-[#271902]', 'bg-secondary-fixed text-[#0d1c2f]', 'bg-[#d1fae5] text-[#065f46]', 'bg-[#ede9fe] text-[#5b21b6]'];

export function SquadAvatar({ name, index = 0 }: { name: string; index?: number }) {
  return (
    <div className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded text-[12px] font-bold', avatarTones[index % avatarTones.length])}>
      {name.charAt(0)}
    </div>
  );
}

export function TeamTypeTag({ type }: { type: 'scrum' | 'kanban' }) {
  return (
    <span className="rounded border border-outline-variant px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
      {type}
    </span>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex align-middle" onClick={(e) => e.stopPropagation()}>
      <MdInfoOutline className="text-[15px] text-outline" aria-label={text} tabIndex={0} />
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 hidden w-64 -translate-x-1/2 rounded-md border border-outline-variant bg-white p-2.5 text-left text-[12px] font-normal normal-case leading-snug tracking-normal text-on-surface-variant shadow-[0_4px_12px_-2px_rgb(0_0_0/0.12)] group-hover/tip:block group-focus-within/tip:block">
        {text}
      </span>
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <div className="text-title-lg text-on-surface">{title}</div>
      {body && <p className="max-w-md text-body-sm text-on-surface-variant">{body}</p>}
    </div>
  );
}

export function MiniBar({ value, status, className = 'w-16' }: { value: number; status: Status; className?: string }) {
  const color = status === 'good' ? 'bg-good' : status === 'watch' ? 'bg-warn-dot' : status === 'attention' ? 'bg-bad-dot' : 'bg-series-1';
  return (
    <div className={cx('h-1 overflow-hidden rounded-full bg-surface-container-high', className)}>
      <div className={cx('h-full rounded-full', color)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

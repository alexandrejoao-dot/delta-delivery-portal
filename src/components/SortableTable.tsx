import { useMemo, useState, type ReactNode } from 'react';
import { MdArrowDownward, MdArrowUpward, MdUnfoldMore } from 'react-icons/md';
import { cx, InfoTip } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  tip?: string;
  align?: 'left' | 'right';
  sortValue?: (row: T) => number | string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  minWidth?: number;
  dense?: boolean;
  /** Optional scroll height (sticky header kicks in) */
  maxHeight?: number;
  /** Wide tables: wrap long headers onto two lines and tighten horizontal padding so they fit without scrolling */
  fitWidth?: boolean;
}

/** Data table with sticky header and sortable columns (NaN / missing values always sort last). */
export function SortableTable<T>({ rows, columns, rowKey, onRowClick, initialSort, minWidth = 900, dense, maxHeight, fitWidth }: Props<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const badA = typeof va === 'number' && !Number.isFinite(va);
      const badB = typeof vb === 'number' && !Number.isFinite(vb);
      if (badA || badB) return badA === badB ? 0 : badA ? 1 : -1;
      const r = typeof va === 'string' ? va.localeCompare(String(vb)) : (va as number) - (vb as number);
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  const pad = cx(fitWidth ? 'px-3' : 'px-4', dense ? 'py-2.5' : 'py-3.5');

  return (
    <div className="w-full overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={cx(
                    'sticky top-0 z-10 border-b-2 border-surface-container-highest bg-surface-container-lowest text-label-md font-semibold text-on-surface-variant',
                    pad,
                    fitWidth ? 'align-bottom' : 'whitespace-nowrap',
                    c.align === 'right' && 'text-right',
                  )}
                  aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <span className={cx('inline-flex items-center gap-1', c.align === 'right' && 'flex-row-reverse')}>
                    {c.sortValue ? (
                      <button className="group inline-flex items-center gap-1 text-left hover:text-on-surface" onClick={() => toggle(c.key)}>
                        {c.header}
                        {active ? (
                          sort!.dir === 'asc' ? (
                            <MdArrowUpward className="text-[14px]" />
                          ) : (
                            <MdArrowDownward className="text-[14px]" />
                          )
                        ) : (
                          <MdUnfoldMore className="text-[14px] opacity-40 group-hover:opacity-100" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                    {c.tip && <InfoTip text={c.tip} />}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="text-body-sm text-on-surface">
          {sorted.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cx('border-b border-surface-container transition-colors hover:bg-[#f0f7ff]', onRowClick && 'cursor-pointer')}
            >
              {columns.map((c) => (
                <td key={c.key} className={cx(pad, c.align === 'right' && 'text-right', c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RowMark } from './TenantFrame';

export interface Col<R> {
  label: string;
  cell: (row: R) => ReactNode;
  align?: 'right';
}

const MARK_CLS: Record<RowMark, string> = {
  out: 'opacity-35',
  skipped: 'bg-canvas text-muted line-through decoration-muted',
  held: 'bg-amber-bg',
  kept: 'bg-mint/40',
};

export function PsHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-b border-line px-5 pb-3 pt-4">
      <div className="min-w-0 flex-1">
        <h1 data-label={title} data-kind="screen" className="text-xl font-bold text-ink">
          {title}
        </h1>
        <p className="mt-0.5 text-[13px] text-body">{description}</p>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function PsButton({ label, primary, onAction }: { label: string; primary?: boolean; onAction?: (l: string) => void }) {
  return (
    <button
      type="button"
      data-label={label}
      data-kind="button"
      onClick={() => onAction?.(label)}
      className={`rounded-input px-3 py-1.5 text-[13px] font-semibold ${primary ? 'bg-teal text-white hover:bg-teal-dark' : 'border border-line bg-white text-ink hover:bg-canvas'}`}
    >
      {label}
    </button>
  );
}

export function PsInput({ label, placeholder, value, type = 'text', readOnly }: { label: string; placeholder?: string; value?: string; type?: string; readOnly?: boolean }) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <input
        data-label={label}
        data-kind="field"
        type={type}
        placeholder={placeholder ?? label}
        defaultValue={value}
        readOnly={readOnly}
        className="w-full rounded-input border border-line bg-white px-3 py-1.5 text-[13px] text-ink placeholder:text-muted focus:border-teal focus:outline-none"
      />
    </label>
  );
}

export function MoreFilterButton() {
  return (
    <button type="button" data-label="More Filter" data-kind="button" className="flex shrink-0 items-center gap-1.5 rounded-input border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink">
      <SlidersHorizontal size={14} className="text-muted" />
      More Filter
    </button>
  );
}

export function PsTable<R extends { id: string }>({
  label,
  cols,
  rows,
  marks,
  notes,
}: {
  label: string;
  cols: Col<R>[];
  rows: R[];
  marks?: Record<string, RowMark>;
  notes?: Record<string, string>;
}) {
  return (
    <div className="mx-5 mb-5 overflow-hidden rounded-card border border-line">
      <table data-label={label} data-kind="table" className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-canvas">
            {cols.map((c) => (
              <th
                key={c.label}
                data-label={c.label}
                data-kind="column"
                className={`whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-body ${c.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {c.label}
              </th>
            ))}
            <th className="w-10" aria-label="More" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mark = marks?.[r.id];
            return (
              <tr key={r.id} data-row-id={r.id} className={`border-t border-line transition-colors duration-300 ${mark ? MARK_CLS[mark] : ''}`}>
                {cols.map((c) => (
                  <td key={c.label} className={`whitespace-nowrap px-3 py-2.5 text-ink ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${mark === 'skipped' || mark === 'out' ? '!text-muted' : ''}`}>
                    {c.cell(r)}
                  </td>
                ))}
                <td className="px-2 text-right">
                  {notes?.[r.id] ? (
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium no-underline ${mark === 'held' ? 'bg-amber text-white' : 'bg-white text-muted ring-1 ring-line'}`}>
                      {notes[r.id]}
                    </span>
                  ) : (
                    <span className="text-muted">···</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

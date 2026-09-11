import { FileText, History, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/client';
import type { RunOutcome, RunRecord } from '../domain/types';
import { useStore } from '../state/store';
import { EmptyState, PageHeader } from '../shell/ui';

const OUTCOME: Record<RunOutcome, { text: string; cls: string }> = {
  clean: { text: 'Ran clean', cls: 'bg-mint text-teal' },
  attention: { text: 'Needs attention', cls: 'bg-red-bg text-red' },
  stopped: { text: 'Not approved', cls: 'bg-canvas text-body ring-1 ring-line' },
  preview: { text: 'Dry run', cls: 'bg-canvas text-body ring-1 ring-line' },
  change: { text: 'Rule changed', cls: 'bg-amber-bg text-amber' },
};

export function OutcomePill({ outcome }: { outcome: RunOutcome }) {
  const o = OUTCOME[outcome];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${o.cls}`}>{o.text}</span>;
}

function FileLink({ run }: { run: RunRecord }) {
  if (!run.fileProduced) return <span className="text-muted">—</span>;
  return run.fileId ? (
    <a href={api.fileUrl(run.fileId)} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 font-medium text-teal hover:underline">
      <FileText size={14} />
      {run.fileProduced}
    </a>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-ink">
      <FileText size={14} className="text-muted" />
      {run.fileProduced}
    </span>
  );
}

export function RunHistory() {
  const { state } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = state.history.find((r) => r.id === openId) ?? null;

  return (
    <div>
      <PageHeader title="Run history" description="Everything your automations did, written in plain English. This is also the audit trail." />
      <div className="px-8 py-6">
        {state.history.length === 0 ? (
          <EmptyState icon={<History size={22} />} title="Nothing has run yet" body="When an automation runs, stops, or a house rule changes, it is written down here." />
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-canvas text-left text-xs font-semibold text-body">
                  <th className="px-6 py-3">When</th>
                  <th className="px-4 py-3">Automation</th>
                  <th className="px-4 py-3">Outcome</th>
                  <th className="px-4 py-3">Rows</th>
                  <th className="px-4 py-3">File produced</th>
                </tr>
              </thead>
              <tbody>
                {state.history.map((r) => (
                  <tr key={r.id} onClick={() => setOpenId(r.id)} className={`cursor-pointer border-t border-line hover:bg-canvas/60 ${openId === r.id ? 'bg-mint/40' : ''}`}>
                    <td className="whitespace-nowrap px-6 py-4 text-ink">{r.when}</td>
                    <td className="px-4 py-4 font-medium text-ink">{r.automationName}</td>
                    <td className="px-4 py-4">
                      <OutcomePill outcome={r.outcome} />
                    </td>
                    <td className="px-4 py-4 text-ink">{r.outcome === 'change' ? '—' : `${r.rowsKept} of ${r.rowsRead}`}</td>
                    <td className="px-4 py-4">
                      <FileLink run={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" onClick={() => setOpenId(null)}>
          <aside className="flex h-full w-[440px] flex-col bg-white shadow-drag" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 border-b border-line px-6 py-5">
              <div className="flex-1">
                <div className="text-xs text-muted">{open.when}</div>
                <div className="mt-0.5 text-lg font-semibold text-ink">{open.automationName}</div>
                <div className="mt-2">
                  <OutcomePill outcome={open.outcome} />
                </div>
              </div>
              <button aria-label="Close" onClick={() => setOpenId(null)} className="rounded p-1 text-muted hover:bg-canvas">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <p className="text-[15px] leading-relaxed text-ink">{open.narrative}</p>
              {open.outcome !== 'change' && (
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ['Rows read', open.rowsRead],
                      ['Kept', open.rowsKept],
                      ['Skipped by house rule', open.rowsSkipped],
                      ['Held for you', open.rowsHeld],
                    ] as [string, number][]
                  ).map(([l, n]) => (
                    <div key={l} className="rounded-card border border-line px-3 py-2.5">
                      <div className="text-xs text-muted">{l}</div>
                      <div className="text-lg font-semibold tabular-nums text-ink">{n}</div>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">File produced</div>
                <FileLink run={open} />
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

import { History, X } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../state/store';
import { EmptyState, OutcomePill, PageHeader } from '../shell/ui';
import { FileLink, LogList } from './builder/RunLogs';

export function RunHistory() {
  const { state } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = state.history.find((r) => r.id === openId) ?? null;

  return (
    <div>
      <PageHeader title="Run history" description="Everything your workflows did, written in plain English. This is also the audit trail." />
      <div className="px-8 py-6">
        {state.history.length === 0 ? (
          <EmptyState icon={<History size={22} />} title="Nothing has run yet" body="When a workflow runs, stops, or a house rule changes, it is written down here." />
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-line bg-white">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-[11.5px] font-semibold text-body">
                  <th className="px-4 py-[13px]">When</th>
                  <th className="px-4 py-[13px]">Workflow</th>
                  <th className="px-4 py-[13px]">Outcome</th>
                  <th className="px-4 py-[13px]">Rows</th>
                  <th className="px-4 py-[13px]">File produced</th>
                </tr>
              </thead>
              <tbody>
                {state.history.map((r) => (
                  <tr key={r.id} onClick={() => setOpenId(r.id)} className={`cursor-pointer border-b border-[#F2F4F7] last:border-0 hover:bg-canvas ${openId === r.id ? 'bg-[#F6FBFA]' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-[15px] text-body">{r.when}</td>
                    <td className="px-4 py-[15px] text-[13.5px] font-semibold text-teal">{r.automationName}</td>
                    <td className="px-4 py-[15px]">
                      <OutcomePill outcome={r.outcome} />
                    </td>
                    <td className="px-4 py-[15px] text-body">{r.outcome === 'change' ? '—' : `${r.rowsKept} of ${r.rowsRead}`}</td>
                    <td className="px-4 py-[15px]">
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
        <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(16,24,40,0.2)]" onClick={() => setOpenId(null)}>
          <aside className="flex h-full w-[460px] flex-col bg-white shadow-[0_20px_48px_rgba(16,24,40,0.18)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 border-b border-line px-6 py-5">
              <div className="flex-1">
                <div className="text-xs text-muted">{[open.when, open.trigger, open.duration].filter(Boolean).join(' · ')}</div>
                <div className="mt-0.5 text-[17px] font-semibold text-ink">{open.automationName}</div>
                <div className="mt-2">
                  <OutcomePill outcome={open.outcome} />
                </div>
              </div>
              <button aria-label="Close" onClick={() => setOpenId(null)} className="rounded p-1 text-[#98A2B3] hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <p className="text-[14px] leading-relaxed text-ink">{open.narrative}</p>
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
              {open.log && open.log.length > 0 && (
                <div className="overflow-hidden rounded-[10px] border border-line">
                  <div className="border-b border-line bg-canvas px-4 py-2.5 text-xs font-semibold text-body">Log</div>
                  <LogList run={open} />
                </div>
              )}
              <div>
                <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.04em] text-muted">File produced</div>
                <FileLink run={open} />
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

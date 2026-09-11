import { FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { LogTone, RunRecord } from '../../domain/types';
import { OutcomePill } from '../../shell/ui';

const DOT: Record<LogTone, string> = {
  ok: 'bg-[#067647] ring-[#ECFDF3]',
  warn: 'bg-[#B54708] ring-[#FFFAEB]',
  err: 'bg-[#B42318] ring-[#FEF3F2]',
  info: 'bg-body ring-[#F2F4F7]',
};

const toneFor = (r: RunRecord): LogTone => (r.outcome === 'attention' ? 'warn' : r.outcome === 'failed' ? 'err' : r.outcome === 'clean' ? 'ok' : 'info');

/** A run's timestamped log. Older records without a log fall back to their one-paragraph story. */
export function LogList({ run }: { run: RunRecord }) {
  const lines = run.log?.length ? run.log : [{ t: '', text: run.narrative, tone: toneFor(run) }];
  return (
    <div className="py-1.5">
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,68px)_18px_minmax(0,1fr)] items-start gap-2.5 border-b border-[#F2F4F7] px-4 py-[11px] last:border-b-0">
          <div className="pt-px text-[11.5px] tabular-nums text-[#98A2B3]">{l.t}</div>
          <div className="flex w-[18px] justify-center pt-1">
            <span className={`block h-2 w-2 rounded-full ring-[3px] ${DOT[l.tone]}`} />
          </div>
          <div className={`text-[12.5px] leading-[1.6] ${l.tone === 'info' ? 'text-body' : 'text-ink'}`}>{l.text}</div>
        </div>
      ))}
    </div>
  );
}

export function FileLink({ run }: { run: RunRecord }) {
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

/** The Run logs tab: every run of this workflow on the left, the selected run's log on the right. */
export function RunLogs({ runs, onOpenStep }: { runs: RunRecord[]; onOpenStep: (stepId: string | null) => void }) {
  const [runId, setRunId] = useState<string | null>(runs[0]?.id ?? null);
  useEffect(() => {
    if (!runs.some((r) => r.id === runId)) setRunId(runs[0]?.id ?? null);
  }, [runs, runId]);
  const run = runs.find((r) => r.id === runId) ?? null;
  const meta = run ? [run.id, run.duration, run.stepsLine].filter(Boolean).join(' · ') : '';

  return (
    <div className="grid items-start gap-[18px] px-6 pb-10 pt-[22px] [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
      <div className="min-w-0 overflow-hidden rounded-[10px] border border-line bg-white">
        <div className="flex items-center justify-between gap-2.5 border-b border-line bg-canvas px-4 py-[13px]">
          <div className="text-xs font-semibold text-body">Runs</div>
          <div className="text-xs text-[#98A2B3]">{runs.length === 1 ? '1 run' : `${runs.length} runs`}</div>
        </div>
        {runs.length === 0 && <div className="px-4 py-[30px] text-center text-[12.5px] text-muted">No runs yet.</div>}
        {runs.map((r) => (
          <button
            key={r.id}
            onClick={() => setRunId(r.id)}
            className={`block w-full border-b border-[#F2F4F7] px-4 py-3.5 text-left last:border-b-0 hover:bg-canvas ${r.id === runId ? 'bg-[#F6FBFA] shadow-[inset_3px_0_0_0_#0E7C6B]' : ''}`}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="text-[13px] font-semibold text-ink">{r.when}</div>
              <OutcomePill outcome={r.outcome} />
            </div>
            <div className="mt-[5px] flex flex-wrap gap-3.5 text-xs text-muted">
              {[r.trigger, r.duration, r.stepsLine].filter(Boolean).map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <div className="min-w-0 overflow-hidden rounded-[10px] border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line bg-canvas px-4 py-[13px]">
          <div className="text-xs font-semibold text-body">{run ? run.when : 'No runs yet'}</div>
          <div className="text-xs text-[#98A2B3]">{meta}</div>
        </div>
        {!run ? (
          <div className="px-[18px] py-9 text-center text-[12.5px] leading-[1.6] text-muted">
            This workflow hasn't run yet. Try a dry run on the Steps tab — every run lands here with a timestamped log.
          </div>
        ) : (
          <>
            <p className="border-b border-[#F2F4F7] px-4 py-3 text-[12.5px] leading-[1.6] text-body">{run.narrative}</p>
            <LogList run={run} />
            {run.fileProduced && (
              <div className="border-t border-[#F2F4F7] px-4 py-3 text-[12.5px]">
                <FileLink run={run} />
              </div>
            )}
            {run.outcome === 'attention' && (
              <div className="mx-4 mb-4 mt-3 flex flex-wrap items-center gap-2.5 rounded-card border border-[#FEDF89] bg-[#FFFAEB] px-[13px] py-[11px]">
                <div className="flex-[1_1_200px] text-[12.5px] leading-[1.55] text-[#7A4A08]">This run is still waiting on you.</div>
                <button onClick={() => onOpenStep(run.stepId ?? null)} className="rounded-card bg-teal px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-teal-dark">
                  Open the step
                </button>
              </div>
            )}
            {run.outcome === 'failed' && (
              <div className="mx-4 mb-4 mt-3 rounded-card border border-[#FECDCA] bg-[#FEF3F2] px-[13px] py-[11px] text-[12.5px] leading-[1.55] text-[#912018]">
                Nothing was written. Run it again when PracticeSuite is back.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

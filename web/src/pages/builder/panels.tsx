import { AlertTriangle, CheckCircle2, Circle, Crosshair, FlaskConical, MousePointerClick, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { pct, type Match } from '../../domain/binder';
import { money } from '../../domain/houseRules';
import { Button, Modal } from '../../shell/ui';
import type { Approval, StopInfo } from './useRunner';

export function InspectBar({
  match,
  picking,
  onPointAt,
  onCancelPick,
}: {
  match: Match<HTMLElement> | null | undefined;
  picking: boolean;
  onPointAt: () => void;
  onCancelPick: () => void;
}) {
  if (picking) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-teal bg-mint px-4 py-3 text-sm text-ink">
        <Crosshair size={18} className="text-teal" />
        <span className="flex-1">Click the right thing on the screen. I will remember it.</span>
        <Button size="sm" variant="ghost" onClick={onCancelPick}>
          Cancel
        </Button>
      </div>
    );
  }
  if (match === undefined) return null;
  if (match && match.s >= 0.75) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-line bg-white px-4 py-3 text-sm">
        <CheckCircle2 size={18} className="shrink-0 text-teal" />
        <span className="flex-1 text-ink">
          This step points at <b>{match.label}</b>. {pct(match.s)}% sure.
        </span>
        <Button size="sm" variant="ghost" onClick={onPointAt}>
          Point at something else
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-card border border-red/30 bg-red-bg px-4 py-3 text-sm">
      <AlertTriangle size={18} className="shrink-0 text-red" />
      <span className="flex-1 text-ink">
        {match ? (
          <>
            I'm only {pct(match.s)}% sure. That's not enough to act on. The closest thing is <b>{match.label}</b>.
          </>
        ) : (
          <>I can't find this on the screen.</>
        )}
      </span>
      <Button size="sm" variant="primary" onClick={onPointAt}>
        <Crosshair size={14} /> Point at it
      </Button>
    </div>
  );
}

export function RecordBar({
  prompt,
  onStop,
  onPrompt,
  onCancelPrompt,
}: {
  prompt: string | null;
  onStop: () => void;
  onPrompt: (value: string) => void;
  onCancelPrompt: () => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="rounded-card border border-red/30 bg-white px-4 py-2.5">
      <div className="flex items-center gap-3 text-sm">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red/40" />
          <Circle size={12} className="relative fill-red text-red" />
        </span>
        <span className="flex-1 text-ink">
          <b>Recording.</b> Click things on the screen the way you normally would.
        </span>
        <Button size="sm" onClick={onStop}>
          Stop recording
        </Button>
      </div>
      {prompt && (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) {
              onPrompt(value.trim());
              setValue('');
            }
          }}
        >
          <MousePointerClick size={16} className="text-teal" />
          <span className="text-sm text-ink">What should I type into {prompt}?</span>
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="min-w-0 flex-1 rounded-input border border-line px-2 py-1 text-sm focus:border-teal focus:outline-none" />
          <Button size="sm" variant="primary" type="submit">
            Add
          </Button>
          <Button size="sm" variant="ghost" type="button" onClick={onCancelPrompt}>
            Skip
          </Button>
        </form>
      )}
    </div>
  );
}

export function AttentionPanel({ stop, onYes, onPoint, onNotNow }: { stop: StopInfo; onYes: () => void; onPoint: () => void; onNotNow: () => void }) {
  return (
    <div className="animate-card-in rounded-card border border-red/30 bg-white shadow-lift">
      <div className="flex items-center gap-2 border-b border-line bg-red-bg px-4 py-2.5">
        <AlertTriangle size={16} className="text-red" />
        <span className="text-sm font-semibold text-red">Needs attention · step {stop.index + 1}</span>
        <span className="ml-auto text-xs text-body">I stopped on purpose. Nothing was read and nothing was saved.</span>
      </div>
      <div className="grid gap-4 px-4 py-3 md:grid-cols-[auto_1fr]">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">This step expected</div>
          <span className="inline-block rounded-full bg-canvas px-2.5 py-1 text-[13px] font-medium text-ink ring-1 ring-line">{stop.want}</span>
          <div className="mt-2 text-xs text-muted">{stop.best ? `${pct(stop.best.s)}% sure of the closest match` : 'No close match'}</div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">On the screen now</div>
          <div className="flex flex-wrap gap-1.5">
            {stop.labels.map((l) => {
              const closest = l === stop.best?.label;
              return (
                <span key={l} className={`rounded-full px-2.5 py-1 text-[13px] ${closest ? 'bg-red-bg font-semibold text-red ring-1 ring-red/40' : 'bg-white text-body ring-1 ring-line'}`}>
                  {l}
                  {closest && <span className="ml-1 text-[10px] uppercase">closest</span>}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        <p className="mr-auto text-[15px] font-medium text-ink">{stop.question}</p>
        {stop.best && (
          <Button variant="primary" size="sm" onClick={onYes}>
            Yes, that's it
          </Button>
        )}
        <Button size="sm" onClick={onPoint}>
          <Crosshair size={14} /> Point at it
        </Button>
        <Button size="sm" variant="ghost" onClick={onNotNow}>
          Not now
        </Button>
      </div>
    </div>
  );
}

export function ResultPanel({ tone, title, sentence, note, onClose, action }: { tone: 'dry' | 'done'; title: string; sentence: string; note: string; onClose: () => void; action?: React.ReactNode }) {
  return (
    <div className="animate-card-in rounded-card border border-line bg-white px-4 py-3 shadow-lift">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${tone === 'dry' ? 'bg-canvas text-body ring-1 ring-line' : 'bg-mint text-teal'}`}>
          {tone === 'dry' ? <FlaskConical size={16} /> : <ShieldCheck size={16} />}
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
          <p className="mt-0.5 text-[15px] leading-snug text-ink">{sentence}</p>
          <p className="mt-1 text-xs text-muted">{note}</p>
        </div>
        <div className="flex gap-2">
          {action}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ApprovalModal({ approval, onApprove, onDecline }: { approval: Approval; onApprove: () => void; onDecline: () => void }) {
  const rows: [string, number][] = [
    ['Rows I looked at', approval.read],
    ['Not in scope', approval.outOfScope],
    ['Skipped by house rule', approval.skipped],
    ['Held for you to look at', approval.held.length],
  ];
  return (
    <Modal open onClose={onDecline} title="Before anything leaves" subtitle="Here is what I would do. Nothing has left the browser yet." width={600} hints={[['Esc', 'Not yet']]}>
      <div className="rounded-card border border-line">
        {rows.map(([l, n]) => (
          <div key={l} className="flex justify-between border-b border-line px-4 py-2 text-sm">
            <span className="text-body">{l}</span>
            <span className="font-medium tabular-nums text-ink">{n}</span>
          </div>
        ))}
        <div className="flex justify-between bg-canvas px-4 py-2.5 text-sm">
          <span className="font-semibold text-ink">Rows in the file</span>
          <span className="font-semibold tabular-nums text-ink">
            {approval.kept} · {money(approval.total)}
          </span>
        </div>
      </div>

      {approval.held.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Waiting for you</div>
          <table className="w-full overflow-hidden rounded-card text-sm ring-1 ring-line">
            <tbody>
              {approval.held.map((h) => (
                <tr key={h.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-ink">{h.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{h.amount}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="rounded-full bg-amber-bg px-2 py-0.5 text-xs font-medium text-amber">{h.why}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-muted">These stay out of the file until you look at them yourself.</p>
        </div>
      )}

      <div className="mt-4 rounded-card border border-amber/30 bg-amber-bg px-4 py-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber">What happens after you approve</div>
        <ul className="space-y-0.5 text-sm text-ink">
          {approval.edges.map((e, i) => (
            <li key={i}>· {e}</li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] leading-relaxed text-body">
          This file contains patient information. Once it is {approval.uploads ? 'uploaded' : 'saved'} it exists outside PracticeSuite. Nothing is written back into the system either way.
        </p>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onDecline}>Not yet</Button>
        <Button variant="primary" onClick={onApprove}>
          {approval.label}
        </Button>
      </div>
    </Modal>
  );
}

import { KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ACTIONS } from '../../domain/actions';
import { pct, THRESHOLD, type Match } from '../../domain/binder';
import { money } from '../../domain/houseRules';
import type { SignIn, Step } from '../../domain/types';
import { Button, Modal } from '../../shell/ui';
import type { Approval, Phase, RunMode, StopInfo } from './useRunner';

const PRIMARY = 'rounded-card bg-teal px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-teal-dark disabled:opacity-50';
const SECONDARY = 'rounded-card border border-line bg-white px-3.5 py-2 text-[12.5px] text-[#344054] hover:bg-canvas disabled:opacity-50';

export function RunBar(p: {
  phase: Phase;
  mode: RunMode;
  total: number;
  done: number;
  current: Step | null;
  stop: StopInfo | null;
  result: { sentence: string } | null;
  picking: boolean;
  onStop: () => void;
  onYes: () => void;
  onPoint: () => void;
  onNotNow: () => void;
  onClose: () => void;
  onLogs: () => void;
}) {
  if (p.phase === 'idle') return null;
  const blocked = p.phase === 'attention';
  const finished = p.phase === 'done';
  const dryDone = p.phase === 'dryDone';
  const tone = blocked ? 'border-[#FEDF89] bg-[#FFFAEB]' : finished ? 'border-[#ABEFC6] bg-[#ECFDF3]' : 'border-line bg-white';
  const done = finished || dryDone ? p.total : p.done;

  let msg: string;
  if (blocked && p.stop) msg = `Stopped at step ${p.stop.index + 1} — not sure enough about “${p.stop.want}”.`;
  else if (p.phase === 'approval') msg = 'Waiting for you to approve before anything leaves the browser.';
  else if ((finished || dryDone) && p.result) msg = p.result.sentence;
  else msg = `${p.mode === 'dry' ? 'Dry run · ' : ''}Running step ${Math.min(p.done + 1, p.total)} of ${p.total}${p.current ? ` — ${p.current.sentence}` : ''}`;

  return (
    <div className={`flex animate-card-in flex-wrap items-center gap-3.5 rounded-[10px] border px-[15px] py-[13px] ${tone}`}>
      <div className="min-w-0 flex-[1_1_260px]">
        <div className={`text-[12.5px] font-semibold leading-normal ${blocked ? 'text-[#7A4A08]' : finished ? 'text-[#067647]' : 'text-ink'}`}>{msg}</div>
        {blocked && p.stop && (
          <div className="mt-1 text-[12.5px] leading-normal text-[#7A4A08]">
            {p.picking ? 'Click the right thing in the page below.' : p.stop.question} Nothing was read and nothing was saved.
          </div>
        )}
        {dryDone && <div className="mt-1 text-xs text-muted">Preview only. Nothing downloaded and nothing left the browser.</div>}
        <div className="mt-[9px] h-[5px] overflow-hidden rounded-full bg-[#F2F4F7]">
          <div
            className={`h-full rounded-full transition-[width] duration-[400ms] ${blocked ? 'bg-[#DC9A15]' : 'bg-teal'}`}
            style={{ width: `${p.total ? (done / p.total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {blocked && !p.picking && p.stop?.best && (
          <button className={PRIMARY} onClick={p.onYes}>
            Yes, that's it
          </button>
        )}
        {blocked && !p.picking && (
          <button className={p.stop?.best ? SECONDARY : PRIMARY} onClick={p.onPoint}>
            Point at it
          </button>
        )}
        {blocked && !p.picking && (
          <button className={SECONDARY} onClick={p.onNotNow}>
            Not now
          </button>
        )}
        {(p.phase === 'running' || p.phase === 'approval') && (
          <button className={SECONDARY} onClick={p.onStop}>
            Stop
          </button>
        )}
        {finished && (
          <button className={SECONDARY} onClick={p.onLogs}>
            Run logs
          </button>
        )}
        {(finished || dryDone) && (
          <button className={SECONDARY} onClick={p.onClose}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}

export function RecordStrip({ prompt, onDone, onPrompt, onCancelPrompt }: { prompt: string | null; onDone: () => void; onPrompt: (v: string) => void; onCancelPrompt: () => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="animate-card-in rounded-[10px] border border-[#ABEFC6] bg-[#F6FBFA] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="block h-[7px] w-[7px] animate-pulse rounded-full bg-[#D92D20]" />
        <div className="flex-[1_1_220px] text-[12.5px] leading-normal text-[#35544E]">
          Recording — click the controls or a column heading below and each click lands in the flow as a step.
        </div>
        <button className={PRIMARY} onClick={onDone}>
          Done recording
        </button>
      </div>
      {prompt && (
        <form
          className="mt-2.5 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) {
              onPrompt(value.trim());
              setValue('');
            }
          }}
        >
          <span className="text-[12.5px] text-ink">What should I type into {prompt}?</span>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="min-w-0 flex-1 rounded-card border border-line px-3 py-1.5 text-[13px] focus:border-teal focus:outline-none"
          />
          <button type="submit" className={PRIMARY}>
            Add
          </button>
          <button type="button" className={SECONDARY} onClick={onCancelPrompt}>
            Skip
          </button>
        </form>
      )}
    </div>
  );
}

/** The panel under the browser: what the selected step points at, how sure, and how to fix it. */
export function AdjustPanel({
  step,
  match,
  picking,
  saved,
  locked,
  signIns,
  onPointAt,
  onCancelPick,
  onReword,
  onValue,
}: {
  step: Step | null;
  match: Match<HTMLElement> | null | undefined;
  picking: boolean;
  saved: boolean;
  locked: boolean;
  signIns: SignIn[];
  onPointAt: () => void;
  onCancelPick: () => void;
  onReword: (text: string) => void;
  onValue: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [value, setValue] = useState('');
  useEffect(() => {
    setEditing(false);
    setValue('');
  }, [step?.id]);

  const card = 'rounded-[10px] border border-line bg-white p-[18px]';

  if (!step) {
    return (
      <div className="rounded-[10px] border border-dashed border-line bg-white p-[18px] text-[12.5px] leading-[1.6] text-muted">
        Click a step to jump the browser to that moment. If the step points at something on the page, I'll draw a box around it and tell you how sure I am.
      </div>
    );
  }

  if (picking) {
    return (
      <div className={card}>
        <div className="text-[13.5px] font-semibold text-ink">Click the thing you mean.</div>
        <div className="mt-2 text-[12.5px] leading-[1.6] text-muted">Everything outlines as you move over it. One click is enough — I'll rewrite the sentence.</div>
        <div className="mt-3.5 flex gap-2">
          <button className={SECONDARY} onClick={onCancelPick}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const def = ACTIONS[step.verb];
  const onScreen = def.resolves === 'screen';
  const isSignIn = step.verb === 'signin';

  const sentence = editing ? (
    <textarea
      autoFocus
      rows={2}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      className="w-full resize-none rounded-card border border-teal px-3 py-2 text-[13.5px] font-semibold text-ink focus:outline-none"
    />
  ) : (
    <div className="text-[13.5px] font-semibold leading-normal text-ink">{step.sentence || 'This step does not point at anything yet.'}</div>
  );

  const actions = (primaryPoint: boolean) => (
    <div className="mt-3.5 flex flex-wrap gap-2">
      {onScreen && !editing && !isSignIn && (
        <button disabled={locked} className={primaryPoint ? PRIMARY : SECONDARY} onClick={onPointAt}>
          Point at it
        </button>
      )}
      {!editing && step.sentence && !isSignIn && (
        <button
          disabled={locked}
          className={SECONDARY}
          onClick={() => {
            setDraft(step.sentence);
            setEditing(true);
          }}
        >
          Reword this step
        </button>
      )}
      {editing && (
        <>
          <button
            className={PRIMARY}
            onClick={() => {
              onReword(draft);
              setEditing(false);
            }}
          >
            Save wording
          </button>
          <button className={SECONDARY} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </>
      )}
    </div>
  );

  const signInPicker = isSignIn ? (
    <div className="mt-3">
      {signIns.length ? (
        <select
          aria-label="Which sign-in"
          value={step.value ?? ''}
          disabled={locked}
          onChange={(e) => onValue(e.target.value)}
          className="w-full rounded-card border border-line bg-white px-3 py-2 text-[13px] text-ink focus:border-teal focus:outline-none"
        >
          <option value="" disabled>
            Pick a sign-in
          </option>
          {signIns.map((s) => (
            <option key={s.id} value={s.label}>
              {s.label} ({s.user})
            </option>
          ))}
        </select>
      ) : (
        <div className="text-[12.5px] text-[#7A4A08]">There are no saved sign-ins yet. Add one under Sign-ins.</div>
      )}
      <div className="mt-2 flex items-start gap-2 text-[12px] leading-relaxed text-muted">
        <KeyRound size={13} className="mt-0.5 shrink-0 text-teal" />
        The workflow keeps the sign-in's name only. The password stays in the runner's own environment file.
      </div>
    </div>
  ) : null;

  const valueForm =
    !isSignIn && def.needsValue && !step.value && !locked ? (
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onValue(value.trim());
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={def.valueHint}
          className="min-w-0 flex-1 rounded-card border border-line px-3 py-2 text-[13px] focus:border-teal focus:outline-none"
        />
        <button type="submit" className={PRIMARY}>
          Add
        </button>
      </form>
    ) : null;

  const savedChip = saved ? (
    <div className="mt-3 inline-flex animate-card-in items-center gap-[7px] rounded-full border border-[#ABEFC6] bg-[#ECFDF3] px-3 py-[5px] text-xs font-semibold text-[#067647]">✓ Saved</div>
  ) : null;

  if (!onScreen) {
    return (
      <div className={card}>
        {sentence}
        <div className="mt-2 text-[12.5px] leading-[1.6] text-muted">
          This step doesn't point at anything on the page — it happens to the page or to the file, so there's nothing to draw a box around.
        </div>
        {savedChip}
        {valueForm}
        {actions(false)}
      </div>
    );
  }

  if (!step.bind) {
    return (
      <div className={card}>
        {sentence}
        <div className="mt-2 text-[12.5px] leading-[1.6] text-muted">Click “Point at it”, then click the right thing in the page above.</div>
        {actions(true)}
      </div>
    );
  }

  if (match === undefined) {
    return (
      <div className={card}>
        {sentence}
        <div className="mt-2 text-[12.5px] text-muted">Checking the page…</div>
        {savedChip}
        {signInPicker}
        {valueForm}
        {actions(false)}
      </div>
    );
  }

  if (!match) {
    return (
      <div className={card}>
        {sentence}
        <div className="mt-2 text-[12.5px] leading-[1.6] text-[#7A4A08]">I can't find {step.bind} on this page, so this step would stop the run and ask you.</div>
        {signInPicker}
        {actions(true)}
      </div>
    );
  }

  const good = match.s >= THRESHOLD;
  return (
    <div className={card}>
      {sentence}
      <div className="mb-2 mt-3.5 h-1.5 overflow-hidden rounded-full bg-[#F2F4F7]">
        <div className={`h-full rounded-full transition-[width] duration-300 ${good ? 'bg-teal' : 'bg-[#DC9A15]'}`} style={{ width: `${pct(match.s)}%` }} />
      </div>
      <div className={`text-[12.5px] leading-[1.6] ${good ? 'text-[#35544E]' : 'text-[#7A4A08]'}`}>
        {good
          ? `This step points at ${match.label}. ${pct(match.s)}% sure — the name and the kind of thing both match.`
          : `I'm only ${pct(match.s)}% sure that's ${match.label}. That's not enough to act on, so this step would stop the run and ask you.`}
      </div>
      {savedChip}
      {signInPicker}
      {valueForm}
      {actions(!good)}
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
          <div key={l} className="flex justify-between border-b border-line px-4 py-2 text-[13px]">
            <span className="text-body">{l}</span>
            <span className="font-medium tabular-nums text-ink">{n}</span>
          </div>
        ))}
        <div className="flex justify-between bg-canvas px-4 py-2.5 text-[13px]">
          <span className="font-semibold text-ink">Rows in the file</span>
          <span className="font-semibold tabular-nums text-ink">
            {approval.kept} · {money(approval.total)}
          </span>
        </div>
      </div>

      {approval.held.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.04em] text-muted">Waiting for you</div>
          <table className="w-full overflow-hidden rounded-card text-[13px] ring-1 ring-line">
            <tbody>
              {approval.held.map((h) => (
                <tr key={h.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-ink">{h.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{h.amount}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="rounded-full border border-[#FEDF89] bg-[#FFFAEB] px-2 py-0.5 text-[11.5px] font-semibold text-[#B54708]">{h.why}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-muted">These stay out of the file until you look at them yourself.</p>
        </div>
      )}

      <div className="mt-4 rounded-card border border-[#FEDF89] bg-[#FFFAEB] px-4 py-3">
        <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#B54708]">What happens after you approve</div>
        <ul className="space-y-0.5 text-[13px] text-ink">
          {approval.edges.map((e, i) => (
            <li key={i}>· {e}</li>
          ))}
        </ul>
        <p className="mt-2 text-[12.5px] leading-relaxed text-body">
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

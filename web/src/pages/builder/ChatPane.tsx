import { useEffect, useRef, useState } from 'react';
import { parser, type PendingQuestion } from '../../domain/parser';
import { HOLD_QUESTION } from '../../domain/parser/keywordParser';
import type { Step } from '../../domain/types';

interface Msg {
  id: number;
  who: 'me' | 'ai';
  text: string;
}

const PROMPTS = [
  { label: 'Every Friday I pull balances over 30 days', text: 'open the balances screen, pull anyone over 30 days, skip payer 99999, export it to the billing share' },
  { label: 'Leave out payment plans', text: 'actually leave out anyone on a payment plan' },
  { label: 'Send them to the print vendor', text: 'download the export and upload it to the print vendor. show me first' },
];

const ME = 'max-w-[88%] self-end rounded-[12px_12px_4px_12px] bg-mint px-[13px] py-[11px] text-[13px] leading-[1.55] text-[#14312C]';
const AI = 'max-w-[92%] rounded-[12px_12px_12px_4px] border border-[#F2F4F7] bg-canvas px-[13px] py-[11px] text-[13px] leading-[1.6] text-[#344054]';

/** The assistant column. Every message changes the flow; replies are short plain sentences. */
export function ChatPane({ steps, onSteps, disabled }: { steps: Step[]; onSteps: (next: Step[], added: string[]) => void; disabled?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingQuestion | null>(null);
  const [thinking, setThinking] = useState(false);
  const idRef = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, thinking]);

  const push = (who: Msg['who'], text: string) => setMsgs((m) => [...m, { id: idRef.current++, who, text }]);

  const send = (raw: string) => {
    const t = raw.trim();
    if (!t || thinking || disabled) return;
    push('me', t);
    setDraft('');
    setThinking(true);
    setTimeout(() => {
      const before = stepsRef.current;
      const res = parser.parse(t, before, { pending });
      if (res.steps !== before) {
        const old = new Set(before.map((s) => s.id));
        onSteps(res.steps, res.steps.filter((s) => !old.has(s.id)).map((s) => s.id));
      }
      push('ai', res.reply);
      setThinking(false);
      if (res.question === 'hold-5000') {
        setTimeout(() => push('ai', HOLD_QUESTION), 700);
        setPending('hold-5000');
      } else {
        setPending(null);
      }
    }, 900);
  };

  const chips = pending === 'hold-5000' ? [{ label: 'Yes, hold them', text: 'Yes, hold them' }, { label: 'No', text: 'No' }] : PROMPTS;

  return (
    <>
      <div className="border-b border-line px-[18px] py-[13px] text-xs font-semibold text-body">Assistant</div>
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-auto p-[18px]">
        {msgs.length === 0 && <div className={AI}>Tell me what you do, the way you would explain it to someone new. Every message changes the flow.</div>}
        {msgs.map((m) => (
          <div key={m.id} className={m.who === 'me' ? ME : AI}>
            {m.text}
          </div>
        ))}
        {thinking && <div className={`${AI} w-fit animate-pulse text-muted`}>Writing the steps…</div>}
      </div>
      <div className="border-t border-line px-[18px] py-3.5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <input
            value={draft}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={disabled ? 'Wait for the run to finish…' : 'Describe what you do'}
            className="min-w-0 flex-1 rounded-card border border-line px-3 py-2.5 text-[13px] text-ink placeholder:text-[#98A2B3] focus:border-teal focus:outline-none"
          />
          <button type="submit" disabled={disabled || !draft.trim()} className="rounded-card bg-teal px-3.5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
            Send
          </button>
        </form>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.label}
              disabled={disabled}
              onClick={() => send(c.text)}
              className="rounded-full border border-line bg-white px-[11px] py-[5px] text-left text-[11.5px] text-body hover:border-teal hover:text-teal disabled:opacity-50"
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

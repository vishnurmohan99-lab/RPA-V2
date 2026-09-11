import { ArrowUp, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parser, type PendingQuestion } from '../../domain/parser';
import { HOLD_QUESTION } from '../../domain/parser/keywordParser';
import type { Step } from '../../domain/types';

interface Msg {
  id: number;
  from: 'you' | 'bot';
  text: string;
}

const SUGGESTIONS = [
  'open the balances screen, pull anyone over 30 days, skip payer 99999, export it to the billing share',
  'actually leave out anyone on a payment plan',
];

const GREETING: Record<string, string> = {
  describe: 'Tell me what you do, the way you would explain it to someone new. I will write the steps.',
  record: 'Click things on the screen the way you normally would. I will write each one down as a step.',
  scratch: 'Add steps with the button in the middle, or tell me here and I will add them for you.',
};

export function ChatPane({
  steps,
  onSteps,
  start = 'describe',
  disabled,
}: {
  steps: Step[];
  onSteps: (steps: Step[], added: string[]) => void;
  start?: string;
  disabled?: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: 'bot', text: GREETING[start] ?? GREETING.describe }]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<PendingQuestion | null>(null);
  const [thinking, setThinking] = useState(false);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [msgs, thinking]);

  const push = (from: Msg['from'], t: string) => setMsgs((m) => [...m, { id: idRef.current++, from, text: t }]);

  const send = (raw: string) => {
    const t = raw.trim();
    if (!t || thinking) return;
    push('you', t);
    setText('');
    setThinking(true);
    setTimeout(() => {
      const before = stepsRef.current;
      const res = parser.parse(t, before, { pending });
      if (res.steps !== before) {
        const old = new Set(before.map((s) => s.id));
        onSteps(res.steps, res.steps.filter((s) => !old.has(s.id)).map((s) => s.id));
      }
      push('bot', res.reply);
      setThinking(false);
      if (res.question === 'hold-5000') {
        setTimeout(() => push('bot', HOLD_QUESTION), 700 + res.steps.length * 120);
        setPending('hold-5000');
      } else {
        setPending(null);
      }
    }, 450);
  };

  return (
    <section className="flex min-h-0 flex-col rounded-card border border-line bg-white">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-mint text-teal">
          <Sparkles size={15} />
        </div>
        <div>
          <div className="text-sm font-semibold text-ink">Assistant</div>
          <div className="text-xs text-muted">Every message changes the steps</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.from === 'you' ? 'justify-end' : ''}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                m.from === 'you' ? 'rounded-br-sm bg-teal text-white' : 'rounded-bl-sm bg-canvas text-ink ring-1 ring-line'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex gap-1 px-2 py-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {pending === 'hold-5000' && (
        <div className="flex gap-2 px-4 pb-2">
          {['Yes, hold them', 'No'].map((a) => (
            <button key={a} onClick={() => send(a)} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink hover:bg-canvas">
              {a}
            </button>
          ))}
        </div>
      )}

      {steps.length < 2 && !pending && (
        <div className="space-y-1.5 px-4 pb-2">
          <div className="text-[11px] font-medium text-muted">Try saying</div>
          <button onClick={() => send(SUGGESTIONS[0])} className="block w-full rounded-card border border-dashed border-line px-3 py-2 text-left text-xs text-body hover:border-teal hover:bg-mint/40">
            “{SUGGESTIONS[0]}”
          </button>
        </div>
      )}

      <form
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <textarea
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          rows={2}
          placeholder={disabled ? 'Wait for the run to finish…' : 'Tell me what to change…'}
          className="min-h-[44px] flex-1 resize-none rounded-input border border-line px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:border-teal focus:outline-none"
        />
        <button type="submit" aria-label="Send" disabled={!text.trim() || disabled} className="flex h-9 w-9 items-center justify-center rounded-full bg-teal text-white disabled:opacity-40">
          <ArrowUp size={16} />
        </button>
      </form>
    </section>
  );
}

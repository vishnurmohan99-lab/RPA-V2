import { AlertTriangle, Check, Eye, GripVertical, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ACTIONS, GROUPS, reword } from '../../domain/actions';
import { pct } from '../../domain/binder';
import { parser } from '../../domain/parser';
import { mustOpenFirst } from '../../domain/runner';
import type { Step } from '../../domain/types';
import type { StepState } from './useRunner';

const EDGE: Record<string, string> = { screen: 'border-l-teal', page: 'border-l-[#98A2B3]', edge: 'border-l-amber' };

interface Props {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onShowMe: (id: string) => void;
  onAdd: (verb: string) => void;
  states: Record<string, StepState>;
  activeId: string | null;
  fresh: Set<string>;
  failing: Set<string>;
  locked: boolean;
  onToast: (t: string) => void;
  pickerOpen?: boolean;
}

export function StepList(p: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [picker, setPicker] = useState(!!p.pickerOpen);

  const from = dragId ? p.steps.findIndex((s) => s.id === dragId) : -1;
  const noop = dropAt === null || dropAt === from || dropAt === from + 1;

  const preview = (() => {
    if (from < 0 || dropAt === null || noop) return p.steps;
    const rest = p.steps.filter((s) => s.id !== dragId);
    const at = dropAt > from ? dropAt - 1 : dropAt;
    return [...rest.slice(0, at), p.steps[from], ...rest.slice(at)];
  })();
  const invalid = dragId && !noop ? mustOpenFirst(preview) : null;
  const numberOf = (id: string) => preview.findIndex((s) => s.id === id) + 1;

  const onDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, {
      position: 'fixed',
      top: '-1000px',
      left: '-1000px',
      width: `${rect.width}px`,
      transform: 'rotate(2.5deg)',
      boxShadow: '0 16px 32px rgba(16,24,40,0.18)',
      opacity: '0.92',
      background: '#fff',
    });
    document.body.appendChild(ghost);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
    setTimeout(() => {
      ghost.remove();
      setDragId(id);
    }, 0);
  };

  const onDragOverCard = (e: DragEvent<HTMLDivElement>, index: number) => {
    if (!dragId) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    setDropAt(e.clientY < r.top + r.height / 2 ? index : index + 1);
  };

  const end = () => {
    setDragId(null);
    setDropAt(null);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (!dragId || noop) return end();
    if (invalid) {
      p.onToast('Kept the old order');
      return end();
    }
    p.onChange(preview);
    p.onToast('Step order updated');
    end();
  };

  const DropLine = () => (
    <div className="py-0.5">
      <div className={`h-1 rounded-full ${invalid ? 'bg-amber' : 'bg-teal'}`} />
      {invalid && (
        <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber">
          <AlertTriangle size={13} />
          {invalid}
        </div>
      )}
    </div>
  );

  return (
    <div onDragOver={(e) => dragId && e.preventDefault()} onDrop={onDrop}>
      <div className={`flex flex-col transition-all ${dragId ? 'gap-3.5' : 'gap-2.5'}`}>
        {p.steps.map((step, i) => (
          <div key={step.id}>
            {dragId && !noop && dropAt === i && <DropLine />}
            <StepCard
              step={step}
              number={numberOf(step.id)}
              index={i}
              selected={p.selectedId === step.id}
              state={p.states[step.id]}
              active={p.activeId === step.id}
              fresh={p.fresh.has(step.id) ? [...p.fresh].indexOf(step.id) : -1}
              failing={p.failing.has(step.id)}
              dragging={dragId === step.id}
              locked={p.locked}
              onDragStart={(e) => onDragStart(e, step.id)}
              onDragOver={(e) => onDragOverCard(e, i)}
              onDragEnd={end}
              onSelect={() => p.onSelect(step.id)}
              onShowMe={() => p.onShowMe(step.id)}
              onRemove={() => p.onChange(p.steps.filter((s) => s.id !== step.id))}
              onUpdate={(next) => p.onChange(p.steps.map((s) => (s.id === step.id ? next : s)))}
            />
          </div>
        ))}
        {dragId && !noop && dropAt === p.steps.length && <DropLine />}
      </div>

      <div className="relative mt-3">
        <button
          disabled={p.locked}
          onClick={() => setPicker((o) => !o)}
          className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-line bg-white py-3 text-sm font-medium text-body hover:border-teal hover:text-teal disabled:opacity-50"
        >
          <Plus size={16} />
          Add a step
        </button>
        {picker && !p.locked && (
          <ActionPicker
            onPick={(verb) => {
              setPicker(false);
              p.onAdd(verb);
            }}
            onClose={() => setPicker(false)}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <Legend cls="bg-teal" label="On the screen" />
        <Legend cls="bg-[#98A2B3]" label="The page" />
        <Legend cls="bg-amber" label="Leaves the browser" />
      </div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-1 rounded-full ${cls}`} />
      {label}
    </span>
  );
}

function ActionPicker({ onPick, onClose }: { onPick: (verb: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => document.addEventListener('mousedown', away), 0);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-[420px] overflow-y-auto rounded-modal border border-line bg-white p-2 shadow-drag">
      {GROUPS.map((g) => (
        <div key={g.resolves} className="mb-1">
          <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.title}</div>
          {Object.entries(ACTIONS)
            .filter(([, d]) => d.resolves === g.resolves)
            .map(([verb, d]) => (
              <button key={verb} onClick={() => onPick(verb)} className={`flex w-full items-center gap-2 rounded-md border-l-4 px-2 py-1.5 text-left text-[13px] text-ink hover:bg-canvas ${EDGE[d.resolves]}`}>
                {d.label}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}

interface CardProps {
  step: Step;
  number: number;
  index: number;
  selected: boolean;
  state?: StepState;
  active: boolean;
  fresh: number;
  failing: boolean;
  dragging: boolean;
  locked: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onSelect: () => void;
  onShowMe: () => void;
  onRemove: () => void;
  onUpdate: (s: Step) => void;
}

function StepCard(c: CardProps) {
  const def = ACTIONS[c.step.verb];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.step.sentence);
  const [valueDraft, setValueDraft] = useState('');
  const onScreen = def.resolves === 'screen';
  const needsTarget = onScreen && !c.step.bind;
  const needsValue = def.needsValue && !c.step.value;

  const commit = () => {
    setEditing(false);
    const t = draft.trim();
    if (!t || t === c.step.sentence) return;
    const guess = parser.parse(t, []).steps.filter((s) => s.verb === c.step.verb);
    c.onUpdate(guess.length === 1 ? reword({ ...c.step, bind: guess[0].bind ?? c.step.bind, value: guess[0].value ?? c.step.value }) : { ...c.step, sentence: t });
  };

  const ring =
    c.state === 'attention'
      ? 'ring-2 ring-red'
      : c.active
        ? 'ring-2 ring-teal shadow-lift'
        : c.selected
          ? 'ring-2 ring-teal/40'
          : '';

  return (
    <div
      draggable={!c.locked && !editing}
      onDragStart={c.onDragStart}
      onDragOver={c.onDragOver}
      onDragEnd={c.onDragEnd}
      onClick={c.onSelect}
      className={`group relative flex cursor-pointer gap-2 rounded-card border border-line border-l-4 bg-white py-3 pl-2 pr-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lift ${EDGE[def.resolves]} ${ring} ${
        c.dragging ? 'border-dashed opacity-40' : ''
      } ${c.state === 'previewed' ? 'opacity-60' : ''} ${c.fresh >= 0 ? 'animate-card-in' : ''}`}
      style={c.fresh >= 0 ? { animationDelay: `${c.fresh * 140}ms` } : undefined}
    >
      <span className={`mt-0.5 shrink-0 text-[#D0D5DD] group-hover:text-muted ${c.locked ? '' : 'cursor-grab active:cursor-grabbing'}`} aria-label="Drag to reorder">
        <GripVertical size={18} />
      </span>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          c.state === 'done' ? 'bg-teal text-white' : c.state === 'attention' ? 'bg-red text-white' : c.active ? 'bg-teal text-white' : 'bg-canvas text-body ring-1 ring-line'
        }`}
      >
        {c.state === 'done' ? <Check size={12} /> : c.number}
      </span>

      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea
            autoFocus
            value={draft}
            rows={2}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') {
                setDraft(c.step.sentence);
                setEditing(false);
              }
            }}
            className="w-full resize-none rounded-input border border-teal px-2 py-1 text-[14px] text-ink focus:outline-none"
          />
        ) : (
          <p
            onClick={() => {
              if (c.locked || needsTarget) return;
              setDraft(c.step.sentence);
              setEditing(true);
            }}
            className={`text-[14px] leading-snug ${needsTarget ? 'italic text-muted' : 'text-ink'}`}
          >
            {needsTarget ? 'Point at the thing on the screen →' : c.step.sentence}
          </p>
        )}

        {needsValue && !needsTarget && (
          <form
            className="mt-2 flex gap-1.5"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              if (valueDraft.trim()) c.onUpdate(reword({ ...c.step, value: valueDraft.trim() }));
            }}
          >
            <input autoFocus value={valueDraft} onChange={(e) => setValueDraft(e.target.value)} placeholder={def.valueHint} className="min-w-0 flex-1 rounded-input border border-line px-2 py-1 text-[13px] focus:border-teal focus:outline-none" />
            <button className="rounded-input bg-teal px-2.5 text-xs font-semibold text-white">Add</button>
          </form>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">{def.label}</span>
          {c.state === 'attention' && <span className="text-[11px] font-semibold text-red">Needs attention</span>}
          {c.state === 'previewed' && <span className="text-[11px] text-muted">Preview only</span>}
          {c.failing && c.state !== 'attention' && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber">
              <AlertTriangle size={11} /> Needs a look
            </span>
          )}
          {onScreen && c.step.lastBoundTo && c.step.confidence !== undefined && !c.failing && c.state !== 'attention' && (
            <span className="text-[11px] text-muted">
              Points at {c.step.lastBoundTo} · {pct(c.step.confidence)}% sure
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {!c.locked && (
          <button
            aria-label="Remove step"
            onClick={(e) => {
              e.stopPropagation();
              c.onRemove();
            }}
            className="rounded p-0.5 text-muted opacity-0 hover:bg-canvas hover:text-ink group-hover:opacity-100"
          >
            <X size={15} />
          </button>
        )}
        {onScreen && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              c.onShowMe();
            }}
            className="mt-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-teal hover:bg-mint"
          >
            <Eye size={13} />
            show me
          </button>
        )}
      </div>
    </div>
  );
}

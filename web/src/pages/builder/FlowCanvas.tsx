import { useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { ACTIONS, tagOf } from '../../domain/actions';
import { NODE_H, NODE_W } from '../../domain/flow';
import type { Edge, Step } from '../../domain/types';
import type { Phase, StepState } from './useRunner';

export interface PlusMenu {
  afterId: string | null;
  x: number;
  y: number;
}

const LEFT = { screen: 'border-l-teal', page: 'border-l-[#98A2B3]', edge: 'border-l-[#DC9A15]' } as const;
const TAG = { screen: 'text-teal', page: 'text-muted', edge: 'text-amber' } as const;
const CHIP = 'rounded-full px-[7px] py-px text-[10px] font-bold';

interface Props {
  steps: Step[];
  edges: Edge[];
  ordered: Step[];
  selectedId: string | null;
  states: Record<string, StepState>;
  activeId: string | null;
  phase: Phase;
  failing: Set<string>;
  fresh: Set<string>;
  locked: boolean;
  plusMenu: PlusMenu | null;
  header: ReactNode;
  empty: ReactNode;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onPlus: (menu: PlusMenu) => void;
  onBranch: (afterId: string) => void;
  onPlusManual: () => void;
  onPlusRecord: () => void;
  onPlusClose: () => void;
}

/** The flow: every step is a node Diane can drag, joined by wires in the order a run takes them. */
export function FlowCanvas(p: Props) {
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const moved = useRef(false);
  const num = new Map(p.ordered.map((s, i) => [s.id, i + 1]));
  const pos = (s: Step) => (drag?.id === s.id ? { x: drag.x, y: drag.y } : { x: s.x ?? 0, y: s.y ?? 0 });
  const at = new Map(p.steps.map((s) => [s.id, pos(s)]));

  const startDrag = (e: ReactMouseEvent, s: Step) => {
    if (p.locked || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const ox = s.x ?? 0;
    const oy = s.y ?? 0;
    moved.current = false;
    let last = { x: ox, y: oy };
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
      last = { x: Math.max(10, ox + dx), y: Math.max(10, oy + dy) };
      setDrag({ id: s.id, ...last });
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      setDrag(null);
      if (moved.current) p.onMove(s.id, last.x, last.y);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const markFor = (s: Step) => {
    const st = p.states[s.id];
    if (st === 'done') return <span className={`${CHIP} bg-[#ECFDF3] text-[#067647]`}>✓</span>;
    if (st === 'previewed') return <span className={`${CHIP} bg-[#F2F4F7] text-body`}>preview</span>;
    if (st === 'attention') return <span className={`${CHIP} bg-[#FFFAEB] text-[#7A4A08]`}>needs you</span>;
    if (st === 'active' && p.activeId === s.id && p.phase === 'running') return <span className={`${CHIP} animate-pulse bg-mint text-teal`}>running</span>;
    if (!st && p.failing.has(s.id)) return <span className={`${CHIP} bg-[#FFFAEB] text-[#7A4A08]`}>needs a look</span>;
    return null;
  };

  const wires = p.edges.map((e) => {
    const a = at.get(e.a);
    const b = at.get(e.b);
    if (!a || !b) return null;
    const x1 = a.x + NODE_W / 2;
    const y1 = a.y + NODE_H;
    const x2 = b.x + NODE_W / 2;
    const y2 = b.y;
    const d = `M${x1} ${y1} C ${x1} ${y1 + 46}, ${x2} ${y2 - 46}, ${x2} ${y2}`;
    return (
      <g key={`${e.a}-${e.b}`}>
        <path d={d} fill="none" stroke="#C7D0D6" strokeWidth={1.8} markerEnd="url(#atlasArrow)" />
        {e.label && (
          <text x={(x1 + x2) / 2 + (x2 > x1 ? 8 : -8)} y={(y1 + y2) / 2 - 2} textAnchor={x2 > x1 ? 'start' : 'end'} fill="#667085" fontSize="10.5" fontWeight={700}>
            {e.label}
          </text>
        )}
      </g>
    );
  });

  const adders: { key: string; x: number; y: number; label: string; title: string; onClick: () => void }[] = [];
  if (!p.locked) {
    p.edges.forEach((e) => {
      const a = at.get(e.a);
      const b = at.get(e.b);
      if (!a || !b || e.label === 'No') return;
      const x = (a.x + b.x) / 2 + NODE_W / 2;
      const y = (a.y + NODE_H + b.y) / 2;
      adders.push({ key: `e-${e.a}-${e.b}`, x, y, label: '+', title: 'Add a step here', onClick: () => p.onPlus({ afterId: e.a, x, y }) });
    });
    p.steps.forEach((s) => {
      if (p.edges.some((e) => e.a === s.id)) return;
      const a = at.get(s.id)!;
      const y = a.y + NODE_H + 30;
      adders.push({ key: `p-${s.id}`, x: a.x + NODE_W / 2 - 15, y, label: '+', title: 'Add a step', onClick: () => p.onPlus({ afterId: s.id, x: a.x + NODE_W / 2 - 15, y }) });
      adders.push({ key: `b-${s.id}`, x: a.x + NODE_W / 2 + 15, y, label: '⑂', title: 'Split into two paths', onClick: () => p.onBranch(s.id) });
    });
  }

  const maxX = p.steps.reduce((m, s) => Math.max(m, pos(s).x + NODE_W), 0);
  const maxY = p.steps.reduce((m, s) => Math.max(m, pos(s).y + NODE_H), 0);
  const where = p.plusMenu?.afterId && num.has(p.plusMenu.afterId) ? `Add after step ${num.get(p.plusMenu.afterId)}` : 'Add a step';

  return (
    <div className="flex h-[560px] min-w-0 flex-col border-r border-line bg-[#FBFBFC]">
      {p.header}
      <div
        className="relative min-h-0 flex-1 overflow-auto"
        style={{ backgroundColor: '#FBFBFC', backgroundImage: 'radial-gradient(#DFE3E8 1px, transparent 1px)', backgroundSize: '18px 18px' }}
      >
        {p.steps.length === 0 && <div className="absolute inset-0 z-[1] flex items-center justify-center p-8">{p.empty}</div>}
        <div className="relative" style={{ width: Math.max(maxX + 220, 620), height: Math.max(maxY + 130, 520) }}>
          <svg className="pointer-events-none absolute inset-0 overflow-visible" width="100%" height="100%">
            <defs>
              <marker id="atlasArrow" viewBox="0 0 8 8" refX={6} refY={4} markerWidth={6} markerHeight={6} orient="auto">
                <path d="M0 0 L8 4 L0 8 z" fill="#C7D0D6" />
              </marker>
            </defs>
            {wires}
          </svg>

          {p.steps.map((s) => {
            const def = ACTIONS[s.verb];
            const isBranch = s.verb === 'branch';
            const selected = p.selectedId === s.id;
            const dragging = drag?.id === s.id;
            const q = pos(s);
            const text = def.resolves === 'screen' && !s.bind ? 'Point at the thing on the screen →' : s.sentence;
            return (
              <div
                key={s.id}
                role="button"
                aria-label={`Step ${num.get(s.id) ?? ''}: ${text}`}
                onMouseDown={(e) => startDrag(e, s)}
                onClick={() => {
                  if (moved.current) {
                    moved.current = false;
                    return;
                  }
                  p.onSelect(s.id);
                }}
                className={`absolute box-border select-none rounded-[10px] border border-l-4 bg-white px-[13px] py-[11px] ${
                  isBranch ? 'border-dashed border-l-teal' : LEFT[def.resolves]
                } ${selected ? 'border-teal shadow-[0_0_0_3px_rgba(14,124,107,0.10),0_1px_2px_rgba(16,24,40,0.06)]' : 'border-line shadow-[0_1px_2px_rgba(16,24,40,0.06)]'} ${
                  dragging ? 'z-[4] cursor-grabbing shadow-[0_10px_24px_rgba(16,24,40,0.16)]' : 'z-[2]'
                } ${p.locked ? 'cursor-pointer' : dragging ? '' : 'cursor-grab'} ${p.fresh.has(s.id) ? 'animate-card-in' : ''}`}
                style={{ left: q.x, top: q.y, width: NODE_W, height: NODE_H }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10.5px] font-bold text-[#98A2B3]">{num.get(s.id) ?? '·'}</span>
                  <span className={`truncate text-[10.5px] font-bold uppercase tracking-[0.03em] ${isBranch ? 'text-teal' : TAG[def.resolves]}`}>{tagOf(s)}</span>
                  {markFor(s)}
                  <div className="flex-1" />
                  {!p.locked && (
                    <button
                      aria-label="Remove step"
                      onClick={(e) => {
                        e.stopPropagation();
                        p.onRemove(s.id);
                      }}
                      className="px-0.5 text-[15px] leading-none text-[#C3C8CF] hover:text-red"
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className={`mt-[7px] line-clamp-2 text-[12.5px] leading-[1.45] ${def.resolves === 'screen' && !s.bind ? 'italic text-muted' : 'text-ink'}`}>{text}</div>
              </div>
            );
          })}

          {adders.map((a) => (
            <button
              key={a.key}
              title={a.title}
              aria-label={a.title}
              onClick={(e) => {
                e.stopPropagation();
                a.onClick();
              }}
              className="absolute z-[5] flex h-[22px] w-[22px] items-center justify-center rounded-full border border-line bg-white p-0 text-[13px] leading-none text-[#98A2B3] hover:border-teal hover:bg-[#F6FBFA] hover:text-teal"
              style={{ left: a.x - 11, top: a.y - 11 }}
            >
              {a.label}
            </button>
          ))}

          {p.plusMenu && (
            <div
              className="absolute z-[9] w-[258px] rounded-[10px] border border-line bg-white p-2 shadow-[0_14px_36px_rgba(16,24,40,0.16)]"
              style={{ left: p.plusMenu.x + 18, top: p.plusMenu.y - 10 }}
            >
              <div className="px-2.5 pb-2 pt-1 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#98A2B3]">{where}</div>
              <button onClick={p.onPlusManual} className="block w-full rounded-[7px] px-2.5 py-[9px] text-left hover:bg-[#F2F4F7]">
                <div className="text-[13px] font-semibold text-ink">Add manually</div>
                <div className="mt-[3px] text-[11.5px] leading-[1.45] text-muted">Pick the action from the list on the left.</div>
              </button>
              <button onClick={p.onPlusRecord} className="block w-full rounded-[7px] px-2.5 py-[9px] text-left hover:bg-[#F2F4F7]">
                <div className="text-[13px] font-semibold text-teal">Click the interface</div>
                <div className="mt-[3px] text-[11.5px] leading-[1.45] text-muted">Open the page below and click — every click becomes a step.</div>
              </button>
              <button onClick={p.onPlusClose} className="block w-full px-2.5 py-[7px] text-left text-[11.5px] text-[#98A2B3] hover:text-body">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

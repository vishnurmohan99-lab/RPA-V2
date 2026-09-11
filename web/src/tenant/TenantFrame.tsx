import { Landmark, Receipt, Users } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Kind, ScreenId } from '../domain/types';
import { MedicalCross } from '../shell/Rail';
import { BalancesScreen } from './BalancesScreen';
import { PatientsScreen } from './PatientsScreen';
import { PaymentsScreen } from './PaymentsScreen';
import { SignInScreen } from './SignInScreen';
import { UploadScreen } from './UploadScreen';

export type Tone = 'teal' | 'red' | 'amber';
export type RowMark = 'out' | 'skipped' | 'held' | 'kept';

export interface TenantHighlight {
  label: string;
  kind: Kind;
  tone: Tone;
  caption?: string;
}

export interface ScreenProps {
  mutated: boolean;
  rowMarks?: Record<string, RowMark>;
  rowNotes?: Record<string, string>;
  onAction?: (label: string) => void;
  uploaded?: { name: string; detail: string } | null;
  /** The username a sign-in step filled in. There is never a password here. */
  signIn?: { user: string } | null;
}

export interface TenantProps extends ScreenProps {
  screen: ScreenId;
  highlight?: TenantHighlight | null;
  mode?: 'normal' | 'pick' | 'record';
  pickKinds?: Kind[];
  onPick?: (label: string, kind: Kind) => void;
  onNavigate?: (screen: ScreenId) => void;
  /** Receives the element the binder searches: the whole synthetic tenant, nav included. */
  rootRef?: (el: HTMLDivElement | null) => void;
  /** Shown at the right of the address bar, e.g. "Live view" or "Recording". */
  badge?: ReactNode;
  /** Address to show instead of the synthetic one, e.g. the workflow's starting URL on its first page. */
  url?: string;
}

export const SCREEN_URL: Record<ScreenId, string> = {
  signin: 'demo.practicesuite.test/login',
  patients: 'demo.practicesuite.test/patients',
  balances: 'demo.practicesuite.test/billing/statements',
  payments: 'demo.practicesuite.test/payments/era',
  upload: 'print-vendor.test/statements/upload',
};

const NAV: { screen: ScreenId; label: string; icon: typeof Users }[] = [
  { screen: 'patients', label: 'Patients', icon: Users },
  { screen: 'balances', label: 'Balances', icon: Receipt },
  { screen: 'payments', label: 'Payments', icon: Landmark },
];

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findTarget(root: HTMLElement, label: string, kind: Kind): HTMLElement | null {
  return [...root.querySelectorAll<HTMLElement>('[data-label]')].find((el) => el.dataset.label === label && el.dataset.kind === kind) ?? null;
}

/** Box around an element relative to the frame body; a column header stretches over its whole column. */
function measure(el: HTMLElement, body: HTMLElement): Box {
  let r = el.getBoundingClientRect();
  if (el.tagName === 'TH') {
    const rows = el.closest('table')?.tBodies[0]?.rows;
    const last = rows && rows.length ? rows[rows.length - 1].cells[(el as HTMLTableCellElement).cellIndex] : null;
    if (last) r = new DOMRect(r.left, r.top, r.width, last.getBoundingClientRect().bottom - r.top);
  }
  const b = body.getBoundingClientRect();
  const pad = 3;
  return { top: r.top - b.top - pad, left: r.left - b.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
}

function ensureVisible(el: HTMLElement, scroller: HTMLElement) {
  if (!scroller.contains(el)) return;
  const r = el.getBoundingClientRect();
  const c = scroller.getBoundingClientRect();
  if (r.top < c.top + 30) scroller.scrollTop -= c.top + 30 - r.top;
  else if (r.top > c.bottom - 80) scroller.scrollTop += r.top - (c.bottom - 160);
}

const TONE: Record<Tone, { border: string; fill: string; tag: string }> = {
  teal: { border: 'border-teal', fill: 'bg-teal/5 shadow-[0_0_0_4px_rgba(14,124,107,0.12)]', tag: 'bg-teal text-white' },
  red: { border: 'border-red', fill: 'bg-red/5 shadow-[0_0_0_4px_rgba(180,35,24,0.12)]', tag: 'bg-red text-white' },
  amber: { border: 'border-amber', fill: 'bg-amber/5 shadow-[0_0_0_4px_rgba(181,71,8,0.12)]', tag: 'bg-amber text-white' },
};

export function TenantFrame(props: TenantProps) {
  const { screen, highlight, mode = 'normal', pickKinds, onPick, onNavigate, rootRef, badge, url, ...screenProps } = props;
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [hover, setHover] = useState<{ box: Box; label: string } | null>(null);
  const [tick, setTick] = useState(0);

  const setBody = useCallback(
    (el: HTMLDivElement | null) => {
      bodyRef.current = el;
      rootRef?.(el);
    },
    [rootRef],
  );

  // Bring a new target into view once, when it changes.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || !highlight || !scrollRef.current) return;
    const el = findTarget(body, highlight.label, highlight.kind);
    if (el) ensureVisible(el, scrollRef.current);
  }, [highlight?.label, highlight?.kind, screen]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || !highlight) {
      setBox(null);
      return;
    }
    const el = findTarget(body, highlight.label, highlight.kind);
    setBox(el ? measure(el, body) : null);
  }, [highlight, screen, screenProps.mutated, screenProps.rowMarks, tick]);

  useEffect(() => {
    const body = bodyRef.current;
    const sc = scrollRef.current;
    if (!body || !sc) return;
    const bump = () => setTick((t) => t + 1);
    const ro = new ResizeObserver(bump);
    ro.observe(body);
    sc.addEventListener('scroll', bump, { passive: true });
    return () => {
      ro.disconnect();
      sc.removeEventListener('scroll', bump);
    };
  }, []);

  const picking = mode !== 'normal';
  useEffect(() => {
    if (!picking) setHover(null);
  }, [picking]);

  const pickable = (target: EventTarget | null): HTMLElement | null => {
    const el = (target as HTMLElement | null)?.closest?.<HTMLElement>('[data-label]');
    if (!el) return null;
    if (pickKinds && pickKinds.length && !pickKinds.includes(el.dataset.kind as Kind)) return null;
    return el;
  };

  const onMouseOver = (e: React.MouseEvent) => {
    if (!picking || !bodyRef.current) return;
    const el = pickable(e.target);
    setHover(el ? { box: measure(el, bodyRef.current), label: el.dataset.label! } : null);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (!picking) return;
    e.preventDefault();
    e.stopPropagation();
    const el = pickable(e.target);
    if (el) {
      setHover(null);
      onPick?.(el.dataset.label!, el.dataset.kind as Kind);
    }
  };

  const inPS = screen !== 'upload' && screen !== 'signin';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[10px] border border-line bg-white">
      <div className="flex items-center gap-2.5 border-b border-line bg-[#FCFCFD] px-3.5 py-2.5">
        <div className="flex gap-[5px]">
          {[0, 1, 2].map((i) => (
            <span key={i} className="block h-[9px] w-[9px] rounded-full bg-line" />
          ))}
        </div>
        <div className="min-w-0 flex-1 truncate rounded-md bg-[#F2F4F7] px-2.5 py-[5px] text-[11.5px] text-muted">{url ?? `https://${SCREEN_URL[screen]}`}</div>
        {badge}
      </div>

      <div
        ref={setBody}
        onMouseOver={onMouseOver}
        onMouseLeave={() => setHover(null)}
        onClickCapture={onClickCapture}
        className={`relative flex min-h-0 flex-1 overflow-hidden ${picking ? 'cursor-crosshair [&_*]:!cursor-crosshair' : ''}`}
      >
        {inPS && (
          <div className="flex w-12 shrink-0 flex-col items-center gap-1.5 border-r border-line py-3">
            <div className="mb-2">
              <MedicalCross size={20} />
            </div>
            {NAV.map(({ screen: s, label, icon: Icon }) => (
              <button
                key={s}
                data-label={label}
                data-kind="nav"
                title={label}
                onClick={() => onNavigate?.(s)}
                className={`flex h-8 w-8 items-center justify-center rounded-md ${s === screen ? 'bg-mint text-teal' : 'text-muted hover:bg-canvas'} ${picking ? 'outline-dashed outline-1 -outline-offset-2 outline-[#9ED4C9]' : ''}`}
              >
                <Icon size={16} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto">
          {screen === 'signin' && <SignInScreen {...screenProps} />}
          {screen === 'patients' && <PatientsScreen {...screenProps} />}
          {screen === 'balances' && <BalancesScreen {...screenProps} />}
          {screen === 'payments' && <PaymentsScreen {...screenProps} />}
          {screen === 'upload' && <UploadScreen {...screenProps} />}
        </div>

        {box && highlight && (
          <div className="pointer-events-none absolute z-10 transition-all duration-200" style={box}>
            <div className={`h-full w-full rounded-md border-2 ${TONE[highlight.tone].border} ${TONE[highlight.tone].fill}`} />
            {highlight.caption && (
              <div
                className={`absolute right-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold ${TONE[highlight.tone].tag} ${box.top < 28 ? 'top-full mt-1' : '-top-6'}`}
              >
                {highlight.caption}
              </div>
            )}
          </div>
        )}

        {picking && hover && (
          <div className="pointer-events-none absolute z-20" style={hover.box}>
            <div className="h-full w-full rounded-md border-2 border-dashed border-teal bg-teal/5" />
            <div className={`absolute left-0 whitespace-nowrap rounded bg-ink px-2 py-0.5 text-[11px] font-medium text-white ${hover.box.top < 28 ? 'top-full mt-1' : '-top-6'}`}>
              {hover.label}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

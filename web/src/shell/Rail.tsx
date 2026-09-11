import { FolderOpen, History, KeyRound, ScrollText } from 'lucide-react';
import type { ComponentType } from 'react';
import { useStore, type View } from '../state/store';

type IconProps = { size?: number | string; strokeWidth?: number | string };

/** Two stacked blocks, as in the Workflows rail icon of the design. */
function WorkflowsIcon({ size = 20, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden>
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="11" height="6" rx="2" />
    </svg>
  );
}

const ITEMS: { view: View['name']; label: string; icon: ComponentType<IconProps> }[] = [
  { view: 'list', label: 'Workflows', icon: WorkflowsIcon },
  { view: 'rules', label: 'House rules', icon: ScrollText },
  { view: 'history', label: 'Run history', icon: History },
  { view: 'files', label: 'Files', icon: FolderOpen },
  { view: 'signins', label: 'Sign-ins', icon: KeyRound },
];

const ACTIVE_FOR: Partial<Record<View['name'], View['name']>> = { setup: 'list', builder: 'list' };

/** PracticeSuite's own cross, used inside the synthetic tenant. */
export function MedicalCross({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="11.5" y="3" width="9" height="26" rx="4.5" fill="#6CC24A" />
      <rect x="3" y="11.5" width="26" height="9" rx="4.5" fill="#29A8E0" />
      <rect x="11.5" y="11.5" width="9" height="9" fill="#1F8F5F" />
    </svg>
  );
}

export function Rail() {
  const { state, dispatch } = useStore();
  const current = ACTIVE_FOR[state.view.name] ?? state.view.name;
  return (
    <nav className="sticky top-0 flex h-screen w-[76px] shrink-0 flex-col items-center gap-1.5 border-r border-line bg-white py-4">
      <div className="mb-3.5 flex h-9 w-9 items-center justify-center rounded-card bg-teal" title="Atlas">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" fill="#FFFFFF" />
        </svg>
      </div>
      {ITEMS.map(({ view, label, icon: Icon }) => {
        const active = current === view;
        return (
          <button
            key={view}
            title={label}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            onClick={() => dispatch({ type: 'go', view: { name: view } as View })}
            className={`flex h-11 w-11 items-center justify-center rounded-[10px] transition-colors ${active ? 'bg-mint text-teal' : 'text-muted hover:bg-[#F2F4F7]'}`}
          >
            <Icon size={20} strokeWidth={1.7} />
          </button>
        );
      })}
      <div className="flex-1" />
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mint text-sm font-semibold text-teal" title="Diane Keller">
        D
      </div>
    </nav>
  );
}

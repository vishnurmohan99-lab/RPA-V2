import { FolderOpen, History, KeyRound, ScrollText, Zap, type LucideIcon } from 'lucide-react';
import { useStore, type View } from '../state/store';

const ITEMS: { view: View['name']; label: string; icon: LucideIcon }[] = [
  { view: 'list', label: 'Automations', icon: Zap },
  { view: 'rules', label: 'House rules', icon: ScrollText },
  { view: 'history', label: 'Run history', icon: History },
  { view: 'files', label: 'Files', icon: FolderOpen },
  { view: 'signins', label: 'Sign-ins', icon: KeyRound },
];

const ACTIVE_FOR: Partial<Record<View['name'], View['name']>> = { setup: 'list', builder: 'list' };

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
    <nav className="sticky top-0 flex h-screen w-[76px] shrink-0 flex-col items-center gap-2 border-r border-line bg-white py-4">
      <div className="mb-5">
        <MedicalCross />
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
            className={`flex h-11 w-11 items-center justify-center rounded-[10px] transition-colors ${
              active ? 'bg-mint text-teal' : 'text-muted hover:bg-canvas'
            }`}
          >
            <Icon size={20} strokeWidth={1.8} />
          </button>
        );
      })}
      <div className="flex-1" />
      <div className="mb-2 w-10 border-t border-line" />
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mint text-sm font-semibold text-teal" title="Diane Keller">
        DK
      </div>
    </nav>
  );
}

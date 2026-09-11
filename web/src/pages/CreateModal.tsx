import { LayoutList, MessageSquareText, MousePointerClick, type LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Modal } from '../shell/ui';

type Start = 'describe' | 'record' | 'scratch';

const TILES: { start: Start; key: string; title: string; body: string; icon: LucideIcon }[] = [
  { start: 'describe', key: '1', title: 'Describe it', body: 'Tell the assistant what you do, in plain English.', icon: MessageSquareText },
  { start: 'record', key: '2', title: 'Show me how', body: 'Click through it once on the screen. Each click becomes a step.', icon: MousePointerClick },
  { start: 'scratch', key: '3', title: 'Start from scratch', body: 'Build the steps yourself, one at a time.', icon: LayoutList },
];

export function CreateModal({ open, onClose, onChoose }: { open: boolean; onClose: () => void; onChoose: (s: Start) => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const tile = TILES.find((t) => t.key === e.key);
      if (tile) onChoose(tile.start);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onChoose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create New Automation"
      subtitle="Select how you want to get started."
      width={760}
      hints={[
        ['1', 'Describe'],
        ['2', 'Show me'],
        ['3', 'Scratch'],
        ['Esc', 'Close'],
      ]}
    >
      <div className="grid grid-cols-3 gap-3">
        {TILES.map(({ start, title, body, icon: Icon }, i) => (
          <button
            key={start}
            onClick={() => onChoose(start)}
            className={`group flex flex-col items-center rounded-modal border px-4 py-7 text-center transition-all hover:border-teal hover:shadow-lift ${
              i === 0 ? 'border-teal/50 bg-[radial-gradient(circle_at_50%_30%,#E6F4F1,white_70%)]' : 'border-line bg-white'
            }`}
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-modal bg-teal text-white shadow-lift">
              <Icon size={26} strokeWidth={1.8} />
            </div>
            <div className="text-[15px] font-semibold text-ink">{title}</div>
            <div className="mt-1 text-[13px] leading-snug text-body">{body}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

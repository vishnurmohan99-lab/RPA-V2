import { ACTIONS, GROUPS } from '../../domain/actions';

const TONE = { screen: 'text-teal', page: 'text-muted', edge: 'text-amber' } as const;

/** "Add steps myself": every action in the registry, grouped by where it happens. */
export function ManualPicker({ insertNote, onPick, disabled }: { insertNote: string; onPick: (verb: string) => void; disabled?: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-[18px] py-[13px]">
        <div className="text-xs font-semibold text-body">Add a step</div>
        <div className="text-[11.5px] text-[#98A2B3]">{insertNote}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-[18px]">
        {GROUPS.map((g) => (
          <div key={g.resolves} className="mb-[18px]">
            <div className={`mb-2 text-[10.5px] font-bold uppercase tracking-[0.04em] ${TONE[g.resolves]}`}>{g.title}</div>
            <div className="flex flex-col gap-0.5">
              {Object.entries(ACTIONS)
                .filter(([verb, d]) => d.resolves === g.resolves && verb !== 'note')
                .map(([verb, d]) => (
                  <button
                    key={verb}
                    disabled={disabled}
                    onClick={() => onPick(verb)}
                    className="rounded-md px-[9px] py-2 text-left text-[13px] text-[#344054] hover:bg-[#F2F4F7] disabled:opacity-50"
                  >
                    {d.label}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

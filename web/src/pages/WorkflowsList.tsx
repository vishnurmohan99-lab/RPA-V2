import { MoreHorizontal, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { newStepId } from '../domain/actions';
import { edgesOf } from '../domain/flow';
import type { Automation } from '../domain/types';
import { useStore } from '../state/store';
import { Button, EmptyState, Modal, StatusPill } from '../shell/ui';

const GRID = 'grid grid-cols-[minmax(0,2fr)_minmax(150px,0.9fr)_minmax(150px,1.1fr)_minmax(70px,0.6fr)_minmax(0,1fr)_44px] items-center';

export const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export function WorkflowsList() {
  const { state, dispatch } = useStore();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Automation | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    setTimeout(() => document.addEventListener('click', close), 0);
    return () => document.removeEventListener('click', close);
  }, [menu]);

  const rows = state.automations.filter((a) => a.name.toLowerCase().includes(q.trim().toLowerCase()));
  const open = (a: Automation) => dispatch({ type: 'go', view: { name: 'builder', id: a.id } });
  const create = () => dispatch({ type: 'go', view: { name: 'setup' } });

  const duplicate = (a: Automation) => {
    const ids = new Map(a.steps.map((s) => [s.id, newStepId()]));
    dispatch({
      type: 'upsertAutomation',
      automation: {
        ...a,
        id: `auto-${Date.now().toString(36)}`,
        name: `${a.name} (copy)`,
        status: 'never',
        lastRun: 'Never run',
        cleanDryRun: false,
        steps: a.steps.map((s) => ({ ...s, id: ids.get(s.id)! })),
        edges: edgesOf(a).map((e) => ({ ...e, a: ids.get(e.a)!, b: ids.get(e.b)! })),
      },
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-start gap-4 border-b border-line bg-white px-8 pb-[22px] pt-7">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold tracking-tight text-ink">Workflows</h1>
          <p className="mt-1.5 text-[13px] text-muted">Everything the agent runs for the practice. Open one to see its steps or its run logs.</p>
        </div>
        <button onClick={create} className="inline-flex items-center gap-2 rounded-card bg-teal px-[18px] py-[11px] text-[13px] font-semibold text-white hover:bg-teal-dark">
          <span className="text-[15px] leading-none">+</span>
          Create Workflow
        </button>
      </div>

      <div className="px-8 pb-10 pt-[22px]">
        {state.automations.length === 0 ? (
          <EmptyState
            icon={<Search size={22} />}
            title="No workflows yet"
            body="Name it and give it a starting page. The agent opens that page and you build the steps from there."
            action={
              <Button variant="primary" onClick={create}>
                + Create Workflow
              </Button>
            }
          />
        ) : (
          <>
            <div className="mb-5 flex max-w-[340px] items-center gap-2.5 rounded-card border border-line bg-white px-3 py-[9px]">
              <Search size={15} className="text-[#98A2B3]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by workflow name"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-[#98A2B3] focus:outline-none"
              />
            </div>

            <div className="rounded-[10px] border border-line bg-white">
              <div className={`${GRID} rounded-t-[10px] border-b border-line bg-canvas text-[11.5px] font-semibold text-body`}>
                <div className="px-4 py-[13px]">Workflow Name</div>
                <div className="px-4 py-[13px]">Status</div>
                <div className="px-4 py-[13px]">Last Run</div>
                <div className="px-4 py-[13px]">Steps</div>
                <div className="px-4 py-[13px]">Owner</div>
                <div />
              </div>
              {rows.map((a) => (
                <div key={a.id} role="button" onClick={() => open(a)} className={`${GRID} cursor-pointer border-b border-[#F2F4F7] last:border-b-0 hover:bg-canvas`}>
                  <div className="min-w-0 px-4 py-[15px]">
                    <div className="truncate text-[13.5px] font-semibold text-teal">{a.name}</div>
                    <div className="mt-[3px] truncate text-[11.5px] text-[#98A2B3]">{hostOf(a.startUrl)}</div>
                  </div>
                  <div className="min-w-0 px-4 py-[15px]">
                    <StatusPill status={a.status} />
                  </div>
                  <div className="min-w-0 truncate px-4 py-[15px] text-[12.5px] text-body">{a.lastRun}</div>
                  <div className="px-4 py-[15px] text-[12.5px] text-body">{a.steps.length}</div>
                  <div className="min-w-0 truncate px-4 py-[15px] text-[12.5px] text-body">{a.createdBy}</div>
                  <div className="relative px-2 py-[15px]" onClick={(e) => e.stopPropagation()}>
                    <button aria-label={`More for ${a.name}`} onClick={() => setMenu(menu === a.id ? null : a.id)} className="rounded p-1 text-[#98A2B3] hover:bg-canvas">
                      <MoreHorizontal size={16} />
                    </button>
                    {menu === a.id && (
                      <div className="absolute right-2 top-11 z-20 w-40 rounded-[10px] border border-line bg-white p-1 text-left shadow-[0_14px_36px_rgba(16,24,40,0.14)]">
                        {[
                          ['Open', () => open(a)],
                          ['Duplicate', () => duplicate(a)],
                          ['Delete', () => setDeleting(a)],
                        ].map(([label, fn]) => (
                          <button
                            key={label as string}
                            onClick={fn as () => void}
                            className={`block w-full rounded-[7px] px-2.5 py-2 text-left text-[13px] hover:bg-[#F2F4F7] ${label === 'Delete' ? 'text-red' : 'text-[#344054]'}`}
                          >
                            {label as string}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {rows.length === 0 && <div className="px-4 py-[34px] text-center text-[12.5px] text-muted">No workflows match that name.</div>}
            </div>
          </>
        )}
      </div>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={`Delete “${deleting?.name}”?`} subtitle="The workflow and its steps go away. Run history and kept files stay." width={460}>
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={() => setDeleting(null)}>
            Keep it
          </Button>
          <Button
            size="sm"
            variant="primary"
            className="!bg-red hover:!brightness-95"
            onClick={() => {
              if (deleting) dispatch({ type: 'removeAutomation', id: deleting.id });
              setDeleting(null);
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

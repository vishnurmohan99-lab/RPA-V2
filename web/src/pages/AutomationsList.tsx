import { MoreHorizontal, Plus, Search, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { newStepId } from '../domain/actions';
import type { Automation, AutomationStatus } from '../domain/types';
import { useStore } from '../state/store';
import { Button, EmptyState, inputCls, Modal, PageHeader, StatusPill } from '../shell/ui';
import { CreateModal } from './CreateModal';

export function AutomationsList() {
  const { state, dispatch } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | AutomationStatus>('all');
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Automation | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    setTimeout(() => document.addEventListener('click', close), 0);
    return () => document.removeEventListener('click', close);
  }, [menu]);

  const rows = state.automations.filter(
    (a) => (status === 'all' || a.status === status) && a.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  const open = (a: Automation) => dispatch({ type: 'go', view: { name: 'builder', id: a.id } });

  const duplicate = (a: Automation) => {
    const copy: Automation = {
      ...a,
      id: `auto-${Date.now().toString(36)}`,
      name: `${a.name} (copy)`,
      status: 'never',
      lastRun: '—',
      cleanDryRun: false,
      steps: a.steps.map((s) => ({ ...s, id: newStepId() })),
    };
    dispatch({ type: 'upsertAutomation', automation: copy });
  };

  return (
    <div>
      <PageHeader
        title="Automations"
        description="Routines your practice runs in PracticeSuite. Build one by describing what you do."
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Create Automation
          </Button>
        }
      />

      <div className="px-8 py-6">
        {state.automations.length === 0 ? (
          <EmptyState
            icon={<Zap size={22} />}
            title="No automations yet"
            body="Start with something you already do every week. Describe it in plain English and the assistant writes the steps for you."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus size={16} /> Create Automation
              </Button>
            }
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="relative w-80">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by automation name" className={`${inputCls} pl-9`} />
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${inputCls} w-48`}>
                <option value="all">All statuses</option>
                <option value="ready">Ready</option>
                <option value="attention">Needs attention</option>
                <option value="never">Never run</option>
              </select>
            </div>

            <div className="overflow-visible rounded-card border border-line bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-canvas text-left text-xs font-semibold text-body">
                    <th className="rounded-tl-card px-6 py-3">Automation Name</th>
                    <th className="px-4 py-3">Created By</th>
                    <th className="px-4 py-3">Last Run</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="w-14 rounded-tr-card" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="cursor-pointer border-t border-line hover:bg-canvas/60" onClick={() => open(a)}>
                      <td className="px-6 py-4">
                        <div className="font-medium text-ink">{a.name}</div>
                        <div className="mt-0.5 text-xs text-muted">
                          {a.steps.length} steps · {a.destination}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-ink">{a.createdBy}</td>
                      <td className="px-4 py-4 text-ink">{a.lastRun}</td>
                      <td className="px-4 py-4">
                        <StatusPill status={a.status} />
                      </td>
                      <td className="relative px-3 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button aria-label={`More for ${a.name}`} onClick={() => setMenu(menu === a.id ? null : a.id)} className="rounded p-1 text-muted hover:bg-canvas">
                          <MoreHorizontal size={18} />
                        </button>
                        {menu === a.id && (
                          <div className="absolute right-3 top-12 z-20 w-40 rounded-card border border-line bg-white py-1 text-left shadow-drag">
                            <MenuItem onClick={() => open(a)}>Open</MenuItem>
                            <MenuItem onClick={() => duplicate(a)}>Duplicate</MenuItem>
                            <MenuItem danger onClick={() => setDeleting(a)}>
                              Delete
                            </MenuItem>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-muted">
                        Nothing matches that search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <CreateModal
        open={creating}
        onClose={() => setCreating(false)}
        onChoose={(start) => {
          setCreating(false);
          dispatch({ type: 'go', view: { name: 'setup', start } });
        }}
      />

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={`Delete “${deleting?.name}”?`} subtitle="The automation and its steps go away. Run history and kept files stay." width={460}>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setDeleting(null)}>Keep it</Button>
          <Button
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

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-canvas ${danger ? 'text-red' : 'text-ink'}`}>
      {children}
    </button>
  );
}

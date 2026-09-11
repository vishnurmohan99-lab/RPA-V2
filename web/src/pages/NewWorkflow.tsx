import { FolderOpen, KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';
import { DESTINATIONS } from '../domain/seed';
import type { Automation, ScreenId } from '../domain/types';
import { useStore } from '../state/store';
import { Button, Field, inputCls, Modal } from '../shell/ui';
import { AddSignInModal, VAULT_NOTE } from './SignIns';

const guessScreen = (url: string): ScreenId => (/payment|era|remit/i.test(url) ? 'payments' : /patient/i.test(url) ? 'patients' : 'balances');

export function NewWorkflow() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('https://demo.practicesuite.test/billing');
  const [menu, setMenu] = useState(false);
  const [withCred, setWithCred] = useState(false);
  const [credId, setCredId] = useState(state.signIns[0]?.id ?? '');
  const [withDest, setWithDest] = useState(false);
  const [dest, setDest] = useState(DESTINATIONS[0].label);
  const [fileName, setFileName] = useState('statements-{date}.csv');
  const [adding, setAdding] = useState(false);

  const create = () => {
    const automation: Automation = {
      id: `auto-${Date.now().toString(36)}`,
      name: name.trim() || 'New workflow',
      createdBy: 'Diane Keller',
      startUrl: url.trim() || 'https://demo.practicesuite.test/billing',
      credId: credId || state.signIns[0]?.id || '',
      destination: DESTINATIONS.find((d) => d.label === dest)?.kind === 'web' ? dest : `${dest} › ${fileName}`,
      screen: guessScreen(url),
      steps: [],
      edges: [],
      status: 'never',
      lastRun: 'Never run',
    };
    dispatch({ type: 'upsertAutomation', automation });
    dispatch({ type: 'go', view: { name: 'builder', id: automation.id, start: 'describe' } });
  };

  const contextItems = [
    { key: 'cred', label: 'Add credential', icon: KeyRound, shown: !withCred, pick: () => setWithCred(true) },
    { key: 'dest', label: 'Where files go', icon: FolderOpen, shown: !withDest, pick: () => setWithDest(true) },
  ].filter((c) => c.shown);

  return (
    <div className="relative flex min-h-full flex-col items-center bg-canvas px-10 pb-10 pt-14">
      <button
        onClick={() => dispatch({ type: 'go', view: { name: 'list' } })}
        className="absolute left-6 top-5 rounded-card border border-line bg-white px-3 py-[7px] text-[12.5px] text-body hover:bg-canvas"
      >
        ← Workflows
      </button>

      <div className={`w-full max-w-[560px] transition-opacity ${open ? 'opacity-45' : ''}`}>
        <h1 className="text-center text-[30px] font-bold tracking-tight text-ink">{state.automations.length ? 'Create a workflow' : 'Create your first workflow'}</h1>
        <p className="mt-2.5 text-center text-[13.5px] leading-[1.6] text-muted">
          Name it and give it a starting page. The agent will open that page and begin building your workflow.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-[34px] w-full rounded-[10px] border border-line bg-white p-[18px] text-sm font-semibold text-teal hover:border-teal hover:bg-[#F6FBFA]"
        >
          Start from scratch
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setMenu(false);
        }}
        title="New Workflow"
        subtitle="Give the workflow a name and provide a URL that will be the starting point of the workflow."
        width={510}
      >
        <form
          className="flex flex-col gap-[18px]"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Field label="Workflow Name">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Patient Statements" className={inputCls} />
          </Field>
          <Field label="Starting URL">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className={`${inputCls} text-body`} />
          </Field>

          {withCred && (
            <Field label="Sign-in">
              <div className="flex gap-2">
                <select value={credId} onChange={(e) => setCredId(e.target.value)} className={inputCls}>
                  {state.signIns.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.user})
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" onClick={() => setAdding(true)}>
                  <Plus size={14} /> New
                </Button>
              </div>
              <span className="mt-2 flex items-start gap-2 rounded-card bg-mint px-3 py-2.5 text-xs leading-relaxed text-ink">
                <KeyRound size={14} className="mt-0.5 shrink-0 text-teal" />
                {VAULT_NOTE}
              </span>
            </Field>
          )}

          {withDest && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Where files go">
                <select value={dest} onChange={(e) => setDest(e.target.value)} className={inputCls}>
                  {DESTINATIONS.map((d) => (
                    <option key={d.id}>{d.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="File name" hint="{date} becomes the day it runs.">
                <input value={fileName} onChange={(e) => setFileName(e.target.value)} className={inputCls} />
              </Field>
            </div>
          )}

          {contextItems.length > 0 && (
            <div className="relative">
              <button type="button" onClick={() => setMenu((m) => !m)} className="inline-flex items-center gap-[9px] py-1 text-[13px] font-semibold text-teal hover:text-teal-dark">
                <span className="text-[15px] leading-none">+</span>
                Add context
              </button>
              {menu && (
                <div className="absolute left-[-14px] top-8 z-10 flex min-w-[220px] flex-col gap-0.5 rounded-[10px] border border-line bg-white p-2 shadow-[0_14px_36px_rgba(16,24,40,0.14)]">
                  {contextItems.map(({ key, label, icon: Icon, pick }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        pick();
                        setMenu(false);
                      }}
                      className="flex items-center gap-[11px] rounded-[7px] px-2.5 py-[9px] text-left text-[13px] text-[#344054] hover:bg-[#F2F4F7]"
                    >
                      <Icon size={15} className="text-teal" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-1.5 flex justify-end gap-2.5">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setOpen(false);
                setMenu(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary">
              Create
            </Button>
          </div>
        </form>
      </Modal>

      <AddSignInModal
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(s) => {
          setCredId(s.id);
          setAdding(false);
        }}
      />
    </div>
  );
}

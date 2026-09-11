import { KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';
import { DESTINATIONS } from '../domain/seed';
import type { Automation, ScreenId } from '../domain/types';
import { useStore } from '../state/store';
import { Button, Field, inputCls, PageHeader } from '../shell/ui';
import { AddSignInModal, VAULT_NOTE } from './SignIns';

export function Setup({ start }: { start?: 'describe' | 'record' | 'scratch' }) {
  const { state, dispatch } = useStore();
  const [name, setName] = useState('');
  const [startUrl, setStartUrl] = useState('https://demo.practicesuite.test/billing');
  const [credId, setCredId] = useState(state.signIns[0]?.id ?? '');
  const [dest, setDest] = useState(DESTINATIONS[0].label);
  const [fileName, setFileName] = useState('statements-{date}.csv');
  const [screen, setScreen] = useState<ScreenId>('balances');
  const [adding, setAdding] = useState(false);

  const create = () => {
    const automation: Automation = {
      id: `auto-${Date.now().toString(36)}`,
      name: name.trim() || 'New automation',
      createdBy: 'Diane Keller',
      startUrl,
      credId,
      destination: `${dest} › ${fileName}`,
      screen,
      steps: [],
      status: 'never',
      lastRun: '—',
    };
    dispatch({ type: 'upsertAutomation', automation });
    dispatch({ type: 'go', view: { name: 'builder', id: automation.id, start } });
  };

  return (
    <div>
      <PageHeader title="New automation" description="A few details first. You can change any of these later." />
      <div className="px-8 py-6">
        <div className="max-w-2xl space-y-5 rounded-card border border-line bg-white p-6">
          <Field label="Name">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Friday patient statements" className={inputCls} />
          </Field>
          <Field label="Where it starts" hint="The PracticeSuite address the automation opens first.">
            <input value={startUrl} onChange={(e) => setStartUrl(e.target.value)} className={inputCls} />
          </Field>
          <Field label="First screen">
            <select value={screen} onChange={(e) => setScreen(e.target.value as ScreenId)} className={inputCls}>
              <option value="balances">Balances</option>
              <option value="payments">Payments</option>
              <option value="patients">Patients</option>
            </select>
          </Field>
          <Field label="Sign-in">
            <div className="flex gap-2">
              <select value={credId} onChange={(e) => setCredId(e.target.value)} className={inputCls}>
                {state.signIns.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.user})
                  </option>
                ))}
              </select>
              <Button onClick={() => setAdding(true)}>
                <Plus size={15} /> New
              </Button>
            </div>
          </Field>
          <div className="flex items-start gap-3 rounded-card bg-mint px-4 py-3 text-[13px] leading-relaxed text-ink">
            <KeyRound size={16} className="mt-0.5 shrink-0 text-teal" />
            {VAULT_NOTE}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Where the file goes">
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
          <div className="flex justify-end gap-2 border-t border-line pt-5">
            <Button onClick={() => dispatch({ type: 'go', view: { name: 'list' } })}>Cancel</Button>
            <Button variant="primary" onClick={create}>
              Continue to the builder
            </Button>
          </div>
        </div>
      </div>
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

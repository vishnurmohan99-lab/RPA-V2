import { KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';
import type { SignIn } from '../domain/types';
import { useStore } from '../state/store';
import { Button, EmptyState, Field, inputCls, Modal, PageHeader } from '../shell/ui';

export const VAULT_NOTE =
  "The workshop keeps the name, username and account number. The password sits in the runner's own environment file and never appears here, in the workflow, or in the run history.";

export function AddSignInModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (s: SignIn) => void }) {
  const { dispatch } = useStore();
  const [label, setLabel] = useState('');
  const [user, setUser] = useState('');
  const [account, setAccount] = useState('');
  const ok = label.trim() && user.trim();
  return (
    <Modal open={open} onClose={onClose} title="Add a sign-in" subtitle="Give it a name your team will recognise." width={480}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          const signIn: SignIn = { id: `cred-${Date.now().toString(36)}`, label: label.trim(), user: user.trim(), account: account.trim() || undefined };
          dispatch({ type: 'addSignIn', signIn });
          setLabel('');
          setUser('');
          setAccount('');
          onSaved(signIn);
        }}
      >
        <Field label="Name">
          <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="For example: Billing read-only" className={inputCls} />
        </Field>
        <Field label="Username">
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="The PracticeSuite username" className={inputCls} />
        </Field>
        <Field label="Account # (if this sign-in needs one)">
          <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Optional — the practice/account number" className={inputCls} />
        </Field>
        <div className="flex items-start gap-3 rounded-card bg-mint px-4 py-3 text-[12.5px] leading-relaxed text-ink">
          <KeyRound size={16} className="mt-0.5 shrink-0 text-teal" />
          {VAULT_NOTE}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" variant="primary" disabled={!ok}>
            Save sign-in
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function SignIns() {
  const { state } = useStore();
  const [adding, setAdding] = useState(false);
  const usedBy = (id: string) => {
    const label = state.signIns.find((s) => s.id === id)?.label;
    return state.automations.filter((a) => a.credId === id || a.steps.some((st) => st.verb === 'signin' && st.value === label)).length;
  };
  return (
    <div>
      <PageHeader
        title="Sign-ins"
        description="Named sign-ins your workflows use. The name, username and account number live here — never a password."
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add sign-in
          </Button>
        }
      />
      <div className="space-y-4 px-8 py-6">
        <div className="flex max-w-3xl items-start gap-3 rounded-card bg-mint px-4 py-3 text-[12.5px] leading-relaxed text-ink">
          <KeyRound size={16} className="mt-0.5 shrink-0 text-teal" />
          {VAULT_NOTE}
        </div>
        {state.signIns.length === 0 ? (
          <EmptyState icon={<KeyRound size={22} />} title="No sign-ins yet" body="Add the PracticeSuite sign-in your workflows should use." />
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-line bg-white">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-canvas text-left text-[11.5px] font-semibold text-body">
                  <th className="px-4 py-[13px]">Name</th>
                  <th className="px-4 py-[13px]">Username</th>
                  <th className="px-4 py-[13px]">Account #</th>
                  <th className="px-4 py-[13px]">Used by</th>
                </tr>
              </thead>
              <tbody>
                {state.signIns.map((s) => (
                  <tr key={s.id} className="border-b border-[#F2F4F7] last:border-0">
                    <td className="px-4 py-[15px] text-[13.5px] font-semibold text-ink">{s.label}</td>
                    <td className="px-4 py-[15px] text-body">{s.user}</td>
                    <td className="px-4 py-[15px] text-body">{s.account ?? '—'}</td>
                    <td className="px-4 py-[15px] text-body">{usedBy(s.id) === 1 ? '1 workflow' : `${usedBy(s.id)} workflows`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <AddSignInModal open={adding} onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />
    </div>
  );
}

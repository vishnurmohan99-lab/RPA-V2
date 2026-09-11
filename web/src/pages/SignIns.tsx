import { KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';
import type { SignIn } from '../domain/types';
import { useStore } from '../state/store';
import { Button, EmptyState, Field, inputCls, Modal, PageHeader } from '../shell/ui';

export const VAULT_NOTE =
  "The workshop keeps the name only. The password sits in the runner's own environment file and never appears here, in the automation, or in the run history.";

export function AddSignInModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (s: SignIn) => void }) {
  const { dispatch } = useStore();
  const [label, setLabel] = useState('');
  const [user, setUser] = useState('');
  const ok = label.trim() && user.trim();
  return (
    <Modal open={open} onClose={onClose} title="Add a sign-in" subtitle="Give it a name your team will recognise." width={480} hints={[['Esc', 'Close']]}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          const signIn: SignIn = { id: `cred-${Date.now().toString(36)}`, label: label.trim(), user: user.trim() };
          dispatch({ type: 'addSignIn', signIn });
          setLabel('');
          setUser('');
          onSaved(signIn);
        }}
      >
        <Field label="Name">
          <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="For example: Billing read-only" className={inputCls} />
        </Field>
        <Field label="Username">
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="The PracticeSuite username" className={inputCls} />
        </Field>
        <div className="flex items-start gap-3 rounded-card bg-mint px-4 py-3 text-[13px] leading-relaxed text-ink">
          <KeyRound size={16} className="mt-0.5 shrink-0 text-teal" />
          {VAULT_NOTE}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!ok}>
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
  const usedBy = (id: string) => state.automations.filter((a) => a.credId === id).length;
  return (
    <div>
      <PageHeader
        title="Sign-ins"
        description="Named sign-ins your automations use. Only the name and username live here."
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add sign-in
          </Button>
        }
      />
      <div className="space-y-4 px-8 py-6">
        <div className="flex max-w-3xl items-start gap-3 rounded-card bg-mint px-4 py-3 text-[13px] leading-relaxed text-ink">
          <KeyRound size={16} className="mt-0.5 shrink-0 text-teal" />
          {VAULT_NOTE}
        </div>
        {state.signIns.length === 0 ? (
          <EmptyState icon={<KeyRound size={22} />} title="No sign-ins yet" body="Add the PracticeSuite sign-in your automations should use." />
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-canvas text-left text-xs font-semibold text-body">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Used by</th>
                </tr>
              </thead>
              <tbody>
                {state.signIns.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-6 py-4 font-medium text-ink">{s.label}</td>
                    <td className="px-4 py-4 text-ink">{s.user}</td>
                    <td className="px-4 py-4 text-body">{usedBy(s.id) === 1 ? '1 automation' : `${usedBy(s.id)} automations`}</td>
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

import { useState } from 'react';
import type { Automation, ScreenId } from '../domain/types';
import { useStore } from '../state/store';
import { Button, Field, inputCls, Modal } from '../shell/ui';

/** Which synthetic screen a starting URL lands on. */
const guessScreen = (url: string): ScreenId =>
  /log[-_]?in|sign[-_]?in|auth/i.test(url) ? 'signin' : /payment|era|remit/i.test(url) ? 'payments' : /patient/i.test(url) ? 'patients' : 'balances';

/** A workflow starts as a name and a page. Signing in, reading, and where files go are all steps. */
export function NewWorkflow() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const create = () => {
    const startUrl = url.trim() || 'https://demo.practicesuite.test/login';
    const automation: Automation = {
      id: `auto-${Date.now().toString(36)}`,
      name: name.trim() || 'New workflow',
      createdBy: 'Diane Keller',
      startUrl,
      credId: '',
      destination: '',
      screen: guessScreen(startUrl),
      steps: [],
      edges: [],
      status: 'never',
      lastRun: 'Never run',
    };
    dispatch({ type: 'upsertAutomation', automation });
    dispatch({ type: 'go', view: { name: 'builder', id: automation.id, start: 'describe' } });
  };

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
        onClose={() => setOpen(false)}
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
          <Field label="Starting URL" hint="Signing in, what to do on the page, and where files go are added as steps next.">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className={`${inputCls} text-body`} />
          </Field>
          <div className="mt-1.5 flex justify-end gap-2.5">
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary">
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

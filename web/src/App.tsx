import { Check, CloudOff, Loader2, RotateCcw, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { AutomationsList } from './pages/AutomationsList';
import { Builder } from './pages/builder/Builder';
import { Files } from './pages/Files';
import { HouseRules } from './pages/HouseRules';
import { RunHistory } from './pages/RunHistory';
import { Setup } from './pages/Setup';
import { SignIns } from './pages/SignIns';
import { usePersistence } from './state/persistence';
import { Rail } from './shell/Rail';
import { Button, Modal, Toggle } from './shell/ui';
import { StoreProvider, useStore } from './state/store';

function SaveChip() {
  const { state } = useStore();
  if (state.save === 'offline') {
    return (
      <span className="flex items-center gap-1.5 text-muted" title="The runner on this computer is not reachable. Changes stay in this window.">
        <CloudOff size={14} /> Not saving right now
      </span>
    );
  }
  if (state.save === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-muted">
        <Loader2 size={14} className="animate-spin" /> Saving…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <Check size={14} className="text-teal" /> Saved
    </span>
  );
}

function DemoBar() {
  const { state, dispatch } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="flex h-9 shrink-0 items-center justify-end gap-3 border-b border-line bg-white px-6 text-[13px]">
      <span className="text-muted">Synthetic practice · no live data</span>
      <span className="mr-auto pl-3">
        <SaveChip />
      </span>
      <button onClick={() => setConfirmReset(true)} className="flex items-center gap-1.5 rounded px-2 py-1 text-body hover:bg-canvas">
        <RotateCcw size={13} />
        Reset demo
      </button>
      <span className="h-4 border-l border-line" />
      <span className={`flex items-center gap-1.5 ${state.mutated ? 'font-semibold text-amber' : 'text-body'}`}>
        <Shuffle size={14} />
        Change the screen
      </span>
      <Toggle on={state.mutated} onChange={() => dispatch({ type: 'toggleMutated' })} label="Change the screen" />

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset the demo?"
        subtitle="Automations, house rules, sign-ins and run history go back to where they started, and the screen change is turned off. Kept files stay on this computer."
        width={500}
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmReset(false)}>Keep things as they are</Button>
          <Button
            variant="primary"
            onClick={() => {
              setConfirmReset(false);
              dispatch({ type: 'reset' });
            }}
          >
            <RotateCcw size={14} /> Reset demo
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Persist() {
  const { state, dispatch } = useStore();
  usePersistence(state, dispatch);
  return null;
}

function Workspace() {
  const { state } = useStore();
  const v = state.view;
  switch (v.name) {
    case 'list':
      return <AutomationsList />;
    case 'setup':
      return <Setup start={v.start} />;
    case 'builder':
      return <Builder key={`${v.id}-${state.resets}`} id={v.id} start={v.start} />;
    case 'rules':
      return <HouseRules />;
    case 'history':
      return <RunHistory />;
    case 'files':
      return <Files />;
    case 'signins':
      return <SignIns />;
  }
}

export default function App() {
  return (
    <StoreProvider>
      <Persist />
      <div className="flex h-screen overflow-hidden">
        <Rail />
        <main className="flex min-w-0 flex-1 flex-col">
          <DemoBar />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Workspace />
          </div>
        </main>
      </div>
    </StoreProvider>
  );
}

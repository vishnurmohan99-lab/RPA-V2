import { AlertTriangle, ArrowLeft, Circle, FlaskConical, Play, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ACTIONS, makeStep, reword } from '../../domain/actions';
import { isConfident, pct, resolveIn, SCORES, type Match } from '../../domain/binder';
import { recordStep } from '../../domain/recorder';
import type { Automation, Kind, ScreenId, Step } from '../../domain/types';
import { useStore } from '../../state/store';
import { useToast } from '../../shell/Toast';
import { Button, Modal, StatusPill } from '../../shell/ui';
import { TenantFrame, type TenantHighlight } from '../../tenant/TenantFrame';
import { ChatPane } from './ChatPane';
import { ApprovalModal, AttentionPanel, InspectBar, RecordBar, ResultPanel } from './panels';
import { PreflightProbe } from './Preflight';
import { StepList } from './StepList';
import { useRunner } from './useRunner';

type Start = 'describe' | 'record' | 'scratch';

export function Builder({ id, start }: { id: string; start?: Start }) {
  const { state, dispatch } = useStore();
  const automation = state.automations.find((a) => a.id === id);
  if (!automation) {
    return (
      <div className="p-10 text-body">
        That automation is not here any more.{' '}
        <button className="font-semibold text-teal" onClick={() => dispatch({ type: 'go', view: { name: 'list' } })}>
          Back to automations
        </button>
      </div>
    );
  }
  return <BuilderInner key={id} automation={automation} start={start} />;
}

type Pick = { for: 'step'; id: string } | { for: 'stop' } | null;

function BuilderInner({ automation, start }: { automation: Automation; start?: Start }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [screen, setScreen] = useState<ScreenId>(start === 'record' ? 'patients' : automation.screen);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [root, setRootState] = useState<HTMLDivElement | null>(null);
  const setRoot = useCallback((el: HTMLDivElement | null) => {
    rootRef.current = el;
    setRootState(el);
  }, []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [recording, setRecording] = useState(start === 'record');
  const [recordPrompt, setRecordPrompt] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [failing, setFailing] = useState<string[]>([]);
  const [confirmRun, setConfirmRun] = useState(false);
  const [runIn, setRunIn] = useState<'screen' | 'browser'>('screen');

  const save = useCallback((a: Automation) => dispatch({ type: 'upsertAutomation', automation: a }), [dispatch]);
  const latest = useRef(automation);
  latest.current = automation;
  const setSteps = (steps: Step[]) => save({ ...latest.current, steps });
  const markFresh = (ids: string[]) => {
    setFresh(new Set(ids));
    setTimeout(() => setFresh(new Set()), 400 + ids.length * 160);
  };

  const runner = useRunner({
    automation,
    rules: state.rules,
    getRoot: () => rootRef.current,
    screen,
    setScreen,
    saveAutomation: save,
    addRun: (r) => dispatch({ type: 'addRun', run: r }),
  });

  const selected = automation.steps.find((s) => s.id === selectedId) ?? null;

  // Intervene: show what the selected step points at, before any run.
  const [inspect, setInspect] = useState<Match<HTMLElement> | null | undefined>(undefined);
  useEffect(() => {
    if (runner.phase !== 'idle' && runner.phase !== 'dryDone' && runner.phase !== 'done') return setInspect(undefined);
    if (!selected || ACTIONS[selected.verb].resolves !== 'screen' || !selected.bind) return setInspect(undefined);
    if (selected.verb !== 'open' && selected.screen && selected.screen !== screen) {
      setScreen(selected.screen);
      return;
    }
    if (!root) return;
    const t = setTimeout(() => setInspect(resolveIn(root, selected.bind!, ACTIONS[selected.verb].kinds).best), 40);
    return () => clearTimeout(t);
  }, [selected?.id, selected?.bind, selected?.verb, screen, state.mutated, root, runner.phase]);

  const running = runner.phase !== 'idle' && runner.phase !== 'dryDone' && runner.phase !== 'done';

  const highlight: TenantHighlight | null = running
    ? runner.highlight
    : inspect
      ? { label: inspect.label, kind: inspect.kind, tone: isConfident(inspect) ? 'teal' : 'red', caption: `${inspect.label} · ${pct(inspect.s)}% sure` }
      : null;

  const pickKinds: Kind[] | undefined =
    pick?.for === 'step'
      ? ACTIONS[automation.steps.find((s) => s.id === pick.id)?.verb ?? 'click'].kinds
      : pick?.for === 'stop' && runner.stop
        ? ACTIONS[automation.steps[runner.stop.index].verb].kinds
        : undefined;

  const onPick = (label: string, kind: Kind) => {
    if (pick?.for === 'stop') {
      setPick(null);
      runner.answer(label);
      toast.show('Saved');
      return;
    }
    if (pick?.for === 'step') {
      const step = latest.current.steps.find((s) => s.id === pick.id);
      setPick(null);
      if (!step) return;
      setSteps(latest.current.steps.map((s) => (s.id === step.id ? reword({ ...s, bind: label, lastBoundTo: label, confidence: SCORES.exact, screen: s.verb === 'open' ? s.screen : screen }) : s)));
      setSelectedId(step.id);
      toast.show('Saved');
      return;
    }
    if (recording) {
      if (kind === 'field') {
        setRecordPrompt(label);
        return;
      }
      const step = recordStep(label, kind, screen);
      setSteps([...latest.current.steps, step]);
      markFresh([step.id]);
      if ((kind === 'nav' || kind === 'screen') && step.screen) setScreen(step.screen);
    }
  };

  const onAdd = (verb: string) => {
    const def = ACTIONS[verb];
    const step = def.resolves === 'screen' ? { ...makeStep(verb, null, undefined, { screen }), sentence: '' } : makeStep(verb, null);
    setSteps([...latest.current.steps, step]);
    markFresh([step.id]);
    setSelectedId(step.id);
    if (def.resolves === 'screen') setPick({ for: 'step', id: step.id });
  };

  const showMe = (id: string) => {
    setPick(null);
    if (!running && runner.phase !== 'idle') runner.dismiss();
    setSelectedId(id);
  };

  const run = () => {
    setPick(null);
    setRecording(false);
    setSelectedId(null);
    if (!automation.cleanDryRun) setConfirmRun(true);
    else runner.start('run');
  };

  const dry = () => {
    setPick(null);
    setRecording(false);
    setSelectedId(null);
    runner.start('dry');
  };

  const mode = pick ? 'pick' : recording && !running ? 'record' : 'normal';

  return (
    <div className="flex h-[calc(100vh-37px)] flex-col">
      {/* top bar */}
      <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-3">
        <button aria-label="Back to automations" onClick={() => dispatch({ type: 'go', view: { name: 'list' } })} className="rounded-md p-1.5 text-muted hover:bg-canvas">
          <ArrowLeft size={18} />
        </button>
        <input
          value={automation.name}
          onChange={(e) => save({ ...automation, name: e.target.value })}
          aria-label="Automation name"
          className="min-w-0 max-w-sm flex-1 rounded-input border border-transparent px-2 py-1 text-lg font-semibold text-ink hover:border-line focus:border-teal focus:outline-none"
        />
        <StatusPill status={automation.status} />
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-[13px] text-body">
            Run in
            <select value={runIn} onChange={(e) => setRunIn(e.target.value as 'screen' | 'browser')} className="rounded-input border border-line bg-white px-2 py-1.5 text-[13px] text-ink">
              <option value="screen">This screen</option>
              <option value="browser" disabled>
                Real browser (needs the runner)
              </option>
            </select>
          </label>
          <Button
            size="sm"
            variant={recording ? 'secondary' : 'ghost'}
            disabled={running}
            onClick={() => {
              setPick(null);
              setRecording((r) => !r);
            }}
          >
            <Circle size={12} className={recording ? 'fill-red text-red' : 'text-red'} />
            {recording ? 'Recording' : 'Show me how'}
          </Button>
          {running ? (
            <Button size="sm" onClick={runner.cancel}>
              <Square size={13} /> Stop
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={dry} disabled={automation.steps.length === 0}>
                <FlaskConical size={14} /> Dry run
              </Button>
              <Button size="sm" variant="primary" onClick={run} disabled={automation.steps.length === 0}>
                <Play size={14} /> Run
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(240px,300px)_minmax(300px,380px)_minmax(520px,1fr)] gap-4 overflow-x-auto bg-canvas p-4">
        <ChatPane
          steps={automation.steps}
          start={start}
          disabled={running}
          onSteps={(steps, added) => {
            setSteps(steps);
            markFresh(added);
          }}
        />

        <section className="flex min-h-0 flex-col rounded-card border border-line bg-white">
          <div className="border-b border-line px-4 py-3">
            <div className="text-sm font-semibold text-ink">Steps</div>
            <div className="text-xs text-muted">One sentence each. Drag to reorder, click to see what it points at.</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {failing.length > 0 && !running && (
              <div className="mb-3 flex items-start gap-2 rounded-card border border-amber/30 bg-amber-bg px-3 py-2.5 text-[13px] text-ink">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" />
                <div className="flex-1">
                  The screen has changed since this was built. {failing.length === 1 ? '1 step needs' : `${failing.length} steps need`} a look.
                  <button className="ml-1 font-semibold text-amber underline" onClick={() => showMe(failing[0])}>
                    Show me
                  </button>
                </div>
              </div>
            )}
            {automation.steps.length === 0 && (
              <div className="mb-3 rounded-card border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">
                No steps yet. Describe what you do, click “Show me how”, or add a step.
              </div>
            )}
            <StepList
              steps={automation.steps}
              onChange={setSteps}
              selectedId={selectedId}
              onSelect={showMe}
              onShowMe={showMe}
              onAdd={onAdd}
              states={runner.states}
              activeId={runner.activeId}
              fresh={fresh}
              failing={new Set(failing)}
              locked={running}
              onToast={toast.show}
              pickerOpen={start === 'scratch'}
            />
          </div>
        </section>

        <section className="flex min-h-0 flex-col gap-3">
          {recording && !running && <RecordBar prompt={recordPrompt} onStop={() => setRecording(false)} onCancelPrompt={() => setRecordPrompt(null)} onPrompt={(v) => {
            const step = recordStep(recordPrompt!, 'field', screen, v);
            setSteps([...latest.current.steps, step]);
            markFresh([step.id]);
            setRecordPrompt(null);
          }} />}
          <div className="min-h-0 flex-1">
            <TenantFrame
              screen={screen}
              mutated={state.mutated}
              highlight={highlight}
              mode={mode}
              pickKinds={pickKinds}
              onPick={onPick}
              onNavigate={setScreen}
              rootRef={setRoot}
              rowMarks={runner.marks}
              rowNotes={runner.notes}
              uploaded={runner.uploaded}
            />
          </div>

          {runner.phase === 'attention' && runner.stop && !pick && (
            <AttentionPanel
              stop={runner.stop}
              onYes={() => {
                runner.answer(runner.stop!.best!.label);
                toast.show('Saved. Carrying on');
              }}
              onPoint={() => setPick({ for: 'stop' })}
              onNotNow={runner.notNow}
            />
          )}

          {(pick || (!running && selected && runner.phase === 'idle')) && (
            <InspectBar
              match={pick ? null : inspect}
              picking={!!pick}
              onPointAt={() => selected && setPick({ for: 'step', id: selected.id })}
              onCancelPick={() => setPick(null)}
            />
          )}

          {runner.phase === 'dryDone' && runner.result && (
            <ResultPanel tone="dry" title="Dry run" sentence={runner.result.sentence} note="Preview only. Nothing downloaded and nothing left the browser." onClose={runner.dismiss} />
          )}
          {runner.phase === 'done' && runner.result && (
            <ResultPanel
              tone="done"
              title="Run finished"
              sentence={runner.result.sentence}
              note="The file is also kept on this computer under Files."
              onClose={runner.dismiss}
              action={
                <Button size="sm" onClick={() => dispatch({ type: 'go', view: { name: 'history' } })}>
                  Run history
                </Button>
              }
            />
          )}
        </section>
      </div>

      {runner.phase === 'approval' && runner.approval && <ApprovalModal approval={runner.approval} onApprove={runner.approve} onDecline={runner.decline} />}

      <Modal open={confirmRun} onClose={() => setConfirmRun(false)} title="Try a dry run first?" subtitle="A dry run shows you exactly what would happen, and nothing leaves the browser." width={460}>
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => {
              setConfirmRun(false);
              runner.start('run');
            }}
          >
            Run anyway
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setConfirmRun(false);
              runner.start('dry');
            }}
          >
            <FlaskConical size={14} /> Dry run
          </Button>
        </div>
      </Modal>

      <PreflightProbe steps={automation.steps} mutated={state.mutated} onResult={setFailing} />
      {toast.node}
    </div>
  );
}

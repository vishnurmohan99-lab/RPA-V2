import { useCallback, useEffect, useRef, useState } from 'react';
import { ACTIONS, makeStep, reword } from '../../domain/actions';
import { isConfident, pct, resolveIn, SCORES, type Match } from '../../domain/binder';
import { addBranch, edgesOf, insertAfter, layout, orderSteps, removeNode, syncOrder, type Graph } from '../../domain/flow';
import { parser } from '../../domain/parser';
import { recordStep } from '../../domain/recorder';
import type { Automation, Kind, ScreenId, Step } from '../../domain/types';
import { useStore } from '../../state/store';
import { useToast } from '../../shell/Toast';
import { Button, Modal } from '../../shell/ui';
import { TenantFrame, type TenantHighlight } from '../../tenant/TenantFrame';
import { ChatPane } from './ChatPane';
import { FlowCanvas, type PlusMenu } from './FlowCanvas';
import { ManualPicker } from './ManualPicker';
import { AdjustPanel, ApprovalModal, RecordStrip, RunBar } from './panels';
import { PreflightProbe } from './Preflight';
import { RunLogs } from './RunLogs';
import { useRunner } from './useRunner';

type Start = 'describe' | 'record' | 'scratch';

export function Builder({ id, start }: { id: string; start?: Start }) {
  const { state, dispatch } = useStore();
  const automation = state.automations.find((a) => a.id === id);
  if (!automation) {
    return (
      <div className="p-10 text-body">
        That workflow is not here any more.{' '}
        <button className="font-semibold text-teal" onClick={() => dispatch({ type: 'go', view: { name: 'list' } })}>
          Back to workflows
        </button>
      </div>
    );
  }
  return <BuilderInner key={id} automation={automation} start={start} />;
}

type Pick = { for: 'step'; id: string } | { for: 'stop' } | null;

const HEADER_BTN = 'rounded-card border border-line bg-white px-3.5 py-2 text-[12.5px] text-body hover:bg-canvas disabled:opacity-50';

function BuilderInner({ automation, start }: { automation: Automation; start?: Start }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<'steps' | 'logs'>('steps');
  const [mode, setMode] = useState<'ai' | 'manual'>(start === 'scratch' ? 'manual' : 'ai');
  const [screen, setScreen] = useState<ScreenId>(automation.screen);
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
  const [insertAt, setInsertAt] = useState<string | null>(null);
  const [plusMenu, setPlusMenu] = useState<PlusMenu | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [failing, setFailing] = useState<string[]>([]);
  const [confirmRun, setConfirmRun] = useState(false);
  const [savedPill, setSavedPill] = useState(false);
  const [savedStep, setSavedStep] = useState<string | null>(null);

  const save = useCallback((a: Automation) => dispatch({ type: 'upsertAutomation', automation: a }), [dispatch]);
  const latest = useRef(automation);
  latest.current = automation;
  const graph = (): Graph => ({ steps: latest.current.steps, edges: edgesOf(latest.current) });
  const commit = (g: Graph) => save({ ...latest.current, steps: layout(g.steps, g.edges), edges: g.edges });
  const patch = (id: string, fn: (s: Step) => Step) => save({ ...latest.current, steps: latest.current.steps.map((s) => (s.id === id ? fn(s) : s)) });
  const markFresh = (ids: string[]) => {
    setFresh(new Set(ids));
    setTimeout(() => setFresh(new Set()), 400 + ids.length * 160);
  };

  const edges = edgesOf(automation);
  const ordered = orderSteps(automation.steps, edges);
  const defaultSignIn = state.signIns[0]?.label;

  // Older workflows have no wires or positions yet: give them a straight flow on first open.
  useEffect(() => {
    if (!automation.edges || automation.steps.some((s) => s.x === undefined)) commit(graph());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runner = useRunner({
    automation,
    rules: state.rules,
    signIns: state.signIns,
    getRoot: () => rootRef.current,
    screen,
    setScreen,
    saveAutomation: save,
    addRun: (r) => dispatch({ type: 'addRun', run: r }),
  });
  const running = runner.busy;

  const selected = automation.steps.find((s) => s.id === selectedId) ?? null;

  // Selecting a step jumps the browser to its screen and checks what it points at, before any run.
  const [inspect, setInspect] = useState<Match<HTMLElement> | null | undefined>(undefined);
  useEffect(() => {
    if (running || !selected || ACTIONS[selected.verb].resolves !== 'screen' || !selected.bind) return setInspect(undefined);
    if (selected.verb !== 'open' && selected.screen && selected.screen !== screen) {
      setScreen(selected.screen);
      return;
    }
    if (!root) return;
    const t = setTimeout(() => setInspect(resolveIn(root, selected.bind!, ACTIONS[selected.verb].kinds).best), 40);
    return () => clearTimeout(t);
  }, [selected?.id, selected?.bind, selected?.verb, screen, state.mutated, root, running]);

  const highlight: TenantHighlight | null = running
    ? runner.highlight
    : inspect
      ? { label: inspect.label, kind: inspect.kind, tone: isConfident(inspect) ? 'teal' : 'amber', caption: `${pct(inspect.s)}% sure` }
      : null;

  const stopStep = runner.stop ? (ordered[runner.stop.index] ?? null) : null;
  const pickKinds: Kind[] | undefined =
    pick?.for === 'step'
      ? ACTIONS[automation.steps.find((s) => s.id === pick.id)?.verb ?? 'click'].kinds
      : pick?.for === 'stop' && stopStep
        ? ACTIONS[stopStep.verb].kinds
        : undefined;

  const place = (step: Step) => {
    const g = graph();
    commit(insertAfter(g.steps, g.edges, insertAt, step));
    setInsertAt(step.id);
    setSelectedId(step.id);
    markFresh([step.id]);
  };

  const split = (afterId: string | null) => {
    const gate = makeStep('branch', null, 'Balance is over $25');
    const yes = makeStep('note', null, 'Send the statement.', { tag: 'Then' });
    const no = makeStep('note', null, 'Skip this patient and note why.', { tag: 'Otherwise' });
    const g = graph();
    commit(addBranch(g.steps, g.edges, afterId, gate, yes, no));
    setSelectedId(gate.id);
    setInsertAt(yes.id);
    setPlusMenu(null);
    markFresh([gate.id, yes.id, no.id]);
  };

  const addVerb = (verb: string) => {
    if (verb === 'branch') return split(insertAt ?? ordered[ordered.length - 1]?.id ?? null);
    if (verb === 'signin') {
      // A sign-in step always points at the sign-in page's button; Diane only picks which saved sign-in to use.
      place(makeStep('signin', 'Sign in', defaultSignIn, { screen: 'signin' }));
      setRecording(false);
      setScreen('signin');
      return;
    }
    const def = ACTIONS[verb];
    const step = def.resolves === 'screen' ? { ...makeStep(verb, null, undefined, { screen }), sentence: '' } : makeStep(verb, null);
    place(step);
    if (def.resolves === 'screen') {
      setRecording(false);
      setPick({ for: 'step', id: step.id });
    }
  };

  const remove = (id: string) => {
    const g = graph();
    commit(removeNode(g.steps, g.edges, id));
    if (selectedId === id) setSelectedId(null);
    if (insertAt === id) setInsertAt(null);
  };

  const selectStep = (id: string | null) => {
    setPlusMenu(null);
    setPick(null);
    setSavedStep(null);
    if (runner.phase === 'dryDone' || runner.phase === 'done') runner.dismiss();
    setSelectedId(id);
    if (id) setInsertAt(id);
  };

  const onPick = (label: string, kind: Kind) => {
    if (pick?.for === 'stop') {
      setPick(null);
      runner.answer(label);
      toast.show('Saved. Carrying on');
      return;
    }
    if (pick?.for === 'step') {
      const id = pick.id;
      setPick(null);
      patch(id, (s) => reword({ ...s, bind: label, lastBoundTo: label, confidence: SCORES.exact, screen: s.verb === 'open' ? s.screen : screen }));
      setSelectedId(id);
      setSavedStep(id);
      return;
    }
    if (recording) {
      if (kind === 'field') {
        setRecordPrompt(label);
        return;
      }
      const isSignIn = kind === 'button' && /^sign in$/i.test(label);
      const step = recordStep(label, kind, screen, isSignIn ? defaultSignIn : undefined);
      place(step);
      if (isSignIn) setScreen('patients');
      if ((kind === 'nav' || kind === 'screen') && step.screen) setScreen(step.screen);
    }
  };

  const onReword = (text: string) => {
    if (!selected) return;
    const t = text.trim();
    if (!t || t === selected.sentence) return;
    const guess = parser.parse(t, [], { signIns: state.signIns.map((s) => s.label) }).steps.filter((s) => s.verb === selected.verb);
    patch(selected.id, (s) => (guess.length === 1 ? reword({ ...s, bind: guess[0].bind ?? s.bind, value: guess[0].value ?? s.value }) : { ...s, sentence: t }));
    setSavedStep(selected.id);
  };

  const clearForRun = () => {
    setPick(null);
    setRecording(false);
    setPlusMenu(null);
    setSelectedId(null);
  };

  const run = () => {
    clearForRun();
    if (!automation.cleanDryRun) setConfirmRun(true);
    else runner.start('run');
  };

  const dry = () => {
    clearForRun();
    runner.start('dry');
  };

  const saveNow = () => {
    save({ ...latest.current });
    setSavedPill(true);
    setTimeout(() => setSavedPill(false), 2200);
  };

  const openStep = (stepId: string | null) => {
    setTab('steps');
    selectStep(stepId && automation.steps.some((s) => s.id === stepId) ? stepId : (failing[0] ?? ordered.find((s) => ACTIONS[s.verb].resolves === 'screen')?.id ?? null));
  };

  const n = automation.steps.length;
  const selIdx = selected ? ordered.findIndex((s) => s.id === selected.id) : -1;
  const stepCountLine =
    n === 0
      ? 'No steps yet'
      : `${n} ${n === 1 ? 'step' : 'steps'} · ${selected ? (selIdx >= 0 ? `checking step ${selIdx + 1}` : 'checking a step off the main path') : 'nothing selected'}`;
  const insertIdx = insertAt ? ordered.findIndex((s) => s.id === insertAt) : -1;
  const insertNote = insertIdx >= 0 ? `Lands after step ${insertIdx + 1}` : 'Lands at the end of the flow';
  const doneCount = Object.values(runner.states).filter((s) => s === 'done' || s === 'previewed').length;
  const current = ordered.find((s) => s.id === runner.activeId) ?? null;
  const runs = state.history.filter((r) => r.automationId === automation.id);

  const frameMode = pick ? 'pick' : recording && !running ? 'record' : 'normal';
  const badge = pick ? (
    <span className="whitespace-nowrap text-[11.5px] font-semibold text-amber">Picking mode</span>
  ) : recording && !running ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#FECDCA] bg-[#FEF3F2] px-[9px] py-[3px] text-[11px] font-bold text-[#B42318]">
      <span className="block h-[7px] w-[7px] animate-pulse rounded-full bg-[#D92D20]" />
      Recording
    </span>
  ) : (
    <span className="whitespace-nowrap text-[11.5px] font-semibold text-teal">Live view</span>
  );

  const flowHeader = (
    <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line bg-white px-[18px] py-[13px]">
      <div className="text-xs font-semibold text-body">Flow</div>
      {failing.length > 0 && !running ? (
        <button onClick={() => selectStep(failing[0])} className="text-xs font-semibold text-amber hover:underline">
          The screen has changed — {failing.length === 1 ? '1 step needs' : `${failing.length} steps need`} a look
        </button>
      ) : (
        <div className="text-xs text-[#98A2B3]">Drag to move · + to add a step · ⑂ to split</div>
      )}
    </div>
  );

  const empty = (
    <div className="max-w-[300px] rounded-[10px] border border-dashed border-[#D0D5DD] bg-white p-[22px] text-center text-[12.5px] leading-[1.6] text-muted">
      No steps yet. Describe what you do on the left, or switch to adding them yourself — each one lands here as a node you can drag.
      <div className="mt-3 flex justify-center gap-2">
        <button className="rounded-card border border-line px-3 py-1.5 text-xs font-semibold text-[#344054] hover:bg-canvas" onClick={() => setMode('manual')}>
          Add steps myself
        </button>
        <button
          className="rounded-card border border-line px-3 py-1.5 text-xs font-semibold text-teal hover:bg-canvas"
          onClick={() => {
            setPick(null);
            setRecording(true);
          }}
        >
          Click the interface
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <div className="px-6 pt-[18px]">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => dispatch({ type: 'go', view: { name: 'list' } })} className="rounded-card border border-line bg-white px-3 py-[7px] text-[12.5px] text-body hover:bg-canvas">
            ← Workflows
          </button>
          <div className="min-w-0 flex-1">
            <input
              value={automation.name}
              onChange={(e) => save({ ...automation, name: e.target.value })}
              aria-label="Workflow name"
              className="-ml-1 w-full max-w-md rounded-md border border-transparent bg-transparent px-1 text-[17px] font-bold text-ink hover:border-line focus:border-teal focus:bg-white focus:outline-none"
            />
            <div className="mt-0.5 text-[12.5px] text-muted">{stepCountLine}</div>
          </div>
          {tab === 'steps' && (
            <button className={HEADER_BTN} disabled={running} onClick={() => setMode((m) => (m === 'ai' ? 'manual' : 'ai'))}>
              {mode === 'ai' ? 'Add steps myself' : 'Ask the assistant'}
            </button>
          )}
          {savedPill && (
            <span className="inline-flex animate-card-in items-center gap-1.5 rounded-full border border-[#ABEFC6] bg-[#ECFDF3] px-[11px] py-[5px] text-[11.5px] font-semibold text-[#067647]">
              ✓ Saved
            </span>
          )}
          <button className={`${HEADER_BTN} font-semibold text-[#344054]`} onClick={saveNow}>
            Save
          </button>
          {running ? (
            <button className={HEADER_BTN} onClick={runner.cancel}>
              Stop
            </button>
          ) : (
            <>
              <button className={HEADER_BTN} disabled={n === 0} onClick={dry}>
                Dry run
              </button>
              <button className="rounded-card bg-teal px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-teal-dark disabled:opacity-50" disabled={n === 0} onClick={run}>
                Run
              </button>
            </>
          )}
        </div>
        <div className="mt-4 flex gap-[22px] border-b border-line">
          {(['steps', 'logs'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`bg-transparent px-0.5 pb-3 pt-2.5 text-[13px] font-semibold ${tab === t ? 'text-teal shadow-[inset_0_-2px_0_0_#0E7C6B]' : 'text-muted'}`}
            >
              {t === 'steps' ? 'Steps' : 'Run logs'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'logs' ? (
        <RunLogs runs={runs} onOpenStep={openStep} />
      ) : (
        <div className="grid flex-1 grid-cols-[minmax(240px,340px)_minmax(0,1fr)]">
          <div className="flex h-[560px] min-w-0 flex-col border-r border-line bg-white">
            {mode === 'ai' ? (
              <ChatPane
                steps={ordered}
                signIns={state.signIns.map((s) => s.label)}
                disabled={running}
                onSteps={(next, added) => {
                  const g = graph();
                  commit(syncOrder(g.steps, g.edges, next));
                  markFresh(added);
                }}
              />
            ) : (
              <ManualPicker insertNote={insertNote} onPick={addVerb} disabled={running} />
            )}
          </div>

          <FlowCanvas
            steps={automation.steps}
            edges={edges}
            ordered={ordered}
            selectedId={selectedId}
            states={runner.states}
            activeId={runner.activeId}
            phase={runner.phase}
            failing={new Set(failing)}
            fresh={fresh}
            locked={running}
            plusMenu={plusMenu}
            header={flowHeader}
            empty={empty}
            onSelect={selectStep}
            onRemove={remove}
            onMove={(id, x, y) => patch(id, (s) => ({ ...s, x, y, moved: true }))}
            onPlus={setPlusMenu}
            onBranch={split}
            onPlusManual={() => {
              setMode('manual');
              setInsertAt(plusMenu?.afterId ?? null);
              setRecording(false);
              setPlusMenu(null);
            }}
            onPlusRecord={() => {
              setInsertAt(plusMenu?.afterId ?? null);
              setPick(null);
              setSelectedId(null);
              setRecording(true);
              setPlusMenu(null);
            }}
            onPlusClose={() => setPlusMenu(null)}
          />

          <div className="col-span-2 flex flex-col gap-3.5 bg-[#F2F4F7] p-4">
            <RunBar
              phase={runner.phase}
              mode={runner.mode}
              total={ordered.length}
              done={doneCount}
              current={current}
              stop={runner.stop}
              result={runner.result}
              picking={pick?.for === 'stop'}
              onStop={runner.cancel}
              onYes={() => {
                if (runner.stop?.best) runner.answer(runner.stop.best.label);
                toast.show('Saved. Carrying on');
              }}
              onPoint={() => setPick({ for: 'stop' })}
              onNotNow={runner.notNow}
              onClose={runner.dismiss}
              onLogs={() => {
                runner.dismiss();
                setTab('logs');
              }}
            />
            {recording && !running && (
              <RecordStrip
                prompt={recordPrompt}
                onDone={() => {
                  setRecording(false);
                  setRecordPrompt(null);
                }}
                onCancelPrompt={() => setRecordPrompt(null)}
                onPrompt={(v) => {
                  place(recordStep(recordPrompt!, 'field', screen, v));
                  setRecordPrompt(null);
                }}
              />
            )}
            <div className="h-[520px]">
              <TenantFrame
                screen={screen}
                url={screen === 'signin' && automation.startUrl ? automation.startUrl : undefined}
                mutated={state.mutated}
                highlight={highlight}
                mode={frameMode}
                pickKinds={pickKinds}
                onPick={onPick}
                onNavigate={setScreen}
                rootRef={setRoot}
                rowMarks={runner.marks}
                rowNotes={runner.notes}
                uploaded={runner.uploaded}
                signIn={runner.signedIn}
                badge={badge}
              />
            </div>
            <AdjustPanel
              step={pick?.for === 'stop' ? stopStep : selected}
              match={inspect}
              picking={!!pick}
              saved={!!selected && savedStep === selected.id}
              locked={running}
              signIns={state.signIns}
              onPointAt={() => selected && setPick({ for: 'step', id: selected.id })}
              onCancelPick={() => setPick(null)}
              onReword={onReword}
              onValue={(v) => {
                if (!selected) return;
                patch(selected.id, (s) => reword({ ...s, value: v }));
                setSavedStep(selected.id);
              }}
            />
          </div>
        </div>
      )}

      {runner.phase === 'approval' && runner.approval && <ApprovalModal approval={runner.approval} onApprove={runner.approve} onDecline={runner.decline} />}

      <Modal open={confirmRun} onClose={() => setConfirmRun(false)} title="Try a dry run first?" subtitle="A dry run shows you exactly what would happen, and nothing leaves the browser." width={460}>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            onClick={() => {
              setConfirmRun(false);
              runner.start('run');
            }}
          >
            Run anyway
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setConfirmRun(false);
              runner.start('dry');
            }}
          >
            Dry run
          </Button>
        </div>
      </Modal>

      <PreflightProbe steps={automation.steps} mutated={state.mutated} onResult={setFailing} />
      {toast.node}
    </div>
  );
}

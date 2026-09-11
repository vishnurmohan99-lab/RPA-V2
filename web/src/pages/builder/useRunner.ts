import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { ACTIONS, reword } from '../../domain/actions';
import { isConfident, pct, resolveIn, type Match, type Resolution } from '../../domain/binder';
import { parseCondition } from '../../domain/conditions';
import { fileNameFor, saveBlob, toCsv } from '../../domain/csv';
import { applyRules, money, total } from '../../domain/houseRules';
import { narrate, type RunSummary } from '../../domain/narrative';
import {
  approveLabel,
  attentionQuestion,
  buildCsv,
  describeRow,
  edgeSteps,
  nowLabel,
  readColumn,
  RECORDS,
  rowIds,
  SCREEN_BY_LABEL,
  sleep,
  TICK,
} from '../../domain/runner';
import type { Automation, HouseRuleState, RunRecord, ScreenId, Step } from '../../domain/types';
import type { RowMark, TenantHighlight } from '../../tenant/TenantFrame';

export type RunMode = 'dry' | 'run';
export type Phase = 'idle' | 'running' | 'attention' | 'approval' | 'dryDone' | 'done';
export type StepState = 'active' | 'done' | 'attention' | 'previewed';

export interface StopInfo {
  index: number;
  stepId: string;
  want: string;
  best: Match<HTMLElement> | null;
  labels: string[];
  question: string;
}

export interface HeldRow {
  id: string;
  name: string;
  amount: string;
  why: string;
}

export interface Approval {
  read: number;
  outOfScope: number;
  skipped: number;
  held: HeldRow[];
  kept: number;
  total: number;
  label: string;
  edges: string[];
  uploads: boolean;
}

interface Ctx {
  mode: RunMode;
  runId: string;
  read: number;
  outOfScope: number;
  inScope: string[] | null;
  ruled: boolean;
  kept: string[];
  skipped: { id: string; why: string }[];
  held: HeldRow[];
  reads: Map<string, Map<string, string>>;
  learned: { step: number; from: string; to: string }[];
  blob: Blob | null;
  fileName: string | null;
  fileId: string | null;
  sentTo: string[];
  resumeAt: number;
}

export interface RunnerOptions {
  automation: Automation;
  rules: HouseRuleState[];
  getRoot: () => HTMLElement | null;
  screen: ScreenId;
  setScreen: (s: ScreenId) => void;
  saveAutomation: (a: Automation) => void;
  addRun: (r: RunRecord) => void;
}

const freshCtx = (mode: RunMode): Ctx => ({
  mode,
  runId: `run-${Date.now().toString(36)}`,
  read: 0,
  outOfScope: 0,
  inScope: null,
  ruled: false,
  kept: [],
  skipped: [],
  held: [],
  reads: new Map(),
  learned: [],
  blob: null,
  fileName: null,
  fileId: null,
  sentTo: [],
  resumeAt: 0,
});

/** Drives an automation against the synthetic tenant, step by step, re-resolving every target by meaning. */
export function useRunner(options: RunnerOptions) {
  const opt = useRef(options);
  opt.current = options;

  const token = useRef(0);
  const ctx = useRef<Ctx>(freshCtx('dry'));
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<RunMode>('dry');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, StepState>>({});
  const [highlight, setHighlight] = useState<TenantHighlight | null>(null);
  const [marks, setMarks] = useState<Record<string, RowMark>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [uploaded, setUploaded] = useState<{ name: string; detail: string } | null>(null);
  const [stop, setStop] = useState<StopInfo | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [result, setResult] = useState<{ sentence: string; fileName: string | null } | null>(null);
  const stopRef = useRef<StopInfo | null>(null);
  stopRef.current = stop;

  useEffect(
    () => () => {
      token.current++;
    },
    [],
  );

  const mark = (id: string, s: StepState) => setStates((m) => ({ ...m, [id]: s }));

  const patchStep = (index: number, patch: Partial<Step>, rewordIt = false) => {
    const a = opt.current.automation;
    const steps = a.steps.map((s, k) => (k === index ? (rewordIt ? reword({ ...s, ...patch }) : { ...s, ...patch }) : s));
    const next = { ...a, steps };
    opt.current = { ...opt.current, automation: next };
    opt.current.saveAutomation(next);
  };

  const saveMeta = (patch: Partial<Automation>) => {
    const next = { ...opt.current.automation, ...patch };
    opt.current = { ...opt.current, automation: next };
    opt.current.saveAutomation(next);
  };

  const keptIds = (): string[] => {
    const c = ctx.current;
    if (c.ruled) return c.kept;
    const root = opt.current.getRoot();
    return c.inScope ?? (root ? rowIds(root) : []);
  };

  const keptTotal = () => total(keptIds().map((id) => RECORDS[id]).filter(Boolean));

  const record = (outcome: RunRecord['outcome'], narrative: string) => {
    const c = ctx.current;
    const a = opt.current.automation;
    opt.current.addRun({
      id: c.runId,
      automationId: a.id,
      automationName: a.name,
      when: nowLabel(),
      outcome,
      narrative,
      rowsRead: c.read,
      rowsKept: outcome === 'attention' ? 0 : keptIds().length,
      rowsSkipped: c.skipped.length,
      rowsHeld: c.held.length,
      fileProduced: c.mode === 'run' ? c.fileName : null,
      fileId: c.fileId,
    });
  };

  const summary = (approved: boolean): RunSummary => {
    const c = ctx.current;
    return {
      mode: c.mode,
      read: c.read,
      outOfScope: c.outOfScope,
      kept: keptIds().length,
      skipped: c.skipped.length,
      held: c.held.length,
      total: keptTotal(),
      approved,
      fileName: c.fileName,
      sentTo: c.sentTo,
      learned: c.learned,
    };
  };

  const halt = (index: number, step: Step, res: Resolution<HTMLElement>) => {
    const best = res.best;
    mark(step.id, 'attention');
    setHighlight(best ? { label: best.label, kind: best.kind, tone: 'red', caption: `${best.label} · ${pct(best.s)}% sure` } : null);
    setStop({
      index,
      stepId: step.id,
      want: step.bind ?? '',
      best,
      labels: [...new Set(res.all.map((m) => m.label))],
      question: attentionQuestion(step.bind ?? '', best),
    });
    setPhase('attention');
  };

  async function perform(step: Step, best: Match<HTMLElement>, root: HTMLElement) {
    const c = ctx.current;
    switch (step.verb) {
      case 'open': {
        const target = SCREEN_BY_LABEL[best.label];
        if (target && target !== opt.current.screen) {
          opt.current.setScreen(target);
          await sleep(TICK);
        }
        return;
      }
      case 'filter': {
        const vals = readColumn(root, best.label);
        if (!c.read) c.read = vals.size;
        const test = parseCondition(step.value ?? '');
        const before = c.inScope ?? [...vals.keys()];
        const pass = before.filter((id) => test(vals.get(id) ?? ''));
        const fail = before.filter((id) => !pass.includes(id));
        c.inScope = pass;
        c.outOfScope += fail.length;
        setMarks((m) => ({ ...m, ...Object.fromEntries(fail.map((id) => [id, 'out' as RowMark])) }));
        setNotes((n) => ({ ...n, ...Object.fromEntries(fail.map((id) => [id, 'Out of scope'])) }));
        return;
      }
      case 'read': {
        const vals = readColumn(root, best.label);
        c.reads.set(best.label, vals);
        if (!c.read) c.read = vals.size;
        return;
      }
      case 'table': {
        if (!c.read) c.read = rowIds(root).length;
        return;
      }
      case 'type':
      case 'choose':
      case 'date': {
        if (best.el instanceof HTMLInputElement && !best.el.readOnly) best.el.value = step.value ?? '';
        return;
      }
      default:
        return;
    }
  }

  async function applyHouseRules(t: number) {
    const c = ctx.current;
    const root = opt.current.getRoot();
    const all = root ? rowIds(root) : [];
    if (!c.read) c.read = all.length;
    const ids = c.inScope ?? all;
    c.ruled = true;
    for (const id of ids) {
      if (t !== token.current) return;
      const rec = RECORDS[id];
      const out = rec ? applyRules([rec], opt.current.rules) : { kept: [{ id }], skipped: [], held: [] };
      if (out.kept.length) {
        c.kept.push(id);
        setMarks((m) => ({ ...m, [id]: 'kept' }));
      } else if (out.skipped.length) {
        c.skipped.push({ id, why: out.skipped[0].why });
        setMarks((m) => ({ ...m, [id]: 'skipped' }));
        setNotes((n) => ({ ...n, [id]: out.skipped[0].why }));
      } else {
        c.held.push({ id, ...describeRow(id), why: out.held[0].why });
        setMarks((m) => ({ ...m, [id]: 'held' }));
        setNotes((n) => ({ ...n, [id]: out.held[0].why }));
      }
      await sleep(120);
    }
  }

  async function performEdge(step: Step, t: number) {
    const c = ctx.current;
    const a = opt.current.automation;
    switch (step.verb) {
      case 'download': {
        const ids = keptIds();
        c.kept = ids;
        c.ruled = true;
        const { headers, rows } = buildCsv(ids, c.reads);
        const name = fileNameFor(a.destination);
        const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv' });
        c.blob = blob;
        c.fileName = name;
        saveBlob(name, blob);
        try {
          c.fileId = (await api.keepFile(blob, name, a.id, c.runId)).id;
        } catch {
          c.fileId = null;
        }
        return;
      }
      case 'saveTo': {
        const dest = step.value ?? 'Billing share';
        if (c.fileId) await api.sendFile(c.fileId, dest).catch(() => null);
        c.sentTo.push(dest);
        return;
      }
      case 'upload': {
        const dest = step.value ?? 'Statement vendor portal';
        opt.current.setScreen('upload');
        await sleep(TICK);
        if (t !== token.current) return;
        const root = opt.current.getRoot();
        const res = root ? resolveIn(root, 'Statement file', ['upload']) : null;
        if (res?.best) {
          setHighlight({ label: res.best.label, kind: res.best.kind, tone: 'teal', caption: `${res.best.label} · ${pct(res.best.s)}% sure` });
          const input = res.best.el.querySelector('input[type=file]') as HTMLInputElement | null;
          if (input && c.blob && c.fileName) {
            try {
              const dt = new DataTransfer();
              dt.items.add(new File([c.blob], c.fileName, { type: 'text/csv' }));
              input.files = dt.files;
            } catch {
              /* the visible confirmation below is enough */
            }
          }
        }
        setUploaded({ name: c.fileName ?? 'statements.csv', detail: `${keptIds().length} rows · ${money(keptTotal())}` });
        if (c.fileId) await api.sendFile(c.fileId, dest).catch(() => null);
        c.sentTo.push(dest);
        return;
      }
      default:
        return;
    }
  }

  function finish() {
    const c = ctx.current;
    const kept = keptIds().length;
    const sum = keptTotal();
    if (c.mode === 'dry') {
      record('preview', narrate(summary(false)));
      saveMeta({ lastRun: nowLabel(), cleanDryRun: true, status: 'ready' });
      setResult({
        sentence: `I would put ${kept} rows totalling ${money(sum)} in the file. I'd skip ${c.skipped.length} by house rule and hold ${c.held.length} for you.`,
        fileName: null,
      });
      setPhase('dryDone');
    } else {
      record('clean', narrate(summary(true)));
      saveMeta({ lastRun: nowLabel(), status: 'ready' });
      const where = c.sentTo.length ? `, then sent it to ${c.sentTo.join(' and ')}` : '';
      setResult({
        sentence: `Done. I put ${kept} rows totalling ${money(sum)} into ${c.fileName ?? 'the file'}${where}. Nothing was written back into PracticeSuite.`,
        fileName: c.fileName,
      });
      setPhase('done');
    }
    setActiveId(null);
    setHighlight(null);
  }

  async function go(from: number) {
    const t = token.current;
    setPhase('running');
    for (let i = from; i < opt.current.automation.steps.length; i++) {
      if (t !== token.current) return;
      const step = opt.current.automation.steps[i];
      const def = ACTIONS[step.verb];
      setActiveId(step.id);
      mark(step.id, 'active');

      if (def.resolves === 'screen') {
        if (step.verb !== 'open' && step.screen && opt.current.screen !== step.screen) {
          opt.current.setScreen(step.screen);
        }
        await sleep(TICK / 2);
        if (t !== token.current) return;
        const root = opt.current.getRoot();
        const res: Resolution<HTMLElement> = root ? resolveIn(root, step.bind ?? '', def.kinds) : { best: null, all: [] };
        if (!isConfident(res.best)) {
          halt(i, step, res);
          return;
        }
        const best = res.best!;
        setHighlight({ label: best.label, kind: best.kind, tone: 'teal', caption: `${best.label} · ${pct(best.s)}% sure` });
        if (step.lastBoundTo !== best.label || step.confidence !== best.s) patchStep(i, { lastBoundTo: best.label, confidence: best.s });
        await perform(step, best, root!);
        await sleep(TICK);
      } else if (def.resolves === 'page') {
        setHighlight(null);
        if (step.verb === 'rules') {
          await applyHouseRules(t);
        } else if (step.verb === 'review') {
          if (ctx.current.mode === 'run') {
            mark(step.id, 'done');
            ctx.current.resumeAt = i + 1;
            const c = ctx.current;
            const steps = opt.current.automation.steps;
            setApproval({
              read: c.read,
              outOfScope: c.outOfScope,
              skipped: c.skipped.length,
              held: c.held,
              kept: keptIds().length,
              total: keptTotal(),
              label: approveLabel(steps),
              edges: edgeSteps(steps).map((s) => s.sentence),
              uploads: steps.some((s) => s.verb === 'upload'),
            });
            setPhase('approval');
            return;
          }
          await sleep(TICK);
        } else if (step.verb === 'pause') {
          await sleep(Math.min(Number(step.value) || 1, 3) * 1000);
        } else {
          await sleep(TICK / 2);
        }
      } else {
        if (ctx.current.mode === 'dry') {
          mark(step.id, 'previewed');
          await sleep(TICK / 2);
          continue;
        }
        await performEdge(step, t);
        await sleep(TICK / 2);
      }
      if (t !== token.current) return;
      mark(step.id, 'done');
    }
    finish();
  }

  const clearView = () => {
    setActiveId(null);
    setHighlight(null);
    setStop(null);
    setApproval(null);
  };

  const start = async (m: RunMode) => {
    token.current++;
    ctx.current = freshCtx(m);
    setMode(m);
    setStates({});
    setMarks({});
    setNotes({});
    setUploaded(null);
    setResult(null);
    clearView();
    setPhase('running');
    if (opt.current.automation.steps[0]?.verb === 'open') opt.current.setScreen('patients');
    await sleep(TICK / 2);
    go(0);
  };

  /** Diane confirmed (or pointed at) the right element. Learn it and carry on from that step. */
  const answer = (label: string) => {
    const s = stopRef.current;
    if (!s) return;
    const step = opt.current.automation.steps[s.index];
    ctx.current.learned.push({ step: s.index + 1, from: step.bind ?? '', to: label });
    patchStep(s.index, { bind: label, lastBoundTo: label, confidence: undefined }, true);
    setStop(null);
    go(s.index);
  };

  const notNow = () => {
    const s = stopRef.current;
    if (!s) return;
    record(
      'attention',
      narrate({ ...summary(false), stoppedAt: { step: s.index + 1, want: s.want, closest: s.best?.label ?? null, pct: pct(s.best?.s) } }),
    );
    saveMeta({ status: 'attention', lastRun: nowLabel() });
    token.current++;
    clearView();
    setPhase('idle');
  };

  const approve = () => {
    setApproval(null);
    go(ctx.current.resumeAt);
  };

  const decline = () => {
    record('stopped', narrate(summary(false)));
    token.current++;
    clearView();
    setPhase('idle');
  };

  const cancel = () => {
    token.current++;
    clearView();
    setStates({});
    setMarks({});
    setNotes({});
    setUploaded(null);
    setPhase('idle');
  };

  const dismiss = () => {
    setResult(null);
    setStates({});
    setMarks({});
    setNotes({});
    setPhase('idle');
  };

  return {
    phase,
    mode,
    activeId,
    states,
    highlight,
    marks,
    notes,
    uploaded,
    stop,
    approval,
    result,
    busy: phase === 'running' || phase === 'attention' || phase === 'approval',
    start,
    answer,
    notNow,
    approve,
    decline,
    cancel,
    dismiss,
  };
}

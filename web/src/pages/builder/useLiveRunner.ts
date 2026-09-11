import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import type { LogTone } from '../../domain/types';

export type LivePhase = 'idle' | 'connecting' | 'running' | 'attention' | 'approval' | 'dryDone' | 'done';

export interface LiveBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiveHighlight {
  box: LiveBox | null;
  label: string | null;
  s: number | null;
  tone: 'teal' | 'red' | 'amber';
}

export interface LiveAttention {
  stepId: string;
  want: string;
  bestLabel: string | null;
  bestPct: number | null;
  labels: string[];
  question: string;
}

export interface LiveApproval {
  read: number;
  outOfScope: number;
  skipped: number;
  held: { id: string; name: string; amount: string; why: string }[];
  kept: number;
  total: number;
  label: string;
  edges: string[];
}

export interface LiveLog {
  text: string;
  tone: LogTone;
}

/**
 * Watches a real-browser run over its WebSocket. Same shape of moving parts as the in-app
 * useRunner (phase, highlight, stop, approval, result) so the builder's controls read the
 * same either way — the difference is everything here reflects a real Playwright session on
 * the server rather than the synthetic tenant's DOM.
 */
export function useLiveRunner(automationId: string) {
  const [phase, setPhase] = useState<LivePhase>('idle');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [doneStepIds, setDoneStepIds] = useState<Set<string>>(new Set());
  const [highlight, setHighlight] = useState<LiveHighlight | null>(null);
  const [logs, setLogs] = useState<LiveLog[]>([]);
  const [attention, setAttention] = useState<LiveAttention | null>(null);
  const [approval, setApproval] = useState<LiveApproval | null>(null);
  const [result, setResult] = useState<{ sentence: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(
    () => () => {
      wsRef.current?.close();
    },
    [],
  );

  const closeSocket = () => {
    wsRef.current?.close();
    wsRef.current = null;
  };

  const start = async (mode: 'dry' | 'run') => {
    closeSocket();
    setPhase('connecting');
    setScreenshot(null);
    setActiveStepId(null);
    setDoneStepIds(new Set());
    setHighlight(null);
    setLogs([]);
    setAttention(null);
    setApproval(null);
    setResult(null);
    setPicking(false);
    try {
      const { runId } = await api.startLiveRun(automationId, mode);
      runIdRef.current = runId;
      setRunId(runId);
      const ws = new WebSocket(api.liveSocketUrl(runId));
      wsRef.current = ws;
      setPhase('running');
      ws.onmessage = (ev) => {
        const e = JSON.parse(ev.data);
        switch (e.type) {
          case 'screenshot':
            setScreenshot(e.dataUrl);
            break;
          case 'active':
            setActiveStepId(e.stepId);
            setHighlight(null);
            break;
          case 'stepDone':
            setDoneStepIds((s) => new Set(s).add(e.stepId));
            break;
          case 'highlight':
            setHighlight({ box: e.box, label: e.label, s: e.s, tone: e.tone });
            break;
          case 'log':
            setLogs((l) => [...l, { text: e.text, tone: e.tone }]);
            break;
          case 'attention':
            setAttention(e);
            setPhase('attention');
            break;
          case 'approval':
            setApproval(e);
            setPhase('approval');
            break;
          case 'done':
            setResult({ sentence: e.sentence });
            setPhase(e.mode === 'dry' ? 'dryDone' : 'done');
            break;
          case 'stopped':
            setResult({ sentence: e.sentence });
            setPhase('idle');
            break;
          case 'error':
            setLogs((l) => [...l, { text: e.message, tone: 'err' }]);
            setPhase('idle');
            break;
        }
      };
      ws.onerror = () => setLogs((l) => [...l, { text: "Lost the connection to the real browser.", tone: 'err' }]);
    } catch {
      setLogs([{ text: 'Could not start the real browser. Is the runner reachable?', tone: 'err' }]);
      setPhase('idle');
    }
  };

  const withRun = (fn: (runId: string) => void) => {
    if (runIdRef.current) fn(runIdRef.current);
  };

  const answer = (label: string) => {
    withRun((id) => api.liveAnswer(id, label));
    setAttention(null);
    setPicking(false);
    setPhase('running');
  };
  const notNow = () => {
    withRun((id) => api.liveNotNow(id));
    setAttention(null);
    setPhase('idle');
  };
  const approve = () => {
    withRun((id) => api.liveApprove(id));
    setApproval(null);
    setPhase('running');
  };
  const decline = () => {
    withRun((id) => api.liveDecline(id));
    setApproval(null);
    setPhase('idle');
  };
  const cancel = () => {
    withRun((id) => api.liveStop(id));
    closeSocket();
    setPhase('idle');
    setRunId(null);
  };
  const dismiss = () => {
    setResult(null);
    setPhase('idle');
  };
  const pick = async (xPct: number, yPct: number, imgW: number, imgH: number) => {
    if (!runIdRef.current) return;
    const hit = await api.livePick(runIdRef.current, Math.round(xPct * imgW), Math.round(yPct * imgH));
    if (hit) answer(hit.label);
  };

  const scroll = (deltaY: number) => {
    if (runIdRef.current) api.liveScroll(runIdRef.current, deltaY).catch(() => {});
  };

  return {
    phase,
    screenshot,
    activeStepId,
    doneStepIds,
    highlight,
    logs,
    attention,
    approval,
    result,
    picking,
    setPicking,
    busy: phase === 'connecting' || phase === 'running' || phase === 'attention' || phase === 'approval',
    start,
    answer,
    notNow,
    approve,
    decline,
    cancel,
    dismiss,
    pick,
    scroll,
    runId,
  };
}

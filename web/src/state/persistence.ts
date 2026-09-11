import { useEffect, useRef, type Dispatch } from 'react';
import { api } from '../api/client';
import type { Action, State } from './store';

/**
 * Keeps the store in step with the local runner. If the runner is not there,
 * everything still works from memory and a quiet chip says so.
 */
export function usePersistence(state: State, dispatch: Dispatch<Action>) {
  const ready = useRef(false);
  const knownRuns = useRef<Set<string>>(new Set());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fail = () => dispatch({ type: 'saveState', save: 'offline' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api.loadState();
        if (cancelled) return;
        if (!s.automations) await api.saveAutomations(state.automations);
        if (!s.rules) await api.saveRules(state.rules);
        if (!s.signIns) await api.saveSignIns(state.signIns);
        if (!s.history) await api.saveHistory(state.history);
        const data = {
          ...(s.automations ? { automations: s.automations } : {}),
          ...(s.rules ? { rules: s.rules } : {}),
          ...(s.signIns ? { signIns: s.signIns } : {}),
          ...(s.history ? { history: s.history } : {}),
        };
        knownRuns.current = new Set((s.history ?? state.history).map((r) => r.id));
        dispatch({ type: 'hydrate', data });
        dispatch({ type: 'saveState', save: 'saved' });
        ready.current = true;
      } catch {
        if (!cancelled) fail();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const debounce = (key: string, run: () => Promise<unknown>) => {
    if (!ready.current) return;
    clearTimeout(timers.current[key]);
    dispatch({ type: 'saveState', save: 'saving' });
    timers.current[key] = setTimeout(() => {
      run()
        .then(() => dispatch({ type: 'saveState', save: 'saved' }))
        .catch(fail);
    }, 400);
  };

  useEffect(() => debounce('automations', () => api.saveAutomations(state.automations)), [state.automations]);
  useEffect(() => debounce('rules', () => api.saveRules(state.rules)), [state.rules]);
  useEffect(() => debounce('signIns', () => api.saveSignIns(state.signIns)), [state.signIns]);

  // A demo reset replaces the whole run history rather than adding to it.
  useEffect(() => {
    if (!ready.current || state.resets === 0) return;
    knownRuns.current = new Set(state.history.map((r) => r.id));
    debounce('history', () => api.saveHistory(state.history));
  }, [state.resets]);

  useEffect(() => {
    if (!ready.current) return;
    const fresh = state.history.filter((r) => !knownRuns.current.has(r.id));
    fresh.forEach((r) => knownRuns.current.add(r.id));
    fresh
      .reverse()
      .reduce((p, r) => p.then(() => api.addRun(r)), Promise.resolve() as Promise<unknown>)
      .then(() => fresh.length && dispatch({ type: 'saveState', save: 'saved' }))
      .catch(fail);
  }, [state.history]);
}

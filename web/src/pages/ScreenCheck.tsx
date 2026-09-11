import { useEffect, useState } from 'react';
import { ACTIONS } from '../domain/actions';
import { isConfident, pct, resolveIn, type Match } from '../domain/binder';
import type { ScreenId } from '../domain/types';
import { useStore } from '../state/store';
import { inputCls, PageHeader } from '../shell/ui';
import { TenantFrame } from '../tenant/TenantFrame';

/** Temporary page for checking the binder against the synthetic screens by eye. */
export function ScreenCheck() {
  const { state } = useStore();
  const [screen, setScreen] = useState<ScreenId>('balances');
  const [verb, setVerb] = useState('read');
  const [want, setWant] = useState('Balance');
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [all, setAll] = useState<Match<HTMLElement>[]>([]);

  useEffect(() => {
    if (!root) return;
    setAll(resolveIn(root, want, ACTIONS[verb].kinds).all);
  }, [root, want, verb, screen, state.mutated]);

  const best = all[0];
  const ok = isConfident(best);

  return (
    <div className="flex h-screen flex-col">
      <PageHeader title="Screen check" description="Type the name of something and see what the automation would point at." />
      <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] gap-5 p-6">
        <div className="space-y-4">
          <select className={inputCls} value={screen} onChange={(e) => setScreen(e.target.value as ScreenId)}>
            {(['signin', 'patients', 'balances', 'payments', 'upload'] as ScreenId[]).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select className={inputCls} value={verb} onChange={(e) => setVerb(e.target.value)}>
            {Object.entries(ACTIONS)
              .filter(([, d]) => d.resolves === 'screen')
              .map(([v, d]) => (
                <option key={v} value={v}>
                  {d.label}
                </option>
              ))}
          </select>
          <input className={inputCls} value={want} onChange={(e) => setWant(e.target.value)} />
          <div className={`rounded-card p-3 text-sm ${ok ? 'bg-mint text-teal' : 'bg-red-bg text-red'}`}>
            {best ? (ok ? `Points at ${best.label}. ${pct(best.s)}% sure.` : `Only ${pct(best.s)}% sure it is ${best.label}. Not enough to act on.`) : 'Nothing like that on this screen.'}
          </div>
          <ul className="divide-y divide-line rounded-card border border-line bg-white text-sm">
            {all.slice(0, 8).map((m) => (
              <li key={m.label + m.kind} className="flex justify-between px-3 py-2">
                <span className="text-ink">{m.label}</span>
                <span className="text-muted">{pct(m.s)}%</span>
              </li>
            ))}
          </ul>
        </div>
        <TenantFrame
          screen={screen}
          mutated={state.mutated}
          onNavigate={setScreen}
          rootRef={setRoot}
          highlight={best ? { label: best.label, kind: best.kind, tone: ok ? 'teal' : 'red', caption: `${best.label} · ${pct(best.s)}% sure` } : null}
        />
      </div>
    </div>
  );
}

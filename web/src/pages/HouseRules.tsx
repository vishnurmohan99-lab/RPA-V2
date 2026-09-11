import { Info } from 'lucide-react';
import { RULE_DEFS } from '../domain/houseRules';
import { nowLabel } from '../domain/runner';
import { useStore } from '../state/store';
import { PageHeader, Toggle } from '../shell/ui';

export function HouseRules() {
  const { state, dispatch } = useStore();

  const toggle = (id: string, on: boolean) => {
    const rule = state.rules.find((r) => r.id === id);
    if (!rule) return;
    dispatch({ type: 'setRule', id, on });
    dispatch({
      type: 'addRun',
      run: {
        id: `run-rule-${Date.now().toString(36)}`,
        automationId: null,
        automationName: 'House rules',
        when: nowLabel(),
        outcome: 'change',
        narrative: on
          ? `You turned the house rule “${rule.text}” back on. Every automation applies it again from the next run.`
          : `You turned off the house rule “${rule.text}”. Every automation stops applying it from the next run.`,
        rowsRead: 0,
        rowsKept: 0,
        rowsSkipped: 0,
        rowsHeld: 0,
        fileProduced: null,
      },
    });
  };

  return (
    <div>
      <PageHeader title="House rules" description="Plain sentences your practice lives by. They apply to every automation, in this order." />
      <div className="space-y-4 px-8 py-6">
        <div className="flex max-w-3xl items-start gap-3 rounded-card border border-line bg-white px-4 py-3 text-[13px] text-body">
          <Info size={16} className="mt-0.5 shrink-0 text-teal" />
          Turning a rule off changes every automation at once, and it is written down in run history. The first rule that matches a row decides what happens to it.
        </div>
        <div className="max-w-3xl overflow-hidden rounded-card border border-line bg-white">
          {state.rules.map((r, i) => {
            const def = RULE_DEFS.find((d) => d.id === r.id);
            return (
              <div key={r.id} className={`flex items-center gap-4 border-line px-5 py-4 ${i ? 'border-t' : ''}`}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-semibold text-body ring-1 ring-line">{i + 1}</span>
                <div className="flex-1">
                  <div className={`text-[15px] ${r.on ? 'text-ink' : 'text-muted line-through'}`}>{r.text}</div>
                  <div className="mt-1">
                    {def?.hold ? (
                      <span className="rounded-full bg-amber-bg px-2 py-0.5 text-[11px] font-medium text-amber">Waits for you</span>
                    ) : (
                      <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">Skips the row</span>
                    )}
                  </div>
                </div>
                <Toggle on={r.on} onChange={(on) => toggle(r.id, on)} label={r.text} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

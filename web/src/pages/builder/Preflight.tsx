import { useLayoutEffect, useRef } from 'react';
import { ACTIONS } from '../../domain/actions';
import { isConfident, resolveIn } from '../../domain/binder';
import type { ScreenId, Step } from '../../domain/types';
import { BalancesScreen } from '../../tenant/BalancesScreen';
import { PatientsScreen } from '../../tenant/PatientsScreen';
import { PaymentsScreen } from '../../tenant/PaymentsScreen';
import { UploadScreen } from '../../tenant/UploadScreen';

const SCREENS: Partial<Record<ScreenId, typeof BalancesScreen>> = {
  balances: BalancesScreen,
  payments: PaymentsScreen,
  patients: PatientsScreen,
  upload: UploadScreen,
};

/**
 * Quietly checks every on-screen step against how the screens look right now,
 * so Diane hears about a changed screen before she runs anything.
 */
export function PreflightProbe({ steps, mutated, onResult }: { steps: Step[]; mutated: boolean; onResult: (failing: string[]) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const checked = steps.filter((s) => ACTIONS[s.verb]?.resolves === 'screen' && s.verb !== 'open' && s.bind && s.screen && SCREENS[s.screen]);
  const screens = [...new Set(checked.map((s) => s.screen!))];
  const key = checked.map((s) => `${s.id}:${s.bind}:${s.screen}`).join('|');

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const failing = checked
      .filter((s) => {
        const pane = root.querySelector<HTMLElement>(`[data-probe="${s.screen}"]`);
        return !pane || !isConfident(resolveIn(pane, s.bind!, ACTIONS[s.verb].kinds).best);
      })
      .map((s) => s.id);
    onResult(failing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mutated]);

  return (
    <div ref={ref} hidden aria-hidden>
      {screens.map((s) => {
        const Screen = SCREENS[s]!;
        return (
          <div key={s} data-probe={s}>
            <Screen mutated={mutated} />
          </div>
        );
      })}
    </div>
  );
}

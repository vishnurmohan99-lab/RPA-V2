import { makeStep, RECORD_FROM } from './actions';
import type { Kind, ScreenId, Step } from './types';

const SUBMIT_WORDS = /^(submit|send|apply|save|reconcile|send to print|apply filters)$/i;
const SCREEN_OF_NAV: Record<string, ScreenId> = { Patients: 'patients', Balances: 'balances', Payments: 'payments' };

/**
 * A click Diane made while recording becomes one plain-English step.
 * For a click on "Sign in", `value` is the name of the sign-in to use — never a password.
 */
export function recordStep(label: string, kind: Kind, screen: ScreenId, value?: string): Step {
  if (kind === 'button' && /^sign in$/i.test(label)) return makeStep('signin', label, value, { screen });
  let verb = RECORD_FROM[kind];
  if (kind === 'button' && SUBMIT_WORDS.test(label)) verb = 'submit';
  if (kind === 'upload') return makeStep('upload', label, value ?? 'Statement vendor portal', { screen });
  const target = kind === 'nav' || kind === 'screen' ? (SCREEN_OF_NAV[label] ?? screen) : screen;
  return makeStep(verb, label, value, { screen: target });
}

/** Whether a recorded step still needs Diane to say what to type. */
export function needsValue(kind: Kind): boolean {
  return kind === 'field';
}

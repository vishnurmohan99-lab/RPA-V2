import { describe, expect, it } from 'vitest';
import { resolve, score, THRESHOLD, type Candidate } from './binder';
import type { Kind } from './types';

const c = (label: string, kind: Kind): Candidate<string> => ({ el: label, label, kind });

const nav = [c('Automations', 'nav'), c('Patients', 'nav'), c('Balances', 'nav'), c('Payments', 'nav')];

const balancesBefore = [
  ...nav,
  c('Balances', 'screen'),
  c('Account', 'column'),
  c('Patient', 'column'),
  c('Payer', 'column'),
  c('Balance', 'column'),
  c('Age (days)', 'column'),
  c('Payment plan', 'column'),
  c('Export', 'button'),
  c('Print', 'button'),
];

const balancesAfter = balancesBefore.map((x) => (x.label === 'Balance' ? c('Amount Due', 'column') : x));

describe('binder', () => {
  it('binds an exact column name confidently at 96%', () => {
    const { best } = resolve('Balance', balancesBefore, ['column']);
    expect(best?.label).toBe('Balance');
    expect(best?.s).toBeCloseTo(0.96);
    expect(best!.s).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it('never binds a column step to the Balances nav item or screen title', () => {
    const { all } = resolve('Balance', balancesBefore, ['column']);
    expect(all.every((m) => m.kind === 'column')).toBe(true);
  });

  it('after the screen changes, stops and flags Amount Due as the closest match', () => {
    const { best } = resolve('Balance', balancesAfter, ['column']);
    expect(best?.label).toBe('Amount Due');
    expect(best!.s).toBeLessThan(THRESHOLD);
    expect(Math.round(best!.s * 100)).toBe(62);
  });

  it('flags Payment Ref when Check # disappears', () => {
    const cols = ['ERA', 'Payer', 'Status', 'Payment Ref', 'Claims', 'Amount'].map((l) => c(l, 'column'));
    const { best } = resolve('Check #', cols, ['column']);
    expect(best?.label).toBe('Payment Ref');
    expect(best!.s).toBeLessThan(THRESHOLD);
  });

  it('opens the Balances screen confidently', () => {
    const { best } = resolve('Balances', balancesBefore, ['screen', 'nav']);
    expect(best!.s).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it('keeps unrelated labels well below the threshold', () => {
    expect(score('Balance', 'Account')).toBeLessThan(0.62);
    expect(score('Balance', 'Print')).toBeLessThan(THRESHOLD);
  });

  it('returns null best when nothing of the right kind exists', () => {
    expect(resolve('Balance', nav, ['column']).best).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { recordStep } from './recorder';

describe('recorder', () => {
  it('turns clicks into sentences by kind', () => {
    expect(recordStep('Balances', 'nav', 'patients').sentence).toBe('Open the Balances screen.');
    expect(recordStep('Balances', 'nav', 'patients').screen).toBe('balances');
    expect(recordStep('Balance', 'column', 'balances').sentence).toBe('Read the Balance for every row.');
    expect(recordStep('Export', 'button', 'balances').sentence).toBe('Click Export.');
    expect(recordStep('Reconcile', 'button', 'payments').verb).toBe('submit');
    expect(recordStep('Deposit date', 'field', 'payments', '2026-09-05').sentence).toBe('Type 2026-09-05 into Deposit date.');
    expect(recordStep('Balance list', 'table', 'balances').sentence).toBe('Read everything in the Balance list.');
  });
});

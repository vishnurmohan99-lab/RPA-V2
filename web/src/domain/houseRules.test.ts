import { describe, expect, it } from 'vitest';
import { ACTIONS } from './actions';
import { parseCondition } from './conditions';
import { applyRules, DEFAULT_RULES, money, total } from './houseRules';
import { BALANCES, ERAS } from './seed';

describe('Friday statements arithmetic', () => {
  const inScope = BALANCES.filter((r) => parseCondition('is over 30')(String(r.age)));
  const out = applyRules(inScope, DEFAULT_RULES);

  it('drops one row as out of scope', () => {
    expect(BALANCES.length - inScope.length).toBe(1);
  });

  it('skips 5 by house rule and holds Ray Colton', () => {
    expect(out.skipped.map((h) => h.row.patient).sort()).toEqual(
      ['Dale Whitcomb', 'Ida Brennan', 'June Park', 'Priya Raman', 'Wes Tanaka'].sort(),
    );
    expect(out.held.map((h) => h.row.patient)).toEqual(['Ray Colton']);
  });

  it('keeps 5 rows totalling $2,516.15', () => {
    expect(out.kept).toHaveLength(5);
    expect(money(total(out.kept))).toBe('$2,516.15');
  });

  it('turning a rule off changes the outcome', () => {
    const rules = DEFAULT_RULES.map((r) => (r.id === 'payment-plan' ? { ...r, on: false } : r));
    expect(applyRules(inScope, rules).kept).toHaveLength(6);
  });

  it('ERA batches: skips 99999 and unbalanced, holds the big one', () => {
    const eras = applyRules(ERAS, DEFAULT_RULES);
    expect(eras.skipped).toHaveLength(3);
    expect(eras.held).toHaveLength(1);
  });
});

describe('action registry', () => {
  it('every verb is complete', () => {
    for (const [verb, def] of Object.entries(ACTIONS)) {
      expect(def.label, verb).toBeTruthy();
      expect(['screen', 'page', 'edge']).toContain(def.resolves);
      expect(typeof def.tmpl('x', 'y')).toBe('string');
      if (def.resolves === 'screen') expect(def.kinds.length, verb).toBeGreaterThan(0);
    }
  });
});

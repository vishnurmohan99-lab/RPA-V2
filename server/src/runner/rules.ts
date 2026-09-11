import { scoreWithWhy } from './score.js';

/**
 * The five house rules, ported from web/src/domain/houseRules.ts RULE_DEFS (same ids, same
 * predicates, same order — first match wins). The synthetic tenant's rows already carry the
 * right field names (payer/balance/plan/status). A real, unknown page doesn't, so `fieldFor()`
 * maps whichever column Diane read to one of those fields by the same name-matching the binder
 * uses elsewhere — best-effort, and a column that doesn't match anything just isn't checked.
 */
export interface GenericRow {
  id: string;
  payer?: string;
  balance?: number;
  plan?: string;
  status?: string;
}

export interface RuleHit {
  ruleId: string;
  why: string;
  hold: boolean;
}

export const RULE_DEFS: { id: string; text: string; hold: boolean; why: string; test: (r: GenericRow) => boolean }[] = [
  { id: 'payer-99999', text: 'Skip anything from payer 99999.', hold: false, why: 'Payer 99999', test: (r) => r.payer === '99999' },
  { id: 'under-5', text: 'Never send a statement for less than $5.', hold: false, why: 'Under $5', test: (r) => r.balance !== undefined && r.balance < 5 },
  { id: 'over-5000', text: 'Anything over $5,000 waits for me to look at it.', hold: true, why: 'Over $5,000', test: (r) => (r.balance ?? 0) > 5000 },
  { id: 'payment-plan', text: 'Leave patients on an active payment plan alone.', hold: false, why: 'On a payment plan', test: (r) => r.plan === 'Active' },
  { id: 'unbalanced', text: 'Do not touch a batch that has not balanced.', hold: false, why: 'Batch has not balanced', test: (r) => r.status === 'Unbalanced' },
];

const FIELD_SYNONYMS: Record<string, string[]> = {
  payer: ['payer', 'insurance', 'carrier'],
  balance: ['balance', 'amount due', 'amount', 'patient due'],
  plan: ['payment plan', 'plan'],
  status: ['status', 'batch status'],
};

/** Which house-rule field (if any) a real column's header name most likely means. */
export function fieldFor(columnLabel: string): keyof GenericRow | null {
  let best: { field: keyof GenericRow; s: number } | null = null;
  for (const [field, words] of Object.entries(FIELD_SYNONYMS)) {
    for (const w of words) {
      const { s } = scoreWithWhy(w, columnLabel);
      if (s >= 0.62 && (!best || s > best.s)) best = { field: field as keyof GenericRow, s };
    }
  }
  return best?.field ?? null;
}

export function applyRule(row: GenericRow, onIds: Set<string>): RuleHit | null {
  for (const d of RULE_DEFS) {
    if (onIds.has(d.id) && d.test(row)) return { ruleId: d.id, why: d.why, hold: d.hold };
  }
  return null;
}

export function parseMoney(cell: string): number | undefined {
  const n = Number(cell.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

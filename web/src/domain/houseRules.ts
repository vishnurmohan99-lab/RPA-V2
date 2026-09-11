import type { HouseRuleDef, HouseRuleState, Row } from './types';

const amountOf = (r: Row) => r.balance ?? r.amount ?? 0;

/** The practice's rulebook. Applies to every automation. Order matters: first match wins. */
export const RULE_DEFS: HouseRuleDef[] = [
  { id: 'payer-99999', text: 'Skip anything from payer 99999.', hold: false, why: 'Payer 99999', test: (r) => r.payer === '99999' },
  { id: 'under-5', text: 'Never send a statement for less than $5.', hold: false, why: 'Under $5', test: (r) => r.balance !== undefined && r.balance < 5 },
  { id: 'over-5000', text: 'Anything over $5,000 waits for me to look at it.', hold: true, why: 'Over $5,000', test: (r) => amountOf(r) > 5000 },
  { id: 'payment-plan', text: 'Leave patients on an active payment plan alone.', hold: false, why: 'On a payment plan', test: (r) => r.plan === 'Active' },
  { id: 'unbalanced', text: 'Do not touch a batch that has not balanced.', hold: false, why: 'Batch has not balanced', test: (r) => r.status === 'Unbalanced' },
];

export const DEFAULT_RULES: HouseRuleState[] = RULE_DEFS.map(({ id, text }) => ({ id, text, on: true }));

export interface RuleHit<R extends Row = Row> {
  row: R;
  ruleId: string;
  why: string;
}

export interface RuleOutcome<R extends Row = Row> {
  kept: R[];
  skipped: RuleHit<R>[];
  held: RuleHit<R>[];
}

export function applyRules<R extends Row>(rows: R[], states: HouseRuleState[]): RuleOutcome<R> {
  const on = new Set(states.filter((s) => s.on).map((s) => s.id));
  const out: RuleOutcome<R> = { kept: [], skipped: [], held: [] };
  for (const row of rows) {
    const rule = RULE_DEFS.find((d) => on.has(d.id) && d.test(row));
    if (!rule) out.kept.push(row);
    else (rule.hold ? out.held : out.skipped).push({ row, ruleId: rule.id, why: rule.why });
  }
  return out;
}

export const total = (rows: Row[]) => Math.round(rows.reduce((sum, r) => sum + amountOf(r), 0) * 100) / 100;

export const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

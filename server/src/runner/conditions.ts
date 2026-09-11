/**
 * Turns Diane's plain words ("is over 30", "under $5", "is Active") into a test on a cell
 * value. Ported from web/src/domain/conditions.ts — pure logic, kept identical by hand.
 */
export type CellTest = (cell: string) => boolean;

export function toNumber(cell: string): number {
  const n = Number(cell.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

export function parseCondition(phrase: string): CellTest {
  const p = phrase.toLowerCase().trim();
  const num = p.match(/-?\d[\d,]*(\.\d+)?/);
  const n = num ? Number(num[0].replace(/,/g, '')) : NaN;
  if (/(over|more than|greater than|above|at least|>)/.test(p) && !Number.isNaN(n)) {
    const inclusive = /at least|>=/.test(p);
    return (c) => (inclusive ? toNumber(c) >= n : toNumber(c) > n);
  }
  if (/(under|less than|below|fewer than|<)/.test(p) && !Number.isNaN(n)) {
    return (c) => toNumber(c) < n;
  }
  const not = p.match(/^(?:is not|isn't|is never|not)\s+(.+)$/);
  if (not) return (c) => c.toLowerCase().trim() !== not[1].trim();
  const word = p.replace(/^(is|equals|=|says)\s+/, '').trim();
  return (c) => c.toLowerCase().trim() === word;
}

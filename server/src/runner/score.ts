/**
 * The binder, ported for the server. Kept in sync by hand with web/src/domain/binder.ts —
 * same scoring, same threshold, same synonym list. The web app scores against `[data-label]`
 * elements in the synthetic tenant; this scores against elements the Playwright runner finds
 * on a real page (see resolve.ts). Selectors are never the source of truth in either place.
 */
export const THRESHOLD = 0.75;

export type MatchWhy = 'exact' | 'contains' | 'synonym' | 'words' | 'letters';

export const SYNONYMS: string[][] = [
  ['balance', 'amount due', 'patient due', 'outstanding'],
  ['check #', 'check number', 'payment ref', 'eft number', 'trace number'],
  ['age (days)', 'days outstanding', 'days old'],
  ['era', 'remittance'],
  ['payer', 'insurance', 'carrier'],
  ['export', 'download'],
];

export const SCORES = { exact: 0.96, contains: 0.82, synonym: 0.62 } as const;

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

const SYN_GROUPS = SYNONYMS.map((g) => g.map(normalize));

function areSynonyms(a: string, b: string): boolean {
  return SYN_GROUPS.some((g) => g.includes(a) && g.includes(b));
}

export function scoreWithWhy(want: string, have: string): { s: number; why: MatchWhy } {
  const a = normalize(want);
  const b = normalize(have);
  if (!a || !b) return { s: 0, why: 'letters' };
  if (a === b) return { s: SCORES.exact, why: 'exact' };
  if (areSynonyms(a, b)) return { s: SCORES.synonym, why: 'synonym' };
  if (b.includes(a) || a.includes(b)) return { s: SCORES.contains, why: 'contains' };
  const aw = new Set(a.split(' '));
  const bw = new Set(b.split(' '));
  const shared = [...aw].filter((w) => bw.has(w)).length;
  if (shared) return { s: Math.min(0.74, 0.55 + 0.1 * shared), why: 'words' };
  const set = new Set(a);
  const overlap = [...b].filter((c) => set.has(c)).length / Math.max(a.length, b.length);
  return { s: Math.min(0.5, overlap * 0.7), why: 'letters' };
}

export function score(want: string, have: string): number {
  return scoreWithWhy(want, have).s;
}

export function isConfident(s: number | null | undefined): boolean {
  return s !== null && s !== undefined && s >= THRESHOLD;
}

export function pct(s: number | undefined | null): number {
  return Math.round((s ?? 0) * 100);
}

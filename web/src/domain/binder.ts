import type { Kind } from './types';

/**
 * The binder. A step names the thing it needs in plain English; every run we
 * re-resolve that name against what is actually on the screen and score it.
 * Selectors are never the source of truth.
 */
export const THRESHOLD = 0.75;

export interface Candidate<E = unknown> {
  el: E;
  label: string;
  kind: Kind;
}

export type MatchWhy = 'exact' | 'contains' | 'synonym' | 'words' | 'letters';

export interface Match<E = unknown> extends Candidate<E> {
  s: number;
  why: MatchWhy;
}

export interface Resolution<E = unknown> {
  best: Match<E> | null;
  all: Match<E>[];
}

/** Words billing staff use for the same thing. A synonym is a hint, never enough to act on. */
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

export function resolve<E>(want: string, candidates: Candidate<E>[], kinds?: Kind[]): Resolution<E> {
  const pool = kinds && kinds.length ? candidates.filter((c) => kinds.includes(c.kind)) : candidates;
  const all = pool
    .map((c) => ({ ...c, ...scoreWithWhy(want, c.label) }))
    .sort((x, y) => y.s - x.s);
  return { best: all[0] ?? null, all };
}

/** Every labelled element inside a root (the synthetic tenant). */
export function candidatesIn(root: ParentNode): Candidate<HTMLElement>[] {
  return [...root.querySelectorAll<HTMLElement>('[data-label]')].map((el) => ({
    el,
    label: el.dataset.label!,
    kind: (el.dataset.kind as Kind) ?? 'field',
  }));
}

export function resolveIn(root: ParentNode, want: string, kinds?: Kind[]): Resolution<HTMLElement> {
  return resolve(want, candidatesIn(root), kinds);
}

export function isConfident(m: { s: number } | null | undefined): boolean {
  return !!m && m.s >= THRESHOLD;
}

export function pct(s: number | undefined): number {
  return Math.round((s ?? 0) * 100);
}

import { ACTIONS } from './actions';
import type { Match } from './binder';
import { money } from './houseRules';
import { BALANCES, ERAS } from './seed';
import type { Kind, Row, ScreenId, Step } from './types';

export const TICK = 650;
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const SCREEN_BY_LABEL: Record<string, ScreenId> = {
  Balances: 'balances',
  Patients: 'patients',
  Payments: 'payments',
  'Upload statements': 'upload',
};

const SCREEN_LIST: Record<ScreenId, string> = {
  signin: 'sign-in page',
  patients: 'patient list',
  balances: 'balance list',
  payments: 'ERA list',
  upload: 'upload page',
};

/** The synthetic tenant's records, looked up by the row id printed on the screen. */
export const RECORDS: Record<string, Row> = Object.fromEntries([...BALANCES, ...ERAS].map((r) => [r.id, r as Row]));

export function rowIds(root: ParentNode): string[] {
  return [...root.querySelectorAll<HTMLElement>('tr[data-row-id]')].map((tr) => tr.dataset.rowId!);
}

/** Read one column by the header the binder matched — wherever that column now sits. */
export function readColumn(root: ParentNode, label: string): Map<string, string> {
  const out = new Map<string, string>();
  const th = [...root.querySelectorAll<HTMLTableCellElement>('th[data-kind="column"]')].find((el) => el.dataset.label === label);
  if (!th) return out;
  const idx = th.cellIndex;
  for (const tr of th.closest('table')?.tBodies[0]?.rows ?? []) {
    const id = tr.dataset.rowId;
    if (id) out.set(id, tr.cells[idx]?.textContent?.trim() ?? '');
  }
  return out;
}

const NOUN: Record<Kind, string> = {
  column: 'column',
  button: 'button',
  field: 'box',
  screen: 'screen',
  nav: 'screen',
  table: 'list',
  upload: 'upload box',
};

export function attentionQuestion(want: string, best: Match | null): string {
  if (!best) return `I can't find ${want} on this screen. Can you point at it?`;
  return `The ${want} ${NOUN[best.kind]} is gone. Is ${best.label} the same thing?`;
}

export const edgeSteps = (steps: Step[]) => steps.filter((s) => ACTIONS[s.verb]?.resolves === 'edge');

export function approveLabel(steps: Step[]): string {
  const verbs = edgeSteps(steps).map((s) => s.verb);
  if (verbs.includes('upload')) return 'Approve and upload';
  if (verbs.includes('saveTo') || verbs.includes('download')) return 'Approve and save';
  if (verbs.includes('notify')) return 'Approve and send';
  return 'Approve';
}

/** A read or filter step cannot come before the open step it depends on. */
export function mustOpenFirst(order: Step[]): string | null {
  const openFor = new Set(order.filter((s) => s.verb === 'open').map((s) => SCREEN_BY_LABEL[s.bind ?? '']).filter(Boolean));
  const opened = new Set<ScreenId>();
  for (const s of order) {
    if (s.verb === 'open') {
      const sc = SCREEN_BY_LABEL[s.bind ?? ''];
      if (sc) opened.add(sc);
    } else if ((s.verb === 'read' || s.verb === 'filter') && s.screen && openFor.has(s.screen) && !opened.has(s.screen)) {
      return `This step needs the ${SCREEN_LIST[s.screen]} open first.`;
    }
  }
  return null;
}

export function describeRow(id: string) {
  const r = RECORDS[id];
  return { name: r?.patient ?? r?.era ?? id, amount: r ? money(r.balance ?? r.amount ?? 0) : '' };
}

const plain = (cell: string | undefined) => (cell ?? '').replace(/[$,]/g, '');

export function buildCsv(ids: string[], reads: Map<string, Map<string, string>>): { headers: string[]; rows: string[][] } {
  const first = RECORDS[ids[0]];
  if (first?.patient !== undefined) {
    const moneyLabel = reads.has('Amount Due') ? 'Amount Due' : 'Balance';
    const col = reads.get(moneyLabel);
    return {
      headers: ['Account', 'Patient', 'Payer', moneyLabel, 'Age (days)'],
      rows: ids.map((id) => {
        const r = RECORDS[id];
        return [r.account!, r.patient!, r.payer!, col?.get(id) ? plain(col.get(id)) : r.balance!.toFixed(2), String(r.age)];
      }),
    };
  }
  if (first?.era !== undefined) {
    return {
      headers: ['ERA', 'Payer', 'Check #', 'Claims', 'Amount', 'Status'],
      rows: ids.map((id) => {
        const r = RECORDS[id];
        return [r.era!, r.payer!, r.check!, String(r.claims), r.amount!.toFixed(2), r.status!];
      }),
    };
  }
  return { headers: ['Row'], rows: ids.map((id) => [id]) };
}

export function nowLabel(d = new Date()): string {
  return d.toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

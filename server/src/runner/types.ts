/** What sort of thing an element is. Mirrors web/src/domain/types.ts Kind. */
export type Kind = 'column' | 'button' | 'field' | 'screen' | 'nav' | 'table' | 'upload';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Candidate {
  ref: string;
  label: string;
  kind: Kind;
  box: Box;
}

export interface Match extends Candidate {
  s: number;
}

/** Which kinds each verb may bind to. Mirrors ACTIONS[verb].kinds in web/src/domain/actions.ts. */
export const KINDS_BY_VERB: Record<string, Kind[]> = {
  signin: ['button'],
  open: ['screen', 'nav'],
  click: ['button'],
  type: ['field'],
  choose: ['field'],
  date: ['field'],
  tick: ['field'],
  read: ['column'],
  table: ['table'],
  submit: ['button'],
  await: ['column', 'button', 'field', 'table'],
  filter: ['column'],
};

export type LogTone = 'ok' | 'warn' | 'err' | 'info';

/** One live event pushed to the client over the run's WebSocket. */
export type RunnerEvent =
  | { type: 'screenshot'; dataUrl: string }
  | { type: 'active'; stepId: string }
  | { type: 'stepDone'; stepId: string }
  | { type: 'highlight'; box: Box | null; label: string | null; s: number | null; tone: 'teal' | 'red' | 'amber' }
  | { type: 'log'; text: string; tone: LogTone }
  | { type: 'attention'; stepId: string; want: string; bestLabel: string | null; bestPct: number | null; labels: string[]; question: string }
  | {
      type: 'approval';
      read: number;
      outOfScope: number;
      skipped: number;
      held: { id: string; name: string; amount: string; why: string }[];
      kept: number;
      total: number;
      label: string;
      edges: string[];
    }
  | { type: 'done'; mode: 'dry' | 'run'; sentence: string; fileName: string | null }
  | { type: 'stopped'; sentence: string }
  | { type: 'error'; message: string };

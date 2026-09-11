export type Resolves = 'screen' | 'page' | 'edge';

/** What sort of thing on the screen an element is. Carried as data-kind in the tenant. */
export type Kind = 'column' | 'button' | 'field' | 'screen' | 'nav' | 'table' | 'upload';

export type ScreenId = 'signin' | 'patients' | 'balances' | 'payments' | 'upload';

export interface ActionDef {
  label: string;
  /** Short uppercase tag shown on the flow node, e.g. "Read" or "Catch the file". */
  tag: string;
  resolves: Resolves;
  /** Which kinds of element this action may bind to. Empty for page / edge actions. */
  kinds: Kind[];
  needsValue?: boolean;
  valueHint?: string;
  tmpl: (target: string, value?: string) => string;
}

export interface Step {
  id: string;
  verb: string;
  sentence: string;
  bind: string | null;
  value?: string;
  lastBoundTo?: string;
  confidence?: number;
  /** Screen the step expects to be on, so selecting it can jump there. */
  screen?: ScreenId;
  /** Overrides the action's tag, e.g. "Then" / "Otherwise" under a split. */
  tag?: string;
  /** Position on the flow canvas. */
  x?: number;
  y?: number;
  /** Diane dragged this node, so automatic layout leaves it where she put it. */
  moved?: boolean;
}

/** A wire on the flow canvas. Runs follow the first path, or the "Yes" path after a split. */
export interface Edge {
  a: string;
  b: string;
  label?: string;
}

export type AutomationStatus = 'ready' | 'attention' | 'never';

export interface Automation {
  id: string;
  name: string;
  createdBy: string;
  startUrl: string;
  credId: string;
  destination: string;
  screen: ScreenId;
  steps: Step[];
  edges?: Edge[];
  status: AutomationStatus;
  lastRun: string;
  cleanDryRun?: boolean;
}

export interface HouseRuleState {
  id: string;
  text: string;
  on: boolean;
}

export interface HouseRuleDef {
  id: string;
  text: string;
  hold: boolean;
  why: string;
  test: (row: Row) => boolean;
}

export interface SignIn {
  id: string;
  label: string;
  user: string;
}

export type RunOutcome = 'clean' | 'attention' | 'stopped' | 'preview' | 'change' | 'failed';

export type LogTone = 'ok' | 'warn' | 'err' | 'info';

export interface LogLine {
  t: string;
  text: string;
  tone: LogTone;
}

export interface RunRecord {
  id: string;
  automationId: string | null;
  automationName: string;
  when: string;
  outcome: RunOutcome;
  narrative: string;
  rowsRead: number;
  rowsKept: number;
  rowsSkipped: number;
  rowsHeld: number;
  fileProduced: string | null;
  fileId?: string | null;
  log?: LogLine[];
  trigger?: string;
  duration?: string;
  stepsLine?: string;
  /** The step a run stopped on, so "Open the step" can take Diane straight there. */
  stepId?: string | null;
}

export interface Destination {
  id: string;
  label: string;
  kind: 'folder' | 'web';
}

export interface KeptFile {
  id: string;
  name: string;
  size: number;
  created: string;
  automationId: string | null;
  runId: string | null;
  sentTo: string[];
}

export interface BalanceRow {
  id: string;
  account: string;
  patient: string;
  payer: string;
  balance: number;
  age: number;
  plan: 'No' | 'Active';
}

export interface EraRow {
  id: string;
  era: string;
  payer: string;
  check: string;
  claims: number;
  amount: number;
  status: 'Balanced' | 'Unbalanced';
}

export type Row = Partial<BalanceRow> & Partial<EraRow> & { id: string };

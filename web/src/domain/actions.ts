import type { ActionDef, Kind, Resolves, Step } from './types';

/**
 * The action registry. Adding a website action is one object here — nothing else.
 */
export const ACTIONS: Record<string, ActionDef> = {
  // --- Happens on the screen ---
  open: { label: 'Open a screen', tag: 'Go to', resolves: 'screen', kinds: ['screen', 'nav'], tmpl: (t) => `Open the ${t} screen.` },
  click: { label: 'Click something', tag: 'Click', resolves: 'screen', kinds: ['button'], tmpl: (t) => `Click ${t}.` },
  type: { label: 'Type into a field', tag: 'Type', resolves: 'screen', kinds: ['field'], needsValue: true, valueHint: 'What should I type?', tmpl: (t, v) => `Type ${v} into ${t}.` },
  choose: { label: 'Choose from a dropdown', tag: 'Choose', resolves: 'screen', kinds: ['field'], needsValue: true, valueHint: 'Which option?', tmpl: (t, v) => `Choose ${v} from ${t}.` },
  date: { label: 'Set a date', tag: 'Set', resolves: 'screen', kinds: ['field'], needsValue: true, valueHint: 'Which date?', tmpl: (t, v) => `Set ${t} to ${v}.` },
  tick: { label: 'Tick a box', tag: 'Click', resolves: 'screen', kinds: ['field'], tmpl: (t) => `Tick ${t}.` },
  read: { label: 'Read a column', tag: 'Read', resolves: 'screen', kinds: ['column'], tmpl: (t) => `Read the ${t} for every row.` },
  table: { label: 'Read a whole table', tag: 'Read', resolves: 'screen', kinds: ['table'], tmpl: (t) => `Read everything in the ${t}.` },
  submit: { label: 'Submit the form', tag: 'Click', resolves: 'screen', kinds: ['button'], tmpl: (t) => `Submit using ${t}.` },
  await: { label: 'Wait for something', tag: 'Wait', resolves: 'screen', kinds: ['column', 'button', 'field', 'table'], tmpl: (t) => `Wait until ${t} appears.` },
  filter: { label: 'Keep only some rows', tag: 'Set', resolves: 'screen', kinds: ['column'], needsValue: true, valueHint: 'For example: is over 30', tmpl: (t, v) => `Keep only rows where ${t} ${v}.` },

  // --- Happens to the page ---
  goto: { label: 'Go to a page', tag: 'Go to', resolves: 'page', kinds: [], needsValue: true, valueHint: 'Which address?', tmpl: (_t, v) => `Go to ${v}.` },
  back: { label: 'Go back', tag: 'Go to', resolves: 'page', kinds: [], tmpl: () => `Go back one page.` },
  pause: { label: 'Wait for it to load', tag: 'Wait', resolves: 'page', kinds: [], needsValue: true, valueHint: 'How many seconds?', tmpl: (_t, v) => `Wait ${v} seconds.` },
  rules: { label: 'Apply house rules', tag: 'House rules', resolves: 'page', kinds: [], tmpl: () => `Apply the house rules.` },
  review: { label: 'Stop and show me', tag: 'Stop', resolves: 'page', kinds: [], tmpl: () => `Show me everything before anything leaves.` },
  branch: { label: 'Split into two paths', tag: 'If', resolves: 'page', kinds: [], needsValue: true, valueHint: 'For example: Balance is over $25', tmpl: (_t, v) => `If ${v}.` },
  note: { label: 'Leave a note', tag: 'Note', resolves: 'page', kinds: [], needsValue: true, valueHint: 'What should happen here?', tmpl: (_t, v) => `${v ?? ''}` },

  // --- Leaves the browser ---
  download: { label: 'Catch the download', tag: 'Catch the file', resolves: 'edge', kinds: [], tmpl: () => `Catch the file the screen gives me.` },
  saveTo: { label: 'Save the file somewhere', tag: 'Put it somewhere', resolves: 'edge', kinds: [], needsValue: true, valueHint: 'Which folder?', tmpl: (_t, v) => `Put the file in ${v}.` },
  upload: { label: 'Upload it somewhere', tag: 'Put it somewhere', resolves: 'edge', kinds: [], needsValue: true, valueHint: 'Where should it go?', tmpl: (_t, v) => `Upload the file to ${v}.` },
  notify: { label: 'Tell someone', tag: 'Tell', resolves: 'edge', kinds: [], needsValue: true, valueHint: 'Who should I tell?', tmpl: (_t, v) => `Let ${v} know it is done.` },
};

export const GROUPS: { resolves: Resolves; title: string }[] = [
  { resolves: 'screen', title: 'Happens on the screen' },
  { resolves: 'page', title: 'Happens to the page' },
  { resolves: 'edge', title: 'Leaves the browser' },
];

export function actionOf(verb: string): ActionDef {
  const def = ACTIONS[verb];
  if (!def) throw new Error(`Unknown action: ${verb}`);
  return def;
}

export const tagOf = (step: Step) => step.tag ?? actionOf(step.verb).tag;

let counter = 0;
export function newStepId(): string {
  counter += 1;
  return `s-${Date.now().toString(36)}-${counter}`;
}

export function makeStep(verb: string, bind: string | null, value?: string, extra: Partial<Step> = {}): Step {
  const def = actionOf(verb);
  return {
    id: newStepId(),
    verb,
    bind,
    value,
    sentence: def.tmpl(bind ?? '', value),
    ...extra,
  };
}

/** Rebuild the sentence after the target or value changes. */
export function reword(step: Step): Step {
  return { ...step, sentence: actionOf(step.verb).tmpl(step.bind ?? '', step.value) };
}

/** Which verb a recorded click on a given kind of element becomes. */
export const RECORD_FROM: Record<Kind, string> = {
  column: 'read',
  button: 'click',
  field: 'type',
  screen: 'open',
  nav: 'open',
  table: 'table',
  upload: 'upload',
};

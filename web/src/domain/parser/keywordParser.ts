import { ACTIONS, makeStep } from '../actions';
import { DESTINATIONS } from '../seed';
import type { ScreenId, Step } from '../types';
import type { InstructionParser, ParseContext, ParseResult } from './index';

const END = String.raw`(?=,|\.|;|$|\s+and\s|\s+then\s|\s+when\s|\s+for\s)`;

const SCREENS: { words: string[]; label: string; screen: ScreenId; money: string }[] = [
  { words: ['balances', 'balance', 'statements', 'statement'], label: 'Balances', screen: 'balances', money: 'Balance' },
  { words: ['payments', 'payment', 'era', 'eras', 'remittance', 'posting'], label: 'Payments', screen: 'payments', money: 'Amount' },
  { words: ['patients', 'patient'], label: 'Patients', screen: 'patients', money: '' },
];

/** Rough position in an automation: open → work on screen → rules → review → export → leaves. */
function bucket(s: Step): number {
  if (s.verb === 'open' || s.verb === 'goto') return 0;
  if (s.verb === 'rules') return 2;
  if (s.verb === 'review') return 3;
  if (s.verb === 'click' && /export|download/i.test(s.bind ?? '')) return 4;
  if (ACTIONS[s.verb]?.resolves === 'edge') return 5;
  return 1;
}

function insert(steps: Step[], step: Step): Step[] {
  const b = bucket(step);
  let pos = 0;
  steps.forEach((s, i) => {
    if (bucket(s) <= b) pos = i + 1;
  });
  return [...steps.slice(0, pos), step, ...steps.slice(pos)];
}

const clean = (s: string) => s.trim().replace(/^(the|a|an)\s+/i, '').replace(/\s+(field|box|column|screen|list)$/i, '').trim();

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function destination(raw: string): string {
  const n = clean(raw).toLowerCase();
  const hit = DESTINATIONS.find((d) => {
    const words = d.label.toLowerCase().split(' ');
    return n.includes(d.label.toLowerCase()) || words.filter((w) => w.length > 3 && n.includes(w)).length >= 1;
  });
  if (hit) return hit.label;
  if (/vendor|print/.test(n)) return 'Statement vendor portal';
  return title(clean(raw));
}

function screenOf(steps: Step[]) {
  const open = [...steps].reverse().find((s) => s.verb === 'open');
  return SCREENS.find((sc) => sc.label === open?.bind) ?? null;
}

export const keywordParser: InstructionParser = {
  parse(text: string, current: Step[], ctx: ParseContext = {}): ParseResult {
    const t = text.trim();

    if (ctx.pending === 'hold-5000') {
      if (/^(yes|yeah|yep|sure|please|keep|hold|ok|okay)\b/i.test(t)) {
        return { steps: current, reply: 'Good. Anything over $5,000 will wait for you to look at it.' };
      }
      if (/^(no|nope|don'?t|skip)\b/i.test(t)) {
        return {
          steps: current,
          reply: 'That one is a house rule for the whole practice, so I have left it on. You can change it under House rules.',
        };
      }
    }

    let steps = [...current];
    const added: Step[] = [];
    const notes: string[] = [];
    const has = (verb: string, bind?: string) => steps.some((s) => s.verb === verb && (bind === undefined || s.bind === bind));
    const add = (step: Step) => {
      steps = insert(steps, step);
      added.push(step);
    };
    const ensure = (verb: string, bind: string | null = null, value?: string) => {
      if (!has(verb, bind ?? undefined)) add(makeStep(verb, bind, value));
    };
    const onScreen = () => screenOf(steps);

    // Go to a web address
    const url = t.match(/\b(?:go to|visit|open)\s+(https?:\/\/\S+)/i);
    if (url) add(makeStep('goto', null, url[1]));

    // Open a screen
    const open = t.match(/\b(?:open|go to|pull up|head to|switch to|start on)\s+(?:the\s+)?([a-z]+)/i);
    if (open && !url) {
      const sc = SCREENS.find((s) => s.words.includes(open[1].toLowerCase()));
      if (sc && !has('open', sc.label)) add(makeStep('open', sc.label, undefined, { screen: sc.screen }));
    }
    const sc = onScreen();
    const on = sc ? { screen: sc.screen } : {};

    // Search / type
    const type = t.match(new RegExp(String.raw`\b(?:search for|look up|type|enter)\s+["“]?(.+?)["”]?(?:\s+(?:in|into)\s+(.+?))?${END}`, 'i'));
    if (type) add(makeStep('type', type[2] ? title(clean(type[2])) : 'Patient name', clean(type[1]), on));

    // Choose from a list
    const choose = t.match(new RegExp(String.raw`\bchoose\s+(.+?)\s+from\s+(.+?)${END}`, 'i'));
    if (choose) add(makeStep('choose', title(clean(choose[2])), clean(choose[1]), on));

    // Dates
    const date = t.match(new RegExp(String.raw`\bset\s+(?:the\s+)?(.+?date)\s+to\s+(.+?)${END}`, 'i')) ?? t.match(/\b(deposit date)\s+(?:of|is|for)?\s*(today|yesterday|\d{4}-\d{2}-\d{2})/i);
    if (date) add(makeStep('date', title(clean(date[1])), date[2].trim(), on));

    // Keep only: over N days
    const days = t.match(/\b(?:over|more than|older than|past)\s+(\d+)\s+days?\b/i);
    if (days) add(makeStep('filter', 'Age (days)', `is over ${days[1]}`, on));

    // Keep only: ready / balanced
    if (/\bonly\s+(?:the\s+)?(?:ready|balanced)\b/i.test(t)) add(makeStep('filter', 'Status', 'is Balanced', on));

    // Keep only rows where X is Y
    const where = t.match(new RegExp(String.raw`\bkeep only (?:rows |the ones )?where\s+(?:the\s+)?(.+?)\s+((?:is|over|under|more than|less than)\s+.+?)${END}`, 'i'));
    if (where) add(makeStep('filter', title(clean(where[1])), where[2].trim(), on));

    // Skip payer N
    const payer = t.match(/\bskip\s+(?:anything from\s+|anyone with\s+|everyone from\s+)?payer\s+(\w+)/i);
    if (payer) {
      if (payer[1] === '99999') {
        ensure('rules');
        notes.push('Payer 99999 is already a house rule, so I will apply the house rules.');
      } else {
        add(makeStep('filter', 'Payer', `is not ${payer[1]}`, on));
      }
    }

    // Under $N
    const under = t.match(/\b(?:under|less than|below)\s+\$\s?(\d+(?:\.\d+)?)/i);
    if (under) {
      if (Number(under[1]) === 5) {
        ensure('rules');
        notes.push('Nothing under $5 goes out. That is a house rule already.');
      } else {
        add(makeStep('filter', sc?.money || 'Balance', `is at least ${under[1]}`, on));
      }
    }

    // Payment plans
    if (/payment plans?/i.test(t) && /(leave out|skip|exclude|without|not on|leave .* alone|ignore)/i.test(t) && !has('filter', 'Payment plan')) {
      add(makeStep('filter', 'Payment plan', 'is No', { screen: 'balances' }));
    }

    // Read a column
    const read = t.match(new RegExp(String.raw`\bread\s+(?:the\s+)?(.+?)(?:\s+column)?${END}`, 'i'));
    if (read) add(makeStep('read', title(clean(read[1])), undefined, on));
    else if (/\b(pull|grab|collect|get)\b/i.test(t) && sc?.money && !has('read')) add(makeStep('read', sc.money, undefined, on));

    const leaving = /\b(export|download|save|put|move|upload|send)\b/i.test(t);
    if (leaving) ensure('rules');
    if (leaving || /\b(show me|let me (?:see|check|look)|before (?:anything|it) (?:leaves|goes))/i.test(t)) ensure('review');

    // Export
    if (/\bexport\b/i.test(t)) {
      if (!has('click', 'Export')) add(makeStep('click', 'Export', undefined, on));
      ensure('download');
    }
    if (/\bdownload\b/i.test(t)) ensure('download');

    // Save to / upload to
    const save = t.match(new RegExp(String.raw`\b(?:save|put|move|drop|export|send)\b.*?\b(?:to|in|into)\s+(?!print\b)(?:the\s+)?(.+?)${END}`, 'i'));
    const upload = t.match(new RegExp(String.raw`\bupload\b.*?\b(?:to|into|on)\s+(?:the\s+)?(.+?)${END}`, 'i'));
    if (upload) {
      ensure('download');
      add(makeStep('upload', null, destination(upload[1])));
    } else if (save) {
      const dest = destination(save[1]);
      ensure('download');
      if (!has('saveTo')) add(makeStep('saveTo', null, dest));
    }

    // Tell someone
    const notify = t.match(/\blet\s+(?!me\b)([\w\s]+?)\s+know\b/i) ?? t.match(new RegExp(String.raw`\b(?:tell|notify|email|message)\s+(?!me\b)(.+?)${END}`, 'i'));
    if (notify) {
      ensure('review');
      add(makeStep('notify', null, clean(notify[1])));
    }

    if (added.length === 0) {
      return {
        steps: current,
        reply: notes[0] ?? 'I did not catch that. Try something like “open the balances screen” or “only people over 30 days”.',
      };
    }

    const firstBuild = current.length === 0;
    let reply: string;
    if (firstBuild) reply = `Done. I wrote ${added.length} steps. Click any step to see what it points at.`;
    else if (added.length === 1) reply = `Added: “${added[0].sentence}”`;
    else reply = `Added ${added.length} steps.`;
    if (notes.length) reply += ` ${notes.join(' ')}`;

    const askHold = firstBuild && steps.some((s) => s.verb === 'rules');
    return askHold
      ? { steps, reply, question: 'hold-5000' }
      : { steps, reply };
  },
};

export const HOLD_QUESTION = 'Should I still hold anything over $5,000 for you?';

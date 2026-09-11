import type { LogLine, LogTone, Step } from './types';

export const clock = (d = new Date()) => d.toTimeString().slice(0, 8);

export const line = (text: string, tone: LogTone = 'ok', d?: Date): LogLine => ({ t: clock(d), text, tone });

export function duration(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s`;
  const s = Math.round((ms % 60_000) / 1000);
  return `${Math.floor(ms / 60_000)}m ${String(s).padStart(2, '0')}s`;
}

export interface LineDetail {
  label?: string;
  count?: number;
  pct?: number;
  file?: string | null;
  dest?: string;
  skipped?: number;
  held?: number;
}

/** What a finished step looks like in the run log: plain past tense, as if the workflow wrote it. */
export function doneLine(step: Step, d: LineDetail = {}): string {
  const label = d.label ?? step.bind ?? '';
  switch (step.verb) {
    case 'open':
      return `Opened the ${label} screen.`;
    case 'filter':
      return `Kept rows where ${label} ${step.value} — ${d.count ?? 0} left.`;
    case 'read':
      return `Read the ${label} column — ${d.count ?? 0} rows, ${d.pct ?? 0}% sure.`;
    case 'table':
      return `Read the ${label} — ${d.count ?? 0} rows.`;
    case 'click':
    case 'submit':
      return `Clicked ${label}.`;
    case 'type':
      return `Typed ${step.value} into ${label}.`;
    case 'choose':
      return `Chose ${step.value} from ${label}.`;
    case 'date':
      return `Set ${label} to ${step.value}.`;
    case 'tick':
      return `Ticked ${label}.`;
    case 'await':
      return `${label} appeared.`;
    case 'rules':
      return `Applied house rules — ${d.skipped ?? 0} skipped, ${d.held ?? 0} held for you.`;
    case 'goto':
      return `Went to ${step.value}.`;
    case 'back':
      return 'Went back one page.';
    case 'pause':
      return `Waited ${step.value} seconds.`;
    case 'branch':
      return `Checked whether ${step.value} — took the Yes path.`;
    case 'download':
      return `Caught ${d.file ?? 'the file'}.`;
    case 'saveTo':
      return `Saved it to ${d.dest ?? step.value}.`;
    case 'upload':
      return `Uploaded it to ${d.dest ?? step.value}.`;
    case 'notify':
      return `Let ${step.value} know it is done.`;
    default:
      return step.sentence;
  }
}

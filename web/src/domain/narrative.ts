import { money } from './houseRules';

export interface RunSummary {
  mode: 'dry' | 'run';
  read: number;
  outOfScope: number;
  kept: number;
  skipped: number;
  held: number;
  total: number;
  approved?: boolean;
  fileName?: string | null;
  sentTo?: string[];
  stoppedAt?: { step: number; want: string; closest?: string | null; pct: number } | null;
  learned?: { step: number; from: string; to: string }[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Run history is written as plain prose, as if by the automation itself. */
export function narrate(s: RunSummary): string {
  const parts: string[] = [];

  for (const l of s.learned ?? []) {
    parts.push(
      `At step ${l.step} the ${l.from} column was gone. You told me ${l.to} is the same thing, so I pointed the step at ${l.to} and carried on. I will remember that next time.`,
    );
  }

  if (s.stoppedAt) {
    const closest = s.stoppedAt.closest ? ` The closest thing on the screen was ${s.stoppedAt.closest}, and I was only ${s.stoppedAt.pct}% sure.` : '';
    parts.push(
      `Stopped at step ${s.stoppedAt.step}. I was looking for ${s.stoppedAt.want} and could not find it with enough confidence.${closest} Nothing was read and nothing was saved. It is waiting for you to take a look.`,
    );
    return parts.join(' ');
  }

  const counts = `Read ${plural(s.read, 'row')}${s.outOfScope ? `, left ${s.outOfScope} out of scope` : ''}, kept ${s.kept}, skipped ${s.skipped} by house rule, held ${s.held} for you.`;

  if (s.mode === 'dry') {
    parts.push(`Dry run only. ${counts} I would have put ${plural(s.kept, 'row')} totalling ${money(s.total)} in the file. Nothing left the browser.`);
    return parts.join(' ');
  }

  if (!s.approved) {
    parts.push(`${counts} You did not approve it, so nothing left the browser.`);
    return parts.join(' ');
  }

  const where = s.sentTo && s.sentTo.length ? ` and moved it on to ${s.sentTo.join(' and ')}` : '';
  parts.unshift(parts.length ? 'Ran with one question.' : 'Ran clean.');
  parts.push(`${counts} You approved it, so I caught the download${s.fileName ? ` (${s.fileName})` : ''}${where}. I did not write anything back into PracticeSuite.`);
  return parts.join(' ');
}

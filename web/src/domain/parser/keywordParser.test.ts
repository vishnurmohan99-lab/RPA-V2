import { describe, expect, it } from 'vitest';
import { keywordParser } from './keywordParser';

describe('keyword parser', () => {
  const first = keywordParser.parse(
    'open the balances screen, pull anyone over 30 days, skip payer 99999, export it to the billing share',
    [],
  );

  it('writes the whole statements automation from one message', () => {
    expect(first.steps.map((s) => s.verb)).toEqual(['open', 'filter', 'read', 'rules', 'review', 'click', 'download', 'saveTo']);
    expect(first.steps[0].sentence).toBe('Open the Balances screen.');
    expect(first.steps[1].sentence).toBe('Keep only rows where Age (days) is over 30.');
    expect(first.steps[2].sentence).toBe('Read the Balance for every row.');
    expect(first.steps[7].sentence).toBe('Put the file in Billing share.');
    expect(first.question).toBe('hold-5000');
  });

  it('inserts exactly one step for a follow-up', () => {
    const next = keywordParser.parse('actually leave out anyone on a payment plan', first.steps);
    expect(next.steps).toHaveLength(first.steps.length + 1);
    const idx = next.steps.findIndex((s) => s.bind === 'Payment plan');
    expect(idx).toBe(3);
    expect(next.reply).toContain('Payment plan');
  });

  it('answers the hold question without changing steps', () => {
    const r = keywordParser.parse('yes please', first.steps, { pending: 'hold-5000' });
    expect(r.steps).toBe(first.steps);
    expect(r.reply).toMatch(/\$5,000/);
  });

  it('handles upload and show me first', () => {
    const r = keywordParser.parse('open balances, download the export and upload it to the print vendor. show me first', []);
    const verbs = r.steps.map((s) => s.verb);
    expect(verbs).toContain('upload');
    expect(verbs.indexOf('review')).toBeLessThan(verbs.indexOf('upload'));
    expect(r.steps.find((s) => s.verb === 'upload')?.value).toBe('Statement vendor portal');
  });

  it('replies plainly when it does not understand', () => {
    const r = keywordParser.parse('hmm', []);
    expect(r.steps).toHaveLength(0);
    expect(r.reply).not.toMatch(/[{}<>]/);
  });
});

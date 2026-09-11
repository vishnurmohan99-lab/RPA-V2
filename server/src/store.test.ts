import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { DESTINATIONS } from './destinations.js';
import { FileStore } from './files.js';
import { JsonStore, safeName, validateSignIns } from './store.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('JsonStore', () => {
  it('round-trips data', () => {
    const s = new JsonStore(path.join(tmp, 'data'));
    expect(s.read('automations')).toBeNull();
    s.write('automations', [{ id: 'a', steps: [] }]);
    expect(s.read('automations')).toEqual([{ id: 'a', steps: [] }]);
  });
});

describe('sign-ins', () => {
  it('accepts a label and a username', () => {
    expect(validateSignIns([{ id: 'c1', label: 'Billing', user: 'diane' }])).toBe(true);
  });
  it('refuses anything carrying a secret', () => {
    expect(validateSignIns([{ id: 'c1', label: 'Billing', user: 'diane', password: 'x' }])).toBe(false);
    expect(validateSignIns({ id: 'c1' })).toBe(false);
  });
});

describe('FileStore', () => {
  it('keeps a file, copies it to a folder destination, and deletes it', () => {
    const fsStore = new FileStore(path.join(tmp, 'files'), path.join(tmp, 'destinations'));
    const kept = fsStore.add(Buffer.from('a,b\r\n1,2\r\n'), 'statements.csv', 'auto-1', 'run-1');
    expect(fsStore.list()).toHaveLength(1);
    const share = DESTINATIONS.find((d) => d.id === 'billing-share')!;
    const sent = fsStore.send(kept.id, share);
    expect(sent?.sentTo).toEqual(['Billing share']);
    expect(fs.existsSync(path.join(tmp, 'destinations', 'billing-share', 'statements.csv'))).toBe(true);
    expect(fsStore.remove(kept.id)).toBe(true);
    expect(fsStore.list()).toHaveLength(0);
  });

  it('never lets a file name escape its folder', () => {
    expect(safeName('../../etc/passwd')).toBe('passwd');
  });
});

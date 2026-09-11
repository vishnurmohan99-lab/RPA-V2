import fs from 'node:fs';
import path from 'node:path';

/** Tiny JSON-file store. Writes go to a temp file first, then rename, so a crash never leaves half a file. */
export class JsonStore {
  constructor(private dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }

  read<T>(name: string): T | null {
    const file = path.join(this.dir, `${name}.json`);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  }

  write(name: string, data: unknown): void {
    const file = path.join(this.dir, `${name}.json`);
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  }
}

export interface SignInRecord {
  id: string;
  label: string;
  user: string;
}

const SIGN_IN_KEYS = ['id', 'label', 'user'];

/** A sign-in is a name and a username. Anything else — a password above all — is refused. */
export function validateSignIns(value: unknown): value is SignInRecord[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        v !== null &&
        typeof v === 'object' &&
        Object.keys(v).length === SIGN_IN_KEYS.length &&
        SIGN_IN_KEYS.every((k) => typeof (v as Record<string, unknown>)[k] === 'string'),
    )
  );
}

export const isSafeId = (s: string) => /^[\w.-]{1,120}$/.test(s) && !s.includes('..');

export const safeName = (s: string) =>
  path
    .basename(s)
    .replace(/[^\w.\- ]/g, '_')
    .slice(0, 120) || 'file';

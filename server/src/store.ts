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
  /** Not a secret — an account/practice number some sites ask for alongside username+password. */
  account?: string;
}

const SIGN_IN_REQUIRED_KEYS = ['id', 'label', 'user'];
const SIGN_IN_ALLOWED_KEYS = new Set(['id', 'label', 'user', 'account']);

/** A sign-in is a name, a username, and optionally an account number. Anything else — a password above all — is refused. */
export function validateSignIns(value: unknown): value is SignInRecord[] {
  return (
    Array.isArray(value) &&
    value.every((v) => {
      if (v === null || typeof v !== 'object') return false;
      const keys = Object.keys(v as Record<string, unknown>);
      if (!keys.every((k) => SIGN_IN_ALLOWED_KEYS.has(k))) return false;
      const rec = v as Record<string, unknown>;
      return (
        SIGN_IN_REQUIRED_KEYS.every((k) => typeof rec[k] === 'string') && (rec.account === undefined || typeof rec.account === 'string')
      );
    })
  );
}

export const isSafeId = (s: string) => /^[\w.-]{1,120}$/.test(s) && !s.includes('..');

export const safeName = (s: string) =>
  path
    .basename(s)
    .replace(/[^\w.\- ]/g, '_')
    .slice(0, 120) || 'file';

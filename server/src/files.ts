import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Destination } from './destinations.js';
import { isSafeId, JsonStore, safeName } from './store.js';

export interface KeptFile {
  id: string;
  name: string;
  size: number;
  created: string;
  automationId: string | null;
  runId: string | null;
  sentTo: string[];
  rel: string;
}

/** Files the automations catch are kept here, locally, until someone deletes them. */
export class FileStore {
  private index: JsonStore;

  constructor(private root: string, private destinationsRoot: string) {
    fs.mkdirSync(root, { recursive: true });
    this.index = new JsonStore(root);
  }

  list(): KeptFile[] {
    return this.index.read<KeptFile[]>('files') ?? [];
  }

  private save(files: KeptFile[]) {
    this.index.write('files', files);
  }

  get(id: string): KeptFile | null {
    return this.list().find((f) => f.id === id) ?? null;
  }

  pathOf(file: KeptFile): string {
    return path.join(this.root, file.rel);
  }

  add(data: Buffer, name: string, automationId?: string | null, runId?: string | null): KeptFile {
    const id = `f-${crypto.randomUUID().slice(0, 8)}`;
    const folder = path.join(automationId && isSafeId(automationId) ? automationId : 'unsorted', runId && isSafeId(runId) ? runId : id);
    fs.mkdirSync(path.join(this.root, folder), { recursive: true });
    const clean = safeName(name);
    const rel = path.join(folder, clean);
    fs.writeFileSync(path.join(this.root, rel), data);
    const file: KeptFile = {
      id,
      name: clean,
      size: data.length,
      created: new Date().toISOString(),
      automationId: automationId ?? null,
      runId: runId ?? null,
      sentTo: [],
      rel,
    };
    this.save([file, ...this.list()]);
    return file;
  }

  /** Copy to a folder destination, or just record a web upload that the runner performed. */
  send(id: string, dest: Destination): KeptFile | null {
    const files = this.list();
    const file = files.find((f) => f.id === id);
    if (!file) return null;
    if (dest.kind === 'folder') {
      const dir = path.join(this.destinationsRoot, dest.id);
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(this.pathOf(file), path.join(dir, file.name));
    }
    if (!file.sentTo.includes(dest.label)) file.sentTo.push(dest.label);
    this.save(files);
    return file;
  }

  remove(id: string): boolean {
    const files = this.list();
    const file = files.find((f) => f.id === id);
    if (!file) return false;
    fs.rmSync(this.pathOf(file), { force: true });
    this.save(files.filter((f) => f.id !== id));
    return true;
  }
}

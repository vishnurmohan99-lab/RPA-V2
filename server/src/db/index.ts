import fs from 'node:fs';
import type { Destination } from '../destinations.js';
import { FileStore as LocalFileStore } from '../files.js';
import { JsonStore as LocalJsonStore } from '../store.js';
import { hasSupabase } from './client.js';
import { SupabaseFileStore } from './fileStore.js';
import { SupabaseStore, type Collection } from './store.js';

export interface Store {
  read<T>(name: Collection): Promise<T | null>;
  write(name: Collection, items: unknown[]): Promise<void>;
  addRun(run: unknown): Promise<void>;
  rebindStep(automationId: string, stepId: string, label: string): Promise<void>;
}

export interface AppFile {
  id: string;
  name: string;
  size: number;
  created: string;
  automationId: string | null;
  runId: string | null;
  sentTo: string[];
}

export interface AppFileStore {
  list(): Promise<AppFile[]>;
  get(id: string): Promise<AppFile | null>;
  add(data: Buffer, name: string, automationId?: string | null, runId?: string | null): Promise<AppFile>;
  download(file: AppFile): Promise<Buffer>;
  send(id: string, dest: Destination): Promise<AppFile | null>;
  remove(id: string): Promise<boolean>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
class LocalStoreAdapter implements Store {
  constructor(private json: LocalJsonStore) {}
  async read<T>(name: Collection) {
    return this.json.read<T>(name);
  }
  async write(name: Collection, items: unknown[]) {
    this.json.write(name, items);
  }
  async addRun(run: any) {
    const history = this.json.read<any[]>('history') ?? [];
    if (!history.some((h) => h.id === run.id)) this.json.write('history', [run, ...history].slice(0, 500));
  }
  async rebindStep(automationId: string, stepId: string, label: string) {
    const list = this.json.read<any[]>('automations') ?? [];
    const next = list.map((a) => (a.id !== automationId ? a : { ...a, steps: a.steps.map((s: any) => (s.id === stepId ? { ...s, bind: label } : s)) }));
    this.json.write('automations', next);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

class LocalFileAdapter implements AppFileStore {
  constructor(private local: LocalFileStore) {}
  async list() {
    return this.local.list();
  }
  async get(id: string) {
    return this.local.get(id);
  }
  async add(data: Buffer, name: string, automationId?: string | null, runId?: string | null) {
    return this.local.add(data, name, automationId, runId);
  }
  async download(file: AppFile) {
    const full = this.local.get(file.id);
    if (!full) throw new Error('That file is not here any more.');
    return fs.readFileSync(this.local.pathOf(full));
  }
  async send(id: string, dest: Destination) {
    return this.local.send(id, dest);
  }
  async remove(id: string) {
    return this.local.remove(id);
  }
}

/**
 * Supabase when it's configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), local JSON files
 * and disk otherwise — so a fresh clone still runs with zero setup, the same offline-friendly
 * principle the client already applies to "is the server even reachable."
 */
export function createStore(dataDir: string): Store {
  if (hasSupabase()) {
    console.log('[atlas] saved data: Supabase');
    return new SupabaseStore();
  }
  console.log('[atlas] saved data: local JSON files (set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY to use Supabase instead)');
  return new LocalStoreAdapter(new LocalJsonStore(dataDir));
}

export function createFileStore(filesDir: string, destinationsDir: string): AppFileStore {
  if (hasSupabase()) {
    console.log('[atlas] kept files: Supabase Storage');
    return new SupabaseFileStore();
  }
  console.log('[atlas] kept files: local disk');
  return new LocalFileAdapter(new LocalFileStore(filesDir, destinationsDir));
}

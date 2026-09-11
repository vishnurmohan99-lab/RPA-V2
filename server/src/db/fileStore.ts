import crypto from 'node:crypto';
import { getSupabase } from './client.js';
import type { Destination } from '../destinations.js';
import { isSafeId, safeName } from '../store.js';

export interface KeptFile {
  id: string;
  name: string;
  size: number;
  created: string;
  automationId: string | null;
  runId: string | null;
  sentTo: string[];
  storagePath: string;
}

const BUCKET = 'files';

/**
 * Kept files, backed by Supabase Storage + the kept_files table — replaces the old local-disk
 * FileStore. Same public shape (minus `rel`, which was a local-path implementation detail; this
 * one has `storagePath`, the object key inside the bucket, which callers outside this file don't
 * need to touch). "Send to a folder destination" copies the object to `destinations/<destId>/...`
 * inside the same private bucket, standing in for the old copy-to-a-local-folder behaviour.
 */
export class SupabaseFileStore {
  async list(): Promise<KeptFile[]> {
    const db = getSupabase();
    const { data, error } = await db.from('kept_files').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(fromRow);
  }

  async get(id: string): Promise<KeptFile | null> {
    const db = getSupabase();
    const { data, error } = await db.from('kept_files').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? fromRow(data) : null;
  }

  async add(data: Buffer, name: string, automationId?: string | null, runId?: string | null): Promise<KeptFile> {
    const db = getSupabase();
    const id = `f-${crypto.randomUUID().slice(0, 8)}`;
    const clean = safeName(name);
    const folder = `${automationId && isSafeId(automationId) ? automationId : 'unsorted'}/${runId && isSafeId(runId) ? runId : id}`;
    const storagePath = `${folder}/${clean}`;

    const up = await db.storage.from(BUCKET).upload(storagePath, data, { contentType: 'text/csv', upsert: true });
    if (up.error) throw new Error(up.error.message);

    const row = {
      id,
      name: clean,
      size: data.length,
      storage_path: storagePath,
      automation_id: automationId ?? null,
      run_id: runId ?? null,
      sent_to: [] as string[],
    };
    const { error } = await db.from('kept_files').insert(row);
    if (error) throw new Error(error.message);
    return { id, name: clean, size: data.length, created: new Date().toISOString(), automationId: automationId ?? null, runId: runId ?? null, sentTo: [], storagePath };
  }

  async download(file: KeptFile): Promise<Buffer> {
    const db = getSupabase();
    const { data, error } = await db.storage.from(BUCKET).download(file.storagePath);
    if (error || !data) throw new Error(error?.message ?? 'That file is not here any more.');
    return Buffer.from(await data.arrayBuffer());
  }

  async send(id: string, dest: Destination): Promise<KeptFile | null> {
    const db = getSupabase();
    const file = await this.get(id);
    if (!file) return null;
    if (dest.kind === 'folder') {
      const copyPath = `destinations/${dest.id}/${file.name}`;
      const { error } = await db.storage.from(BUCKET).copy(file.storagePath, copyPath);
      if (error && !error.message.toLowerCase().includes('already exists')) throw new Error(error.message);
    }
    const sentTo = file.sentTo.includes(dest.label) ? file.sentTo : [...file.sentTo, dest.label];
    const { error: upErr } = await db.from('kept_files').update({ sent_to: sentTo }).eq('id', id);
    if (upErr) throw new Error(upErr.message);
    return { ...file, sentTo };
  }

  async remove(id: string): Promise<boolean> {
    const db = getSupabase();
    const file = await this.get(id);
    if (!file) return false;
    await db.storage.from(BUCKET).remove([file.storagePath]);
    const { error } = await db.from('kept_files').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  }
}

function fromRow(row: Record<string, unknown>): KeptFile {
  return {
    id: row.id as string,
    name: row.name as string,
    size: row.size as number,
    created: row.created_at as string,
    automationId: (row.automation_id as string | null) ?? null,
    runId: (row.run_id as string | null) ?? null,
    sentTo: (row.sent_to as string[]) ?? [],
    storagePath: row.storage_path as string,
  };
}

import { getSupabase } from './client.js';

export type Collection = 'automations' | 'rules' | 'signins' | 'history';

const TABLE: Record<Collection, string> = {
  automations: 'automations',
  rules: 'house_rules',
  signins: 'sign_ins',
  history: 'run_history',
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRow(name: Collection, item: any, index: number): any {
  switch (name) {
    case 'automations':
      return {
        id: item.id,
        name: item.name,
        created_by: item.createdBy,
        start_url: item.startUrl ?? '',
        cred_id: item.credId ?? '',
        destination: item.destination ?? '',
        screen: item.screen,
        status: item.status,
        last_run: item.lastRun,
        clean_dry_run: !!item.cleanDryRun,
        steps: item.steps ?? [],
        edges: item.edges ?? [],
      };
    case 'rules':
      return { id: item.id, text: item.text, on: item.on, sort_order: index };
    case 'signins':
      return { id: item.id, label: item.label, user: item.user };
    case 'history':
      return {
        id: item.id,
        automation_id: item.automationId,
        automation_name: item.automationName,
        step_id: item.stepId ?? null,
        outcome: item.outcome,
        narrative: item.narrative,
        rows_read: item.rowsRead ?? 0,
        rows_kept: item.rowsKept ?? 0,
        rows_skipped: item.rowsSkipped ?? 0,
        rows_held: item.rowsHeld ?? 0,
        file_produced: item.fileProduced ?? null,
        file_id: item.fileId ?? null,
        trigger: item.trigger ?? null,
        duration: item.duration ?? null,
        steps_line: item.stepsLine ?? null,
        log: item.log ?? [],
        when_label: item.when,
      };
  }
}

function fromRow(name: Collection, row: any): any {
  switch (name) {
    case 'automations':
      return {
        id: row.id,
        name: row.name,
        createdBy: row.created_by,
        startUrl: row.start_url,
        credId: row.cred_id,
        destination: row.destination,
        screen: row.screen,
        status: row.status,
        lastRun: row.last_run,
        cleanDryRun: row.clean_dry_run,
        steps: row.steps ?? [],
        edges: row.edges ?? [],
      };
    case 'rules':
      return { id: row.id, text: row.text, on: row.on };
    case 'signins':
      return { id: row.id, label: row.label, user: row.user };
    case 'history':
      return {
        id: row.id,
        automationId: row.automation_id,
        automationName: row.automation_name,
        when: row.when_label,
        outcome: row.outcome,
        narrative: row.narrative,
        rowsRead: row.rows_read,
        rowsKept: row.rows_kept,
        rowsSkipped: row.rows_skipped,
        rowsHeld: row.rows_held,
        fileProduced: row.file_produced,
        fileId: row.file_id,
        log: row.log ?? [],
        trigger: row.trigger,
        duration: row.duration,
        stepsLine: row.steps_line,
        stepId: row.step_id,
      };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Newest-first for automations/history (matches the client reducer, which prepends); rules
// keep the fixed order they were written in; sign-ins read oldest-first (creation order).
const ORDER: Record<Collection, { col: string; asc: boolean }> = {
  automations: { col: 'created_at', asc: false },
  rules: { col: 'sort_order', asc: true },
  signins: { col: 'created_at', asc: true },
  history: { col: 'created_at', asc: false },
};

/**
 * Same read/write-by-name shape the old JsonStore had, backed by Supabase tables instead of
 * local JSON files — kept deliberately close to that shape so app.ts/runner/mount.ts only
 * needed `await` added, not a rewrite. An empty table reads as `null`, not `[]`, matching the
 * old "the file doesn't exist yet" signal the client uses to decide whether to seed on first
 * boot (see web/src/state/persistence.ts) — so a table that's been emptied by deleting
 * everything in it will look like "never seeded" and get reseeded from the client's built-in
 * demo data. That's the same quirk the JSON version had; harmless for this prototype.
 */
export class SupabaseStore {
  async read<T>(name: Collection): Promise<T | null> {
    const db = getSupabase();
    const { col, asc } = ORDER[name];
    const { data, error } = await db.from(TABLE[name]).select('*').order(col, { ascending: asc });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return null;
    return data.map((r) => fromRow(name, r)) as unknown as T;
  }

  /** Replaces the whole collection: upserts what's given, deletes whatever else was there. */
  async write(name: Collection, items: unknown[]): Promise<void> {
    const db = getSupabase();
    const table = TABLE[name];
    const rows = (items as any[]).map((it, i) => toRow(name, it, i));
    if (rows.length) {
      const { error } = await db.from(table).upsert(rows);
      if (error) throw new Error(error.message);
    }
    const ids = rows.map((r) => r.id as string);
    const del = db.from(table).delete();
    const { error: delError } = ids.length
      ? await del.not('id', 'in', `(${ids.map((id) => `"${id.replace(/"/g, '""')}"`).join(',')})`)
      : await del.neq('id', '__none__');
    if (delError) throw new Error(delError.message);
  }

  /** Appends one run without resending the whole history (POST /api/history). */
  async addRun(run: unknown): Promise<void> {
    const db = getSupabase();
    const { error } = await db.from('run_history').upsert(toRow('history', run, 0));
    if (error) throw new Error(error.message);
  }

  /** Used by the live-runner's stop-and-ask fix-up: rebind one step inside one saved workflow. */
  async rebindStep(automationId: string, stepId: string, label: string): Promise<void> {
    const db = getSupabase();
    const { data, error } = await db.from('automations').select('steps').eq('id', automationId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return;
    const steps = ((data.steps as { id: string; bind: string | null }[]) ?? []).map((s) => (s.id === stepId ? { ...s, bind: label } : s));
    const { error: upErr } = await db.from('automations').update({ steps }).eq('id', automationId);
    if (upErr) throw new Error(upErr.message);
  }
}

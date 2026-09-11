import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export const hasSupabase = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * One client for the whole server, using the service_role key — this key bypasses Row Level
 * Security, which is exactly right here: the Express server is the only thing that ever talks
 * to Supabase (no browser-side client exists), so it's the trusted boundary, the same way the
 * old JsonStore trusted its own local disk. The key itself lives only in the server's own
 * environment, never in a request, a workflow, or run history — same rule as a sign-in's
 * password (see runner/credentials.ts).
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set — see .env.example.');
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

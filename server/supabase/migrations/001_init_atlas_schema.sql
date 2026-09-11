-- Atlas Automation: workflows, house rules, sign-ins, run history, kept files.
-- Mirrors web/src/domain/types.ts. jsonb columns hold the shapes the client already
-- serializes (Step[], Edge[], LogLine[], etc.) rather than fully normalizing them --
-- this is a single-tenant prototype, not a multi-tenant SaaS schema.
--
-- Applied via the Supabase MCP (apply_migration), not run automatically by this app.
-- Kept here for reproducibility -- see CLAUDE.md's "Server" section for the project this
-- was applied to.

create table automations (
  id text primary key,
  name text not null,
  created_by text not null,
  start_url text not null default '',
  cred_id text not null default '',
  destination text not null default '',
  screen text not null default 'balances',
  status text not null default 'never' check (status in ('ready', 'attention', 'never')),
  last_run text not null default 'Never run',
  clean_dry_run boolean not null default false,
  steps jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table house_rules (
  id text primary key,
  text text not null,
  "on" boolean not null default true,
  sort_order int not null default 0
);

-- A sign-in is a name and a username only -- never a password. Enforced again in the
-- server's insert/update path, same as validateSignIns() on the local JSON store.
create table sign_ins (
  id text primary key,
  label text not null,
  "user" text not null,
  -- Not a secret -- an account/practice number some real sites ask for alongside username+password.
  account text,
  created_at timestamptz not null default now()
);

create table run_history (
  id text primary key,
  automation_id text references automations(id) on delete set null,
  automation_name text not null,
  step_id text,
  outcome text not null check (outcome in ('clean', 'attention', 'stopped', 'preview', 'change', 'failed')),
  narrative text not null,
  rows_read int not null default 0,
  rows_kept int not null default 0,
  rows_skipped int not null default 0,
  rows_held int not null default 0,
  file_produced text,
  file_id text,
  trigger text,
  duration text,
  steps_line text,
  log jsonb not null default '[]'::jsonb,
  when_label text not null,
  created_at timestamptz not null default now()
);
create index run_history_automation_idx on run_history (automation_id, created_at desc);

-- Kept files' bytes live in Supabase Storage (bucket "files"); this is the index/metadata,
-- replacing the local disk version's files.json. storage_path is the object key in that bucket.
create table kept_files (
  id text primary key,
  name text not null,
  size int not null default 0,
  storage_path text not null,
  automation_id text references automations(id) on delete set null,
  run_id text,
  sent_to jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index kept_files_automation_idx on kept_files (automation_id);

-- No browser-side Supabase client exists in this app -- the Express server is the only
-- reader/writer, using the service_role key, which bypasses RLS. Enabling RLS with no
-- policies means the anon/publishable key (were it ever used) gets nothing.
alter table automations enable row level security;
alter table house_rules enable row level security;
alter table sign_ins enable row level security;
alter table run_history enable row level security;
alter table kept_files enable row level security;

-- Kept files (the CSVs a run catches). Private bucket -- only the server's service_role key
-- reads/writes it, same trust model as the tables above.
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

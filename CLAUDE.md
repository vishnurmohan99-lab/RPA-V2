# Atlas Automation — CLAUDE.md

Hackathon prototype for Paid.MD / PracticeSuite (dossier: "The Practice Workshop"). A non-technical office manager (Diane) builds, tries and watches her own PracticeSuite automations in plain English. **Steps point at things by name, not by selector** — every run re-resolves the target against what's actually on screen, scores the match, and stops to ask if it isn't confident. That resolve-by-meaning behaviour is the whole point of the project; never cut it, even under time pressure.

Full background: `CLAUDE-CODE-BRIEF.md` is not in this repo (it's the original hackathon brief the user pasted at project start — ask for it if you need the source dossier). The plan this was built from lives in the user's `~/.claude/plans/` history, not here.

## Two workspaces, one repo

```
RPA-V2/
  web/     React + Vite + TS + Tailwind — the whole UI, plus a synthetic PracticeSuite clone
  server/  Express, no DB — JSON-file persistence, kept files, destinations
  Design/  NOT committed (see "Design/ folder" below)
```

`npm run dev` (repo root) runs both via `concurrently`: web on :5173, server on :3001, Vite proxies `/api` and `/live` to the server. `npm test` runs both test suites. `npm run build` builds both; `npm start` serves the built web app **from the server** (`server/src/index.ts` serves `web/dist` when it exists, so one process does everything in production).

## Domain model — read these first

- **`web/src/domain/types.ts`** — `Step`, `Automation` (called "workflow" in the UI, `Automation` in code — don't rename the type), `Edge`, `HouseRuleState`, `SignIn` (name + username, **never** a password field), `RunRecord`.
- **`web/src/domain/actions.ts`** — `ACTIONS` registry. **Adding a verb is one object here, nothing else.** Each `ActionDef` has `resolves: 'screen'|'page'|'edge'` (screen = binder-matched on the tenant; page = happens to the flow itself; edge = leaves the browser, gated behind approval) and `kinds` (which `data-kind`s it may bind to — this scoping is what makes the binder safe, see below).
- **`web/src/domain/binder.ts`** — `resolve()` / `score()`. Matches a step's target name against `[data-label]` elements in the synthetic tenant, scoped by `kind` (a `read` step only ever matches `column`s, never a nav item or page title). `THRESHOLD = 0.75`. A small synonym table (`SYNONYMS`) scores known renames (Balance↔Amount Due, Check #↔Payment Ref) at a fixed 0.62 — below threshold, so it still stops and asks, but flags the right closest match.
  - **This intentionally differs from the original brief's `score()`.** The brief's formula let "Balance" bind to the "Balances" nav item (substring match) and, after a rename, picked the wrong closest match. Kind-scoping + synonyms fixed both; see `binder.test.ts` for the specific cases this guards.
- **`web/src/domain/flow.ts`** — the step graph. Steps run in `orderSteps()` order: start at the step with no incoming edge, follow the first wire (or the "Yes" wire after a `branch` split — the "No" path is drawn but **never executes**, matching the original Atlas Workflow design prototype). `insertAfter`/`removeNode`/`addBranch`/`syncOrder`/`layout` all operate on `{steps, edges}` — always go through these, don't hand-edit `automation.steps`/`.edges`.
- **`web/src/domain/houseRules.ts`** — `RULE_DEFS`, first-match-wins, `hold` (waits for approval) vs skip. The seeded arithmetic (`web/src/domain/seed.ts` `BALANCES`) must keep producing 5 kept rows / $2,516.15 — tests pin this exact number.
- **`web/src/domain/runlog.ts`** / **`narrative.ts`** — plain-English, past-tense run logs and summaries. Never emit JSON, a selector, or a stack trace into anything Diane reads — this is a hard rule from the brief, still enforced.

## Runner (`web/src/pages/builder/useRunner.ts`)

Drives a workflow against the synthetic tenant DOM, step-by-step, re-resolving every screen-target via the binder on every run (never trusts a cached `lastBoundTo`). Two modes: `dry` (previews, nothing downloads) and `run` (stops at the `review` step for approval before any `edge` step executes). On a low-confidence stop it halts immediately, draws a red/amber box, and surfaces the closest match with a "Yes, that's it / Point at it / Not now" choice — confirming rewrites the step's `bind` and resumes from that step. This is the demo's key moment (see `web/src/domain/seed.ts` "Change the screen" mutation + the Balances screen's `mutated` prop, which renames `Balance→Amount Due` and reorders columns to simulate a UI redesign).

`signin` steps resolve to a saved `SignIn`'s **name only** — the runner never touches a password; the sign-in screen shows "Filled from the environment file" as a placeholder.

## Real-browser runner (`server/src/runner/`)

A second, complete runner that drives an actual Playwright/Chromium session against whatever real site the workflow's Starting URL points at — same step contract, same house rules, same approval gate as the in-app runner above, but reading a real unknown page instead of the synthetic tenant.

- **`score.ts`** is `web/src/domain/binder.ts`'s scoring ported by hand (kept in sync manually — there's no shared package between `web/` and `server/`). Same `THRESHOLD`, same synonyms.
- **`resolve.ts`** is the real-page equivalent of `candidatesIn()`: `page.evaluate()` walks the real DOM, computes an accessible-name guess per element (aria attributes → associated `<label>` → placeholder → title → visible text) and a `Kind` from its tag/role, and tags each candidate with a `data-atlas-ref` attribute so it can be re-selected for the actual click/fill after scoring picks a winner. **The in-page function is written as a plain JS string (`SCAN_SOURCE`), not a TS function reference** — tsx/esbuild injects a `__name(...)` helper into any compiled function passed to `page.evaluate`, and that helper doesn't exist in Playwright's isolated re-eval context, so it throws. A string literal never passes through esbuild's transform. Any new `page.evaluate()` call in this module must follow the same pattern.
- **`session.ts`** (`RunSession`, an `EventEmitter`) is the engine: launches a browser, screenshots on a ~700ms timer, walks `orderSteps()`, resolves each screen step and emits `highlight`/`log`/`attention` events, awaits an external `answer()`/`notNow()` on a stop, awaits `approve()`/`decline()` at `review`, and executes `download` via a persistent `page.on('download')` queue (buffered so a click-then-download across two steps isn't missed) with a same-shape CSV fallback when nothing real downloads. `rules.ts` maps whichever columns got `read` to the five house-rule fields by the same synonym scoring (best-effort — a real site's columns won't always match).
- **`mount.ts`** wires `POST /api/runs` (start) and `/api/runs/:runId/{answer,not-now,approve,decline,stop,pick}`, plus a `WebSocketServer` on `/live?runId=...` that replays buffered events to a late-connecting socket and broadcasts live ones. `credentials.ts` maps a sign-in's id to an env var (`cred-billing-ro` → `ATLAS_CRED_BILLING_RO`) — see `.env.example`.
- **Client side:** `web/src/pages/builder/useLiveRunner.ts` + `LiveBrowserPane.tsx`, wired into `Builder.tsx` behind the header's "Run in" dropdown. The synthetic `TenantFrame`/`AdjustPanel` stay available for **authoring** steps regardless of which target is selected (pointing at the mockup is still useful as a rough guide even when you'll run for real) — the live view only replaces them once `live.phase !== 'idle'`, i.e. an actual run is in progress or just finished. `ApprovalModal` is reused as-is for both runners.
  - `LiveBrowserPane`'s screenshot wrapper is CSS-locked to the screenshot's exact aspect ratio (`aspect-ratio: 1280/800`) so the wrapper's own box **is** the image's drawn rect — this is deliberate: an `object-contain` `<img>` inside a mismatched-aspect box letterboxes, and naively using the element's bounding rect for both the highlight-box overlay and the "point at it" click-to-coordinates math is wrong inside the bars. Don't reintroduce `object-contain` here without also reintroducing that math.
- **Verified against a real, unknown site** (the-internet.herokuapp.com — a public Selenium/Playwright practice site, chosen so no real credentials were ever needed) end-to-end through the actual UI: a mismatched sign-in button correctly stopped and asked (30% confidence), a real password from `.env` produced a real login (verified by matching the post-login page), a real column was misread as a mismatch and fixed both via "Yes, that's it" and via clicking directly on the live screenshot ("Point at it"), the approval gate blocked until approved, and both a real `page.on('download')` capture and the CSV-fallback path produced correct files on disk. Not exercised: `choose`/`date`/`tick`/`notify`/`branch` verbs in live mode, and `decline()`/mid-run `stop()`.
- **Not built:** automating a real third-party upload target — `upload` in live mode currently behaves like `saveTo` (copies locally) with a log line saying so.

## Server (`server/src/`)

- **`db/`** — the primary storage layer: **Supabase** (Postgres + Storage), used when `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are set.
  - `client.ts` — one lazily-created `SupabaseClient` using the **service_role** key (bypasses RLS; the Express server is the only trusted caller — there's no browser-side Supabase client anywhere in this app).
  - `store.ts` (`SupabaseStore`) — same `read(name)`/`write(name, items)`-by-collection-name shape the old `JsonStore` had (kept deliberately close so callers barely changed), mapping camelCase TS shapes to snake_case rows across the `automations`/`house_rules`/`sign_ins`/`run_history` tables. `write()` does a full replace: upsert what's given, delete whatever else was in the table — matching the old "send the whole array" semantics the client already uses. An **empty table reads as `null`**, not `[]`, on purpose — that's the signal `web/src/state/persistence.ts` uses to decide whether to seed on first boot; see the comment in `store.ts` for the (pre-existing, harmless) quirk this causes if someone deletes everything.
  - `fileStore.ts` (`SupabaseFileStore`) — kept files live in a private Storage bucket (`files`), indexed by the `kept_files` table. "Send to a folder destination" copies the object to `destinations/<destId>/...` inside the same bucket, standing in for the old copy-to-a-local-folder behaviour.
  - `index.ts` — `createStore()`/`createFileStore()` pick Supabase when configured, **local JSON files + disk otherwise** (via thin adapters wrapping the original `JsonStore`/`FileStore` classes in `server/src/store.ts`/`files.ts`, which still exist and are still tested). This fallback is deliberate: it keeps a fresh clone running with zero setup, the same offline-friendly principle the client already applies to "is the server reachable at all."
- **Supabase project**: `sonwtmnfkrotxzwoasvx` (org "Vishnu Test Server" on the account connected to the Supabase MCP). RLS is enabled with no policies on every table (deny-by-default for the anon/publishable key; service_role bypasses it) — that's intentional, not a gap to "fix." Schema/seed SQL is checked in at `server/supabase/migrations/` for reference — it was applied via the Supabase MCP (`apply_migration`/`execute_sql`) when the project was set up, not run automatically by this app; those files exist for reproducibility, not as a live migration runner.
- `store.ts` (top-level) / `files.ts` / `destinations.ts` — the original local-disk implementation: `JsonStore` (atomic write-then-rename) + `validateSignIns()`, which **rejects any object with fields beyond `{id,label,user}`** — the enforcement point for "no passwords, ever," same rule in both storage backends. Still the fallback when Supabase isn't configured.
- `app.ts` — all routes are wrapped (`wrap()`) so a rejected promise reaches the error middleware (Express 4 doesn't do this on its own); all error responses stay calm JSON messages (`{ message: '...' }`), never a raw error/stack trace.
- The web client (`web/src/state/persistence.ts`) debounce-saves to the server and falls back to **offline mode** ("Not saving right now" chip) if the server is unreachable — the whole demo must still run from seed data with the server off. Don't add a hard dependency on the server being up. Note this chip is about the *server*, not Supabase specifically — a static-only deploy (Vercel/Netlify) shows it permanently regardless of Supabase, since there's no server there to reach at all.

## Deploy targets (three, on purpose)

| Target | What it serves | Config |
|---|---|---|
| **Vercel** (`https://rpa-v2.vercel.app`, live) | Static `web/dist` only — no server, no saving, "Not saving right now" always shown | `vercel.json` |
| **Render** | Full app (server + built web + real-browser runner). Free plan works once Supabase is configured (no disk needed); without Supabase it needs local disk + a paid plan | `render.yaml`, `Dockerfile` (built on Playwright's own base image) |
| **Netlify** | Same static-only option as Vercel | `netlify.toml` |

Vercel is what's actually deployed today; pushing to `master` auto-redeploys it (`vercel ls` / `vercel inspect --wait` to check build status — the CLI is already authenticated as `vishnurmohan99-9349`). Render/Netlify configs exist but aren't connected to an account yet.

## `Design/` folder — do not commit without asking

`Design/` holds the source `.dc.html` prototype files (`Atlas Workflow.dc.html` is the one the current UI was redesigned to match) plus PracticeSuite reference screenshots and the organiser's PDF dossier. **It is deliberately untracked** (not in `.gitignore` — just never `git add`ed) because the repo is public and one screenshot shows a real patient name + DOB. Ask the user explicitly before committing anything from this folder; if only the `.dc.html`/`support.js` design sources are wanted (no screenshots/PDF), that's fine to commit on request.

## Scope decisions that override the original brief

These came from explicit user instructions across the build, not from the brief itself — see the `atlas-scope-decisions` memory file for the full record:

1. **Local server for saving** (brief said no backend) — `server/` exists because the user asked for persistence.
2. **Click-recording** — `web/src/domain/recorder.ts` turns a click on `[data-label]` into a step; this is a first-class creation method alongside chat and the manual picker.
3. **File download/keep/upload** — the `Files` page, `server/src/files.ts`, and `saveTo`/`upload` steps are all additions beyond the brief.
4. **Playwright / real-browser runner** — built; see "Real-browser runner" above. `server/src/runner/` is a second, independent engine against the same step/binder contract as the in-app one.
5. **Full "Atlas Workflow" design adoption** — the UI was rebuilt to match `Design/Atlas Workflow.dc.html`: draggable node-graph flow (not the brief's flatter step-card list), "Workflow" wording throughout (not "Automation" — despite the `Automation` TS type name), Steps/Run logs tabs, branch splits. This intentionally overrides the brief's "no node graph" instruction.
6. **New Workflow modal is minimal** — just name + starting URL. Signing in and choosing a file destination are both ordinary steps in the flow (a `signin` step and a `saveTo`/`upload` step), not fields in the creation dialog. This was a deliberate simplification requested mid-session — don't re-add a credential/destination picker to `NewWorkflow.tsx` without checking first.

## Testing

`web/src/domain/*.test.ts` cover the binder's kind-scoping/synonym cases, the house-rules arithmetic ($2,516.15), the flow graph operations, the keyword parser, and the recorder. `server/src/store.test.ts` covers the JSON store and sign-in validation. Run both before any commit that touches domain logic (`npm test` from repo root). There is no e2e/browser test suite and no automated tests for `server/src/runner/` (it was verified manually against a real site through the actual UI — see "Real-browser runner" above); a `resolve.ts`/`session.ts` unit test would need a way to fake or stand up a real page, which nothing in the repo currently provides.

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

`signin` steps (added this session) resolve to a saved `SignIn`'s **name only** — the runner never touches a password; the sign-in screen shows "Filled from the environment file" as a placeholder.

## Server (`server/src/`)

- `store.ts` — tiny JSON-file store (`JsonStore`, atomic write-then-rename) + `validateSignIns()` which **rejects any object with fields beyond `{id,label,user}`** — this is the enforcement point for "no passwords, ever."
- `files.ts` / `destinations.ts` — kept downloads live under `ATLAS_DATA_ROOT/files/<automationId>/<runId>/`; `saveTo`/`upload` steps copy to a named `Destination` (`billing-share`, `posting`, `vendor-portal`) after approval, never before.
- `app.ts` — all routes return calm JSON error messages (`{ message: '...' }`), never a raw error/stack trace, matching the "never show Diane a stack trace" rule.
- The web client (`web/src/state/persistence.ts`) debounce-saves to the server and falls back to **offline mode** ("Not saving right now" chip) if the server is unreachable — the whole demo must still run from seed data with the server off. Don't add a hard dependency on the server being up.

## Deploy targets (three, on purpose)

| Target | What it serves | Config |
|---|---|---|
| **Vercel** (`https://rpa-v2.vercel.app`, live) | Static `web/dist` only — no server, no saving, "Not saving right now" always shown | `vercel.json` |
| **Render** | Full app (server + built web, persistent disk at `/data`) | `render.yaml`, `Dockerfile` |
| **Netlify** | Same static-only option as Vercel | `netlify.toml` |

Vercel is what's actually deployed today; pushing to `master` auto-redeploys it (`vercel ls` / `vercel inspect --wait` to check build status — the CLI is already authenticated as `vishnurmohan99-9349`). Render/Netlify configs exist but aren't connected to an account yet.

## `Design/` folder — do not commit without asking

`Design/` holds the source `.dc.html` prototype files (`Atlas Workflow.dc.html` is the one the current UI was redesigned to match) plus PracticeSuite reference screenshots and the organiser's PDF dossier. **It is deliberately untracked** (not in `.gitignore` — just never `git add`ed) because the repo is public and one screenshot shows a real patient name + DOB. Ask the user explicitly before committing anything from this folder; if only the `.dc.html`/`support.js` design sources are wanted (no screenshots/PDF), that's fine to commit on request.

## Scope decisions that override the original brief

These came from explicit user instructions across the build, not from the brief itself — see the `atlas-scope-decisions` memory file for the full record:

1. **Local server for saving** (brief said no backend) — `server/` exists because the user asked for persistence.
2. **Click-recording** — `web/src/domain/recorder.ts` turns a click on `[data-label]` into a step; this is a first-class creation method alongside chat and the manual picker.
3. **File download/keep/upload** — the `Files` page, `server/src/files.ts`, and `saveTo`/`upload` steps are all additions beyond the brief.
4. **Playwright / real-browser runner** — planned but **not built**. The `Runner` interface in `useRunner.ts` is written so a Playwright-backed implementation could swap in later against the same step/binder contract; there's no code for it yet.
5. **Full "Atlas Workflow" design adoption** — the UI was rebuilt to match `Design/Atlas Workflow.dc.html`: draggable node-graph flow (not the brief's flatter step-card list), "Workflow" wording throughout (not "Automation" — despite the `Automation` TS type name), Steps/Run logs tabs, branch splits. This intentionally overrides the brief's "no node graph" instruction.
6. **New Workflow modal is minimal** — just name + starting URL. Signing in and choosing a file destination are both ordinary steps in the flow (a `signin` step and a `saveTo`/`upload` step), not fields in the creation dialog. This was a deliberate simplification requested mid-session — don't re-add a credential/destination picker to `NewWorkflow.tsx` without checking first.

## Testing

`web/src/domain/*.test.ts` cover the binder's kind-scoping/synonym cases, the house-rules arithmetic ($2,516.15), the flow graph operations, the keyword parser, and the recorder. `server/src/store.test.ts` covers the JSON store and sign-in validation. Run both before any commit that touches domain logic (`npm test` from repo root). There is no e2e/browser test suite — verification has been manual, via the Browser pane, each session.

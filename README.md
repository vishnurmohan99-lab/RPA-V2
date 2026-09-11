# Atlas Automation

A workshop where a practice builds, tries and watches its own PracticeSuite automations in plain English. Steps point at things by name, not by selector. When the screen changes, the automation stops and asks.

Synthetic data only. No live credentials in this repo.

## Run locally

```bash
npm install
npx playwright install chromium   # one-time: needed for "Run in: Real browser"
npm run dev        # web on http://localhost:5173, server on :3001
npm test           # web + server unit tests
```

## Real-browser workflows

Every workflow can run two ways, chosen from the builder's "Run in" dropdown:

- **This screen** — the synthetic PracticeSuite tenant, entirely client-side. This is the demo path: fast, offline, no setup.
- **Real browser** — a real Playwright/Chromium session on the server, driving whatever the workflow's Starting URL points to. The live screenshot streams to the browser pane over a WebSocket, and the same resolve-by-meaning binder (kind-scoped, synonym-aware, 75% threshold) reads the real page's DOM instead of the synthetic tenant's `data-label`s — so a real site's unexpected wording stops the run and asks, exactly like the demo does. See `server/src/runner/` (`session.ts` is the engine; `resolve.ts` is the real-page binder).

A sign-in step needs the matching password in the server's own environment — see `.env.example` for the `ATLAS_CRED_*` naming. Nothing else about a real run needs configuring: the workflow's steps, house rules and destinations are the same ones used on the synthetic screen.

## Storage: Supabase or local files

Saved workflows, house rules, sign-ins and run history — plus kept files (the CSVs a run catches) — live in **Supabase** (Postgres + Storage) when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, or in local JSON files and disk under `ATLAS_DATA_ROOT` (default `./server`) otherwise. See `.env.example`. The server logs which one it picked on startup. Use the `service_role` secret key, never the anon/publishable one — it's what lets the trusted server bypass Row Level Security (there's no browser-side Supabase client; nothing else can reach these tables or that storage bucket).

## Production build

```bash
npm run build
npm start          # one process serves the app and the API on $PORT (default 3001)
```

## Deploy

**Full app (saving, run history, files, real-browser runs):** a Docker host. The image is built on Playwright's own base image so Chromium and its OS dependencies are already there.

```bash
docker build -t atlas-automation .
docker run -p 3001:3001 --env-file .env atlas-automation
```

On Render, `render.yaml` creates the service (free plan — no persistent disk needed once Supabase is configured, since that's where everything actually lives; set `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` in the Render dashboard when prompted). Chromium is memory-hungry, so "Run in: Real browser" may need a paid instance to run reliably.

**Static demo only:** `netlify.toml` publishes `web/dist`. The app runs from built-in data and shows "Not saving right now" regardless of Supabase — a static site has no server to talk to it from. "Run in: Real browser" needs the server too, so it isn't available here either — only "This screen".

# Atlas Automation

A workshop where a practice builds, tries and watches its own PracticeSuite automations in plain English. Steps point at things by name, not by selector. When the screen changes, the automation stops and asks.

Synthetic data only. No live credentials in this repo.

## Run locally

```bash
npm install
npm run dev        # web on http://localhost:5173, server on :3001
npm test           # web + server unit tests
```

## Production build

```bash
npm run build
npm start          # one process serves the app and the API on $PORT (default 3001)
```

Saved automations, run history and kept files go under `ATLAS_DATA_ROOT` (default `./server`). See `.env.example`.

## Deploy

**Full app (saving, run history, files):** a Docker host with a persistent disk.

```bash
docker build -t atlas-automation .
docker run -p 3001:3001 -v atlas-data:/data atlas-automation
```

On Render, `render.yaml` creates the service and a disk mounted at `/data`.

**Static demo only:** `netlify.toml` publishes `web/dist`. The app runs from built-in data and shows "Not saving right now".

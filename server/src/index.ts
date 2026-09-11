import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, defaultDirs } from './app.js';

const SERVER_ROOT = fileURLToPath(new URL('..', import.meta.url));
// Real-browser sign-in passwords (ATLAS_CRED_*) and local overrides live here, never in git.
try {
  process.loadEnvFile(path.join(SERVER_ROOT, '..', '.env'));
} catch {
  /* no .env file — everything still has sensible defaults */
}

const PORT = Number(process.env.PORT ?? 3001);
// Saved automations, run history and kept files. Point this at a persistent disk when hosted.
const DATA_ROOT = path.resolve(process.env.ATLAS_DATA_ROOT ?? SERVER_ROOT);
const WEB_DIST = path.resolve(process.env.WEB_DIST ?? path.join(SERVER_ROOT, '..', 'web', 'dist'));

const { app, handleUpgrade } = createApp(defaultDirs(DATA_ROOT));

// When the web app has been built, this one process serves both the app and the API.
if (fs.existsSync(path.join(WEB_DIST, 'index.html'))) {
  app.use(express.static(WEB_DIST, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
}

const server = app.listen(PORT, () => {
  console.log(`Atlas server listening on http://localhost:${PORT} (data: ${DATA_ROOT})`);
});

// The real-browser runner's live screenshot feed rides a WebSocket upgrade on the same server.
handleUpgrade(server);

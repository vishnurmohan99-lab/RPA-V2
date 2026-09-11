import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, defaultDirs } from './app.js';

const PORT = Number(process.env.PORT ?? 3001);
const SERVER_ROOT = fileURLToPath(new URL('..', import.meta.url));
// Saved automations, run history and kept files. Point this at a persistent disk when hosted.
const DATA_ROOT = path.resolve(process.env.ATLAS_DATA_ROOT ?? SERVER_ROOT);
const WEB_DIST = path.resolve(process.env.WEB_DIST ?? path.join(SERVER_ROOT, '..', 'web', 'dist'));

const { app } = createApp(defaultDirs(DATA_ROOT));

// When the web app has been built, this one process serves both the app and the API.
if (fs.existsSync(path.join(WEB_DIST, 'index.html'))) {
  app.use(express.static(WEB_DIST, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(WEB_DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Atlas server listening on http://localhost:${PORT} (data: ${DATA_ROOT})`);
});

import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import { createFileStore, createStore } from './db/index.js';
import { DESTINATIONS, destinationByLabelOrId } from './destinations.js';
import { mountRunner } from './runner/mount.js';
import { isSafeId, validateSignIns } from './store.js';

export interface Dirs {
  data: string;
  files: string;
  destinations: string;
}

const MAX_HISTORY = 500;

/** Express 4 doesn't route a rejected promise to error middleware on its own. */
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export function createApp(dirs: Dirs) {
  const store = createStore(dirs.data);
  const files = createFileStore(dirs.files, dirs.destinations);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get(
    '/api/state',
    wrap(async (_req, res) => {
      const [automations, rules, signIns, history] = await Promise.all([
        store.read('automations'),
        store.read('rules'),
        store.read('signins'),
        store.read('history'),
      ]);
      res.json({ automations, rules, signIns, history });
    }),
  );

  app.put(
    '/api/automations',
    wrap(async (req, res) => {
      if (!Array.isArray(req.body)) return res.status(400).json({ message: 'I could not save those automations.' });
      await store.write('automations', req.body);
      res.json({ ok: true });
    }),
  );

  app.put(
    '/api/rules',
    wrap(async (req, res) => {
      const ok = Array.isArray(req.body) && req.body.every((r: unknown) => typeof (r as { id?: unknown })?.id === 'string' && typeof (r as { on?: unknown })?.on === 'boolean');
      if (!ok) return res.status(400).json({ message: 'I could not save the house rules.' });
      await store.write(
        'rules',
        req.body.map((r: { id: string; text?: string; on: boolean }) => ({ id: r.id, text: String(r.text ?? ''), on: r.on })),
      );
      res.json({ ok: true });
    }),
  );

  app.put(
    '/api/signins',
    wrap(async (req, res) => {
      if (!validateSignIns(req.body)) {
        return res.status(400).json({ message: 'A sign-in can only have a name and a username, so I did not save it.' });
      }
      await store.write('signins', req.body);
      res.json({ ok: true });
    }),
  );

  app.put(
    '/api/history',
    wrap(async (req, res) => {
      if (!Array.isArray(req.body)) return res.status(400).json({ message: 'I could not save the run history.' });
      await store.write('history', req.body.slice(0, MAX_HISTORY));
      res.json({ ok: true });
    }),
  );

  app.post(
    '/api/history',
    wrap(async (req, res) => {
      const run = req.body;
      if (!run || typeof run.id !== 'string') return res.status(400).json({ message: 'I could not save that run.' });
      await store.addRun(run);
      res.json({ ok: true });
    }),
  );

  app.get('/api/destinations', (_req, res) => res.json(DESTINATIONS));

  app.get(
    '/api/files',
    wrap(async (_req, res) => res.json(await files.list())),
  );

  app.post(
    '/api/files',
    upload.single('file'),
    wrap(async (req, res) => {
      if (!req.file) return res.status(400).json({ message: 'There was no file to keep.' });
      const kept = await files.add(req.file.buffer, req.body.name || req.file.originalname, req.body.automationId, req.body.runId);
      res.json(kept);
    }),
  );

  app.get(
    '/api/files/:id',
    wrap(async (req, res) => {
      const file = isSafeId(String(req.params.id)) ? await files.get(String(req.params.id)) : null;
      if (!file) return res.status(404).json({ message: 'That file is not here any more.' });
      const buf = await files.download(file);
      res.setHeader('Content-Disposition', `attachment; filename="${file.name.replace(/"/g, '')}"`);
      res.type('text/csv').send(buf);
    }),
  );

  app.post(
    '/api/files/:id/send',
    wrap(async (req, res) => {
      const dest = destinationByLabelOrId(String(req.body?.destination ?? ''));
      if (!dest) return res.status(400).json({ message: 'I do not know that destination.' });
      const file = isSafeId(String(req.params.id)) ? await files.send(String(req.params.id), dest) : null;
      if (!file) return res.status(404).json({ message: 'That file is not here any more.' });
      res.json(file);
    }),
  );

  app.delete(
    '/api/files/:id',
    wrap(async (req, res) => {
      const ok = isSafeId(String(req.params.id)) && (await files.remove(String(req.params.id)));
      if (!ok) return res.status(404).json({ message: 'That file is not here any more.' });
      res.json({ ok: true });
    }),
  );

  // The real-browser runner: POST /api/runs to start one, /live?runId=... (WebSocket) to watch it.
  const handleUpgrade = mountRunner(app, store, files);

  // Calm errors only: never a stack trace to the client.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong on the runner. Nothing was changed.' });
  });

  return { app, store, files, handleUpgrade };
}

export const defaultDirs = (root: string): Dirs => ({
  data: path.join(root, 'data'),
  files: path.join(root, 'files'),
  destinations: path.join(root, 'destinations'),
});

import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import { DESTINATIONS, destinationByLabelOrId } from './destinations.js';
import { FileStore } from './files.js';
import { isSafeId, JsonStore, validateSignIns } from './store.js';

export interface Dirs {
  data: string;
  files: string;
  destinations: string;
}

const MAX_HISTORY = 500;

export function createApp(dirs: Dirs) {
  const store = new JsonStore(dirs.data);
  const files = new FileStore(dirs.files, dirs.destinations);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/state', (_req, res) => {
    res.json({
      automations: store.read('automations'),
      rules: store.read('rules'),
      signIns: store.read('signins'),
      history: store.read('history'),
    });
  });

  app.put('/api/automations', (req, res) => {
    if (!Array.isArray(req.body)) return res.status(400).json({ message: 'I could not save those automations.' });
    store.write('automations', req.body);
    res.json({ ok: true });
  });

  app.put('/api/rules', (req, res) => {
    const ok = Array.isArray(req.body) && req.body.every((r: any) => typeof r?.id === 'string' && typeof r?.on === 'boolean');
    if (!ok) return res.status(400).json({ message: 'I could not save the house rules.' });
    store.write('rules', req.body.map((r: any) => ({ id: r.id, text: String(r.text ?? ''), on: r.on })));
    res.json({ ok: true });
  });

  app.put('/api/signins', (req, res) => {
    if (!validateSignIns(req.body)) {
      return res.status(400).json({ message: 'A sign-in can only have a name and a username, so I did not save it.' });
    }
    store.write('signins', req.body);
    res.json({ ok: true });
  });

  app.put('/api/history', (req, res) => {
    if (!Array.isArray(req.body)) return res.status(400).json({ message: 'I could not save the run history.' });
    store.write('history', req.body.slice(0, MAX_HISTORY));
    res.json({ ok: true });
  });

  app.post('/api/history', (req, res) => {
    const run = req.body;
    if (!run || typeof run.id !== 'string') return res.status(400).json({ message: 'I could not save that run.' });
    const history = store.read<any[]>('history') ?? [];
    if (!history.some((h) => h.id === run.id)) store.write('history', [run, ...history].slice(0, MAX_HISTORY));
    res.json({ ok: true });
  });

  app.get('/api/destinations', (_req, res) => res.json(DESTINATIONS));

  app.get('/api/files', (_req, res) => res.json(files.list()));

  app.post('/api/files', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'There was no file to keep.' });
    const kept = files.add(req.file.buffer, req.body.name || req.file.originalname, req.body.automationId, req.body.runId);
    res.json(kept);
  });

  app.get('/api/files/:id', (req, res) => {
    const file = isSafeId(req.params.id) ? files.get(req.params.id) : null;
    if (!file) return res.status(404).json({ message: 'That file is not here any more.' });
    res.download(files.pathOf(file), file.name);
  });

  app.post('/api/files/:id/send', (req, res) => {
    const dest = destinationByLabelOrId(String(req.body?.destination ?? ''));
    if (!dest) return res.status(400).json({ message: 'I do not know that destination.' });
    const file = isSafeId(req.params.id) ? files.send(req.params.id, dest) : null;
    if (!file) return res.status(404).json({ message: 'That file is not here any more.' });
    res.json(file);
  });

  app.delete('/api/files/:id', (req, res) => {
    const ok = isSafeId(req.params.id) && files.remove(req.params.id);
    if (!ok) return res.status(404).json({ message: 'That file is not here any more.' });
    res.json({ ok: true });
  });

  // Calm errors only: never a stack trace to the client.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ message: 'Something went wrong on the runner. Nothing was changed.' });
  });

  return { app, store, files };
}

export const defaultDirs = (root: string): Dirs => ({
  data: path.join(root, 'data'),
  files: path.join(root, 'files'),
  destinations: path.join(root, 'destinations'),
});

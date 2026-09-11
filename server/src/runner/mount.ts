import crypto from 'node:crypto';
import type { Express } from 'express';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { AppFileStore, Store } from '../db/index.js';
import type { Destination } from '../destinations.js';
import { destinationByLabelOrId } from '../destinations.js';
import { isSafeId } from '../store.js';
import { RunSession, type RunnerAutomation, type RunnerRuleState, type RunnerSignIn, type RunMode } from './session.js';

interface Live {
  session: RunSession;
  events: unknown[]; // buffered until a socket attaches; screenshots are pruned, everything else kept
  sockets: Set<WebSocket>;
}

/** Wires the real-browser runner's HTTP routes onto `app` and returns an upgrade handler for `/live`. */
export function mountRunner(app: Express, store: Store, files: AppFileStore) {
  const runs = new Map<string, Live>();

  const broadcast = (id: string, data: unknown) => {
    const live = runs.get(id);
    if (!live) return;
    const isScreenshot = (data as { type?: string }).type === 'screenshot';
    if (isScreenshot) live.events = live.events.filter((e) => (e as { type?: string }).type !== 'screenshot');
    live.events.push(data);
    if (live.events.length > 500) live.events.splice(0, live.events.length - 500);
    const msg = JSON.stringify(data);
    for (const ws of live.sockets) if (ws.readyState === ws.OPEN) ws.send(msg);
  };

  app.post('/api/runs', (req, res) => {
    (async () => {
      const { automationId, mode } = req.body ?? {};
      if (typeof automationId !== 'string' || (mode !== 'dry' && mode !== 'run')) {
        return res.status(400).json({ message: 'I need a workflow and a mode to run it in.' });
      }
      const automations = (await store.read<RunnerAutomation[]>('automations')) ?? [];
      const automation = automations.find((a) => a.id === automationId);
      if (!automation) return res.status(404).json({ message: 'That workflow is not here any more.' });
      const rules = (await store.read<RunnerRuleState[]>('rules')) ?? [];
      const signIns = (await store.read<RunnerSignIn[]>('signins')) ?? [];

      const id = `live-${crypto.randomUUID().slice(0, 8)}`;
      const session = new RunSession(
        id,
        automation,
        mode as RunMode,
        signIns,
        rules,
        (stepId, label) => {
          // Fires mid-run; persisting doesn't need to block the run itself.
          store.rebindStep(automationId, stepId, label).catch((e) => console.error('[atlas] rebindStep failed:', e));
        },
        async (buffer, name) => {
          try {
            return await files.add(buffer, name, automationId, id);
          } catch {
            return null;
          }
        },
        async (fileId, destination) => {
          const dest: Destination | null = destinationByLabelOrId(destination);
          if (dest) await files.send(fileId, dest);
        },
      );

      const live: Live = { session, events: [], sockets: new Set() };
      runs.set(id, live);
      session.on('event', (e) => broadcast(id, e));
      session.start().finally(() => {
        // Keep the finished session around briefly so a slow-to-connect socket still gets the tail end.
        setTimeout(() => runs.delete(id), 60_000);
      });

      res.json({ runId: id });
    })().catch((e) => {
      console.error('[atlas] /api/runs failed:', e);
      if (!res.headersSent) res.status(500).json({ message: 'Something went wrong starting the run. Nothing was changed.' });
    });
  });

  const find = (req: { params: { runId: string } }, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
    const live = isSafeId(req.params.runId) ? runs.get(req.params.runId) : undefined;
    if (!live) {
      res.status(404).json({ message: 'That run is not here any more.' });
      return null;
    }
    return live;
  };

  app.post('/api/runs/:runId/answer', (req, res) => {
    const live = find(req, res);
    if (!live) return;
    if (typeof req.body?.label !== 'string') return res.status(400).json({ message: 'No label given.' });
    live.session.answer(req.body.label);
    res.json({ ok: true });
  });

  app.post('/api/runs/:runId/not-now', (req, res) => {
    const live = find(req, res);
    if (!live) return;
    live.session.notNow();
    res.json({ ok: true });
  });

  app.post('/api/runs/:runId/approve', (req, res) => {
    const live = find(req, res);
    if (!live) return;
    live.session.approve();
    res.json({ ok: true });
  });

  app.post('/api/runs/:runId/decline', (req, res) => {
    const live = find(req, res);
    if (!live) return;
    live.session.decline();
    res.json({ ok: true });
  });

  app.post('/api/runs/:runId/stop', (req, res) => {
    const live = find(req, res);
    if (!live) return;
    live.session.stop();
    res.json({ ok: true });
  });

  app.post('/api/runs/:runId/pick', async (req, res) => {
    const live = find(req, res);
    if (!live) return;
    const { x, y } = req.body ?? {};
    if (typeof x !== 'number' || typeof y !== 'number') return res.status(400).json({ message: 'No point given.' });
    const hit = await live.session.pick(x, y);
    res.json(hit);
  });

  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', (ws, req) => {
    const runId = new URL(req.url ?? '', 'http://x').searchParams.get('runId') ?? '';
    const live = runs.get(runId);
    if (!live) {
      ws.close(4404, 'unknown run');
      return;
    }
    live.sockets.add(ws);
    // Replay everything buffered so far (a late-connecting client still sees the run from the top).
    for (const e of live.events) ws.send(JSON.stringify(e));
    ws.on('close', () => live.sockets.delete(ws));
  });

  return function handleUpgrade(server: Server) {
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      if (!req.url?.startsWith('/live')) return;
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    });
  };
}

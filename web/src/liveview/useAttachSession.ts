import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { Kind, LogTone } from '../domain/types';
import type { LiveHighlight, LiveLog } from '../pages/builder/useLiveRunner';

export type AttachKind = 'browse' | 'run';

/**
 * Connects to an *already-running* browse/run session by id, in a second WebSocket — the server
 * broadcasts every event (screenshot, highlight, log, ...) to every connected socket, so this
 * window sees exactly what the builder tab's own connection sees, without starting a second
 * session. Click and scroll go straight to the same REST endpoints the builder tab itself uses.
 * Shaped to match `useBrowseSession`/`useLiveRunner`'s own return values so the popup can render
 * with the exact same `BrowsePane`/`LiveBrowserPane` components the builder tab uses, unchanged.
 */
export function useAttachSession(kind: AttachKind, id: string) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<LiveHighlight | null>(null);
  const [logs, setLogs] = useState<LiveLog[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(api.liveSocketUrl(id));
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onmessage = (ev) => {
      const e = JSON.parse(ev.data);
      if (e.type === 'screenshot') setScreenshot(e.dataUrl);
      else if (e.type === 'highlight') setHighlight({ box: e.box, label: e.label, s: e.s, tone: e.tone });
      else if (e.type === 'active') setHighlight(null);
      else if (e.type === 'log') setLogs((l) => [...l, { text: e.text, tone: e.tone as LogTone }]);
    };
    ws.onerror = () => setConnected(false);
    ws.onclose = () => setConnected(false);
    return () => ws.close();
  }, [id]);

  const click = async (xPct: number, yPct: number): Promise<{ label: string; kind: Kind } | null> => {
    const x = Math.round(xPct * 1280);
    const y = Math.round(yPct * 800);
    const hit = kind === 'browse' ? await api.browseClick(id, x, y) : await api.livePick(id, x, y);
    return hit as { label: string; kind: Kind } | null;
  };

  const scroll = (deltaY: number) => {
    if (kind === 'browse') api.browseScroll(id, deltaY).catch(() => {});
    else api.liveScroll(id, deltaY).catch(() => {});
  };

  // Fills whatever field was last clicked, for real, on the real page — so what Diane sees is
  // what gets saved. Only meaningful while authoring (kind 'browse'); a run's steps already have
  // their values, so there's nothing to type during one.
  const type = async (value: string) => {
    if (kind === 'browse') await api.browseType(id, value).catch(() => {});
  };

  return { screenshot, highlight, logs, connected, click, scroll, type };
}

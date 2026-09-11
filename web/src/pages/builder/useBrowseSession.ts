import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import type { Kind } from '../../domain/types';

/**
 * A steps-free live Playwright session used only while authoring: it opens the workflow's real
 * Starting URL and streams screenshots, so the builder can show the real page from the start
 * instead of the synthetic mockup. `click` both identifies what's under a point and actually
 * clicks it — so a real nav link or button moves the session on, letting Diane record steps
 * across more than one real page. Started automatically whenever `url` is set and stopped on
 * unmount or when `url` changes.
 */
export function useBrowseSession(url: string | null) {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setConnecting(true);
    setError(null);
    setScreenshot(null);
    (async () => {
      try {
        const { browseId } = await api.startBrowse(url);
        if (cancelled) return;
        idRef.current = browseId;
        const ws = new WebSocket(api.liveSocketUrl(browseId));
        wsRef.current = ws;
        ws.onmessage = (ev) => {
          const e = JSON.parse(ev.data);
          if (e.type === 'screenshot') {
            setScreenshot(e.dataUrl);
            setConnecting(false);
          } else if (e.type === 'error') {
            setError(e.message);
            setConnecting(false);
          }
        };
        ws.onerror = () => setError('Lost the connection to the real browser.');
      } catch {
        if (!cancelled) {
          setError('Could not open a live browser. Is the runner reachable?');
          setConnecting(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
      if (idRef.current) api.stopBrowse(idRef.current).catch(() => {});
      idRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const click = async (xPct: number, yPct: number): Promise<{ label: string; kind: Kind } | null> => {
    if (!idRef.current) return null;
    const hit = await api.browseClick(idRef.current, Math.round(xPct * 1280), Math.round(yPct * 800));
    return hit as { label: string; kind: Kind } | null;
  };

  const scroll = (deltaY: number) => {
    if (idRef.current) api.browseScroll(idRef.current, deltaY).catch(() => {});
  };

  return { screenshot, connecting, error, click, scroll };
}

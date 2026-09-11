import { useEffect, useRef } from 'react';
import { BrowsePane } from '../pages/builder/BrowsePane';
import { LiveBrowserPane } from '../pages/builder/LiveBrowserPane';
import { liveChannelName } from './channel';
import { type AttachKind, useAttachSession } from './useAttachSession';

/**
 * The whole content of a live-view popup tab (see main.tsx's ?live=browse|run&id=&url= routing).
 * A full-viewport mirror of the same screenshot stream the opener builder tab is already
 * watching, using the exact same `BrowsePane`/`LiveBrowserPane` components the builder tab
 * renders inline — only the data source differs (`useAttachSession` joins the existing session
 * instead of starting a new one). Every click here is resolved against the real page and posted
 * back to the opener over a BroadcastChannel keyed by the session id, so it becomes a step (or
 * answers a stop-and-ask "point at it") exactly as if the click had happened in the builder's
 * own pane.
 */
export function LiveViewWindow({ kind, id, url }: { kind: AttachKind; id: string; url: string }) {
  const { screenshot, highlight, logs, connected, click, scroll } = useAttachSession(kind, id);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    document.title = 'Atlas — Live view';
    channelRef.current = new BroadcastChannel(liveChannelName(id));
    return () => channelRef.current?.close();
  }, [id]);

  const onClick = async (xPct: number, yPct: number) => {
    const hit = await click(xPct, yPct);
    if (hit) channelRef.current?.postMessage({ type: 'hit', label: hit.label, kind: hit.kind });
  };

  return (
    <div className="h-screen min-h-0 bg-[#F2F4F7] p-3">
      {kind === 'browse' ? (
        <BrowsePane screenshot={screenshot} connecting={!connected} error={null} url={url} recording onClick={onClick} onScroll={scroll} />
      ) : (
        <LiveBrowserPane screenshot={screenshot} highlight={highlight} logs={logs} picking onPick={onClick} onScroll={scroll} startUrl={url} />
      )}
    </div>
  );
}

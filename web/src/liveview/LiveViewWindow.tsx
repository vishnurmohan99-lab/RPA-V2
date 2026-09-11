import { useEffect, useRef, useState } from 'react';
import { BrowsePane } from '../pages/builder/BrowsePane';
import { LiveBrowserPane } from '../pages/builder/LiveBrowserPane';
import { liveChannelName } from './channel';
import { type AttachKind, useAttachSession } from './useAttachSession';

/**
 * The whole content of a live-view popup tab (see main.tsx's #live=browse|run&id=&url= routing).
 * A full-viewport mirror of the same screenshot stream the opener builder tab is already
 * watching, using the exact same `BrowsePane`/`LiveBrowserPane` components the builder tab
 * renders inline — only the data source differs (`useAttachSession` joins the existing session
 * instead of starting a new one). Every click here is resolved against the real page and posted
 * back to the opener over a BroadcastChannel keyed by the session id, so it becomes a step (or
 * answers a stop-and-ask "point at it") exactly as if the click had happened in the builder's
 * own pane — a click on a field pauses to ask what to type right here (and fills it on the real
 * page for real), instead of bouncing the question back to the builder tab.
 */
export function LiveViewWindow({ kind, id, url }: { kind: AttachKind; id: string; url: string }) {
  const { screenshot, highlight, logs, connected, click, scroll, type } = useAttachSession(kind, id);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [pendingField, setPendingField] = useState<{ label: string } | null>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    document.title = 'Atlas — Live view';
    channelRef.current = new BroadcastChannel(liveChannelName(id));
    return () => channelRef.current?.close();
  }, [id]);

  const onClick = async (xPct: number, yPct: number) => {
    const hit = await click(xPct, yPct);
    if (!hit) return;
    if (kind === 'browse' && hit.kind === 'field') {
      setPendingField({ label: hit.label });
      setValue('');
      return;
    }
    channelRef.current?.postMessage({ type: 'hit', label: hit.label, kind: hit.kind });
  };

  const submitField = async () => {
    if (!pendingField) return;
    const v = value.trim();
    if (v) {
      await type(v);
      channelRef.current?.postMessage({ type: 'hit', label: pendingField.label, kind: 'field', value: v });
    }
    setPendingField(null);
  };

  return (
    <div className="relative h-screen min-h-0 bg-[#F2F4F7] p-3">
      {kind === 'browse' ? (
        <BrowsePane screenshot={screenshot} connecting={!connected} error={null} url={url} recording onClick={onClick} onScroll={scroll} />
      ) : (
        <LiveBrowserPane screenshot={screenshot} highlight={highlight} logs={logs} picking onPick={onClick} onScroll={scroll} startUrl={url} />
      )}

      {pendingField && (
        <div className="absolute inset-x-0 top-6 z-10 flex justify-center px-4">
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 shadow-lg">
            <span className="whitespace-nowrap text-[12.5px] text-body">
              Type into <b className="text-ink">{pendingField.label}</b>:
            </span>
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitField();
                if (e.key === 'Escape') setPendingField(null);
              }}
              className="w-48 rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-teal"
            />
            <button onClick={submitField} className="rounded-card bg-teal px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-teal-dark">
              Add
            </button>
            <button onClick={() => setPendingField(null)} className="px-1 text-[12px] font-medium text-muted hover:text-body">
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

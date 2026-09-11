import { useEffect, useRef, useState } from 'react';
import { BrowsePane } from '../pages/builder/BrowsePane';
import { LiveBrowserPane } from '../pages/builder/LiveBrowserPane';
import { liveChannelName } from './channel';
import { type AttachKind, useAttachSession } from './useAttachSession';

/**
 * The whole content of a live-view popup tab (see main.tsx's #live=browse|run&id=&url=... routing).
 * A full-viewport mirror of the same screenshot stream the opener builder tab is already
 * watching, using the exact same `BrowsePane`/`LiveBrowserPane` components the builder tab
 * renders inline — only the data source differs (`useAttachSession` joins the existing session
 * instead of starting a new one). Every click here is resolved against the real page and posted
 * back to the opener over a BroadcastChannel keyed by the session id, so it becomes a step (or
 * answers a stop-and-ask "point at it") exactly as if the click had happened in the builder's
 * own pane — a click on a field (including a dropdown) pauses to ask what to type/choose right
 * here (and does it on the real page for real), instead of bouncing the question back to the
 * builder tab. A click on a password field is the one exception: it's never named as a candidate
 * (so it can never become a step's literal value) and instead offers setting it as this server
 * session's own in-memory credential — see credentials.ts.
 */
export function LiveViewWindow({
  kind,
  id,
  url,
  signInId,
  signInLabel,
}: {
  kind: AttachKind;
  id: string;
  url: string;
  signInId: string | null;
  signInLabel: string | null;
}) {
  const { screenshot, highlight, logs, connected, click, scroll, type, setCredential } = useAttachSession(kind, id);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [pendingField, setPendingField] = useState<{ label: string } | null>(null);
  const [pendingPassword, setPendingPassword] = useState(false);
  const [value, setValue] = useState('');

  useEffect(() => {
    document.title = 'Atlas — Live view';
    channelRef.current = new BroadcastChannel(liveChannelName(id));
    return () => channelRef.current?.close();
  }, [id]);

  const onClick = async (xPct: number, yPct: number) => {
    const hit = await click(xPct, yPct);
    if (!hit) return;
    if (kind === 'browse' && hit.isPassword) {
      setPendingPassword(true);
      setValue('');
      return;
    }
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

  const submitPassword = async () => {
    const v = value;
    if (v && signInId) {
      await setCredential(signInId, v);
      channelRef.current?.postMessage({ type: 'hit', label: 'Sign in', kind: 'button' });
    }
    setPendingPassword(false);
    setValue('');
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

      {pendingPassword && (
        <div className="absolute inset-x-0 top-6 z-10 flex justify-center px-4">
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 shadow-lg">
            {signInId ? (
              <>
                <span className="whitespace-nowrap text-[12.5px] text-body">
                  Password for <b className="text-ink">{signInLabel ?? 'this sign-in'}</b> (this session only):
                </span>
                <input
                  autoFocus
                  type="password"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitPassword();
                    if (e.key === 'Escape') setPendingPassword(false);
                  }}
                  className="w-40 rounded-md border border-line px-2.5 py-1.5 text-[12.5px] outline-none focus:border-teal"
                />
                <button onClick={submitPassword} className="rounded-card bg-teal px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-teal-dark">
                  Set for this session
                </button>
                <button onClick={() => setPendingPassword(false)} className="px-1 text-[12px] font-medium text-muted hover:text-body">
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="whitespace-nowrap text-[12.5px] text-body">Add a sign-in in the builder first to set its password here.</span>
                <button
                  onClick={() => {
                    channelRef.current?.postMessage({ type: 'hit', label: 'Sign in', kind: 'button' });
                    setPendingPassword(false);
                  }}
                  className="rounded-card bg-teal px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-teal-dark"
                >
                  Just add the step
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

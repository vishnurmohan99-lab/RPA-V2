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
 * back to the opener over a BroadcastChannel keyed by the workflow's own id (stable for the
 * popup's whole lifetime, unlike the browse/run session id — see channel.ts), so it becomes a step (or
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
  automationId,
  url,
  signInId,
  signInLabel,
}: {
  kind: AttachKind;
  id: string;
  automationId: string;
  url: string;
  signInId: string | null;
  signInLabel: string | null;
}) {
  const { screenshot, highlight, logs, connected, click, scroll, type, setCredential } = useAttachSession(kind, id);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [pendingField, setPendingField] = useState<{ label: string } | null>(null);
  const [pendingPassword, setPendingPassword] = useState(false);
  const [value, setValue] = useState('');
  // A click round-trips through a real Playwright page on the server -- on a slow host (the free
  // Render tier this was verified against can take several seconds under load) there's otherwise
  // no feedback at all between the click and the overlay appearing, which reads as "nothing
  // happened" even though it's just still working.
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // No fake address-bar UI in the pane itself (see BrowsePane/LiveBrowserPane) -- the tab title
    // is where the target URL shows up instead, the same way any other browser tab would.
    try {
      document.title = `Atlas — ${new URL(url).hostname}`;
    } catch {
      document.title = 'Atlas — Live view';
    }
    channelRef.current = new BroadcastChannel(liveChannelName(automationId));
    return () => channelRef.current?.close();
  }, [automationId, url]);

  // A mouse wheel fires many events per gesture; sending each straight through (as it used to)
  // meant a normal scroll queued up a pile of slow, overlapping requests on the server with no
  // feedback at all while they worked through -- which reads exactly like scrolling doesn't do
  // anything. This coalesces everything that arrives while one scroll is still in flight into a
  // single follow-up call instead of firing one per wheel tick.
  const scrollAccumRef = useRef(0);
  const scrollingRef = useRef(false);
  const onWheelScroll = (deltaY: number) => {
    scrollAccumRef.current += deltaY;
    if (scrollingRef.current) return;
    scrollingRef.current = true;
    (async () => {
      while (scrollAccumRef.current !== 0) {
        const amount = scrollAccumRef.current;
        scrollAccumRef.current = 0;
        await scroll(amount);
      }
      scrollingRef.current = false;
    })();
  };

  const onClick = async (xPct: number, yPct: number) => {
    // Only one click can genuinely be in flight at a time. A *pending overlay*, though, is just
    // an unanswered question, not a lock -- clicking elsewhere clearly means "never mind that
    // one," so it's dismissed rather than silently swallowing the new click (which is what
    // happened before: a forgotten "what should I type" prompt made every click after it look
    // broken until that one was explicitly closed).
    if (busy) return;
    setPendingField(null);
    setPendingPassword(false);
    setBusy(true);
    const hit = await click(xPct, yPct).finally(() => setBusy(false));
    if (!hit) return;
    if (kind === 'browse' && hit.isPassword) {
      setPendingPassword(true);
      setValue('');
      return;
    }
    if (kind === 'browse' && hit.kind === 'field' && hit.isCheckbox) {
      channelRef.current?.postMessage({ type: 'hit', label: hit.label, kind: hit.kind, isCheckbox: true });
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
    <div className="relative h-screen min-h-0 bg-[#0B0D0F]">
      {kind === 'browse' ? (
        <BrowsePane screenshot={screenshot} connecting={!connected} error={null} recording onClick={onClick} onScroll={onWheelScroll} />
      ) : (
        <LiveBrowserPane screenshot={screenshot} highlight={highlight} logs={logs} picking onPick={onClick} onScroll={onWheelScroll} />
      )}

      {busy && (
        <div className="absolute inset-x-0 top-6 z-10 flex justify-center px-4">
          <span className="flex items-center gap-2 rounded-full bg-ink/90 px-4 py-2 text-[12.5px] font-medium text-white">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Reading the real page… (can take a few seconds)
          </span>
        </div>
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

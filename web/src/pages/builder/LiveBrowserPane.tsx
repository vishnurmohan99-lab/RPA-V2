import { Crosshair } from 'lucide-react';
import { useRef } from 'react';
import type { LiveHighlight, LiveLog } from './useLiveRunner';
import { useContainSize } from './useContainSize';

const TONE_BORDER = { teal: 'border-teal', red: 'border-red', amber: 'border-amber' } as const;
const TONE_FILL = {
  teal: 'bg-teal/5 shadow-[0_0_0_4px_rgba(14,124,107,0.12)]',
  red: 'bg-red/5 shadow-[0_0_0_4px_rgba(180,35,24,0.12)]',
  amber: 'bg-amber/5 shadow-[0_0_0_4px_rgba(181,71,8,0.12)]',
} as const;
const TONE_TAG = { teal: 'bg-teal text-white', red: 'bg-red text-white', amber: 'bg-amber text-white' } as const;

const LOG_DOT = { ok: 'bg-[#067647]', warn: 'bg-[#B54708]', err: 'bg-[#B42318]', info: 'bg-body' } as const;

/**
 * The browser pane for a real Playwright session: a live screenshot feed (scaled to a fixed
 * 1280×800 viewport, same as the runner launches) with a box overlay positioned from the
 * server's real element coordinates, plus the running log. Clicking while `picking` sends the
 * normalized click point back to the server so it can tell what real element is there. No
 * address-bar-style chrome of its own on purpose — an earlier version drew a fake, unclickable
 * "URL bar" above the screenshot, which just made a real live page look like a boxed-in iframe
 * embed instead of an actual browser. The popup tab itself is the browser here.
 */
export function LiveBrowserPane({
  screenshot,
  highlight,
  logs,
  picking,
  onPick,
  onScroll,
}: {
  screenshot: string | null;
  highlight: LiveHighlight | null;
  logs: LiveLog[];
  picking: boolean;
  onPick: (xPct: number, yPct: number) => void;
  onScroll: (deltaY: number) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const VIEW_W = 1280;
  const VIEW_H = 800;
  const [containerRef, box] = useContainSize(VIEW_W / VIEW_H);

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!picking || !imgRef.current) return;
    // The wrapper is sized in JS to the largest box of exactly the screenshot's aspect ratio that
    // fits the container (see useContainSize), so its box IS the image's drawn rect — no
    // object-contain letterbox math needed to map a click correctly.
    const r = imgRef.current.getBoundingClientRect();
    onPick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };

  // Scrolling over the live view scrolls the real page (it's only ever a single 1280×800
  // screenshot) instead of the builder page behind it.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    onScroll(e.deltaY);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div ref={containerRef} className="flex min-h-0 flex-[2] items-center justify-center overflow-hidden bg-[#0B0D0F]" onWheel={onWheel}>
        {screenshot ? (
          // Sized in JS (useContainSize) to the exact pixel box that fits the container without
          // distorting the 1280:800 ratio -- CSS aspect-ratio alone stretched the image whenever
          // the container's own shape wasn't exactly 1280:800, since giving the wrapper both an
          // explicit height and a max-width cap breaks the ratio instead of preserving it.
          <div
            className={`relative ${picking ? 'cursor-crosshair' : ''}`}
            style={{ width: box.width, height: box.height }}
            onClick={onClick}
          >
            <img ref={imgRef} src={screenshot} alt="Live view of the real page" className="h-full w-full" />
            {highlight?.box && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${(highlight.box.x / VIEW_W) * 100}%`,
                  top: `${(highlight.box.y / VIEW_H) * 100}%`,
                  width: `${(highlight.box.width / VIEW_W) * 100}%`,
                  height: `${(highlight.box.height / VIEW_H) * 100}%`,
                }}
              >
                <div className={`h-full w-full rounded-md border-2 ${TONE_BORDER[highlight.tone]} ${TONE_FILL[highlight.tone]}`} />
                {highlight.label && (
                  <div className={`absolute -top-6 right-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold ${TONE_TAG[highlight.tone]}`}>
                    {highlight.label} · {Math.round((highlight.s ?? 0) * 100)}% sure
                  </div>
                )}
              </div>
            )}
            {picking && (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2">
                <span className="flex items-center gap-1.5 rounded-full bg-ink/90 px-3 py-1 text-[11.5px] font-medium text-white">
                  <Crosshair size={13} /> Click the right thing on the real page
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[12.5px] text-white/60">Connecting to the real browser…</div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line px-3 py-2">
        {logs.length === 0 && <div className="px-1 py-2 text-[12px] text-muted">The run's log appears here as it happens.</div>}
        {logs.map((l, i) => (
          <div key={i} className="flex items-start gap-2 py-1">
            <span className={`mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full ${LOG_DOT[l.tone]}`} />
            <span className="text-[12px] leading-[1.5] text-body">{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { Crosshair } from 'lucide-react';
import { useRef } from 'react';
import { useContainSize } from './useContainSize';

/**
 * The authoring-time counterpart to `LiveBrowserPane`: a live screenshot feed of the workflow's
 * real Starting URL with no run behind it — just `useBrowseSession`, so Diane can see the real
 * page and, while `recording`, click it to record steps the same way clicking the synthetic
 * mockup does. Same fixed-aspect-ratio wrapper trick as `LiveBrowserPane` so a click's pixel
 * position maps directly onto the screenshot's own coordinates. No address-bar-style chrome of
 * its own on purpose — an earlier version drew a fake, unclickable "URL bar" above the
 * screenshot, which just made a real live page look like a boxed-in iframe embed instead of an
 * actual browser. The popup tab itself (and its real, native address bar) is the browser here.
 */
export function BrowsePane({
  screenshot,
  connecting,
  error,
  recording,
  onClick,
  onScroll,
}: {
  screenshot: string | null;
  connecting: boolean;
  error: string | null;
  recording: boolean;
  onClick: (xPct: number, yPct: number) => void;
  onScroll: (deltaY: number) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const VIEW_W = 1280;
  const VIEW_H = 800;
  const [containerRef, box] = useContainSize(VIEW_W / VIEW_H);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    onClick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };

  // Scrolling over the live view scrolls the real page (it's only ever a single 1280×800
  // screenshot) instead of the builder page behind it.
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    onScroll(e.deltaY);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0B0D0F]">
      <div ref={containerRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden" onWheel={handleWheel}>
        {error ? (
          <div className="max-w-[320px] px-4 text-center text-[12.5px] leading-[1.6] text-white/70">{error}</div>
        ) : screenshot ? (
          // Sized in JS (useContainSize) to the exact pixel box that fits the container without
          // distorting the 1280:800 ratio -- CSS aspect-ratio alone stretched the image (and
          // skewed click-to-coordinate mapping) whenever the container's own shape wasn't exactly
          // 1280:800, since giving the wrapper both an explicit height and a max-width cap breaks
          // the ratio instead of preserving it.
          <div
            className={`relative ${recording ? 'cursor-crosshair' : ''}`}
            style={{ width: box.width, height: box.height }}
            onClick={handleClick}
          >
            <img ref={imgRef} src={screenshot} alt="Live view of the real page" className="h-full w-full" />
            {recording && (
              <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2">
                <span className="flex items-center gap-1.5 rounded-full bg-ink/90 px-3 py-1 text-[11.5px] font-medium text-white">
                  <Crosshair size={13} /> Click something to add it as a step
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[12.5px] text-white/60">{connecting ? 'Opening the real page…' : 'Not connected.'}</div>
        )}
      </div>
    </div>
  );
}

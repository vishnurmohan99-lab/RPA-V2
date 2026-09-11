import { Crosshair, Globe } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef } from 'react';

/**
 * The authoring-time counterpart to `LiveBrowserPane`: a live screenshot feed of the workflow's
 * real Starting URL with no run behind it — just `useBrowseSession`, so Diane can see the real
 * page and, while `recording`, click it to record steps the same way clicking the synthetic
 * mockup does. Same fixed-aspect-ratio wrapper trick as `LiveBrowserPane` so a click's pixel
 * position maps directly onto the screenshot's own coordinates.
 */
export function BrowsePane({
  screenshot,
  connecting,
  error,
  url,
  recording,
  onClick,
  badge,
}: {
  screenshot: string | null;
  connecting: boolean;
  error: string | null;
  url: string;
  recording: boolean;
  onClick: (xPct: number, yPct: number) => void;
  badge?: ReactNode;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const VIEW_W = 1280;
  const VIEW_H = 800;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    onClick((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[10px] border border-line bg-white">
      <div className="flex items-center gap-2.5 border-b border-line bg-[#FCFCFD] px-3.5 py-2.5">
        <Globe size={13} className="text-muted" />
        <div className="min-w-0 flex-1 truncate rounded-md bg-[#F2F4F7] px-2.5 py-[5px] text-[11.5px] text-muted">{url}</div>
        {badge}
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#0B0D0F]">
        {error ? (
          <div className="max-w-[320px] px-4 text-center text-[12.5px] leading-[1.6] text-white/70">{error}</div>
        ) : screenshot ? (
          <div
            className={`relative max-h-full max-w-full ${recording ? 'cursor-crosshair' : ''}`}
            style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, width: '100%', height: '100%' }}
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

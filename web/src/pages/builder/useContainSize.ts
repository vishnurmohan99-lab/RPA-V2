import { useEffect, useRef, useState } from 'react';

/**
 * Measures a container element and returns the largest width/height (in px) of the given aspect
 * ratio that fits inside it without overflowing either axis — the same result `object-fit:
 * contain` gives an <img>, but as concrete pixel dimensions for a wrapper div instead. CSS alone
 * (`aspect-ratio` plus a `max-width` cap) doesn't reliably do this: once max-width clamps the
 * ratio-derived width, browsers don't shrink an explicit height to match, so the box distorts.
 * Measuring and setting exact pixels sidesteps that entirely.
 */
export function useContainSize(ratio: number): [React.RefObject<HTMLDivElement>, { width: number; height: number }] {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      let width = w;
      let height = width / ratio;
      if (height > h) {
        height = h;
        width = height * ratio;
      }
      setBox({ width, height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ratio]);

  return [ref, box];
}

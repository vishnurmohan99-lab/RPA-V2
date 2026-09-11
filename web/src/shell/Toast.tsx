import { Check } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function useToast() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setText(null), 1800);
    return () => clearTimeout(t);
  }, [text]);
  const show = useCallback((t: string) => setText(t), []);
  const node = text ? (
    <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-drag">
      <Check size={15} className="text-[#6CE9A6]" />
      {text}
    </div>
  ) : null;
  return { show, node };
}

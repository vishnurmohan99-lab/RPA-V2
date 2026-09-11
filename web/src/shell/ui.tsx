import { X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { AutomationStatus } from '../domain/types';

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="border-b border-line bg-white px-8 pb-5 pt-7">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-[15px] text-body">{description}</p>
        </div>
        {action}
      </div>
    </header>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'amber'; size?: 'sm' | 'md' };

export function Button({ variant = 'secondary', size = 'md', className = '', ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-card font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal/40';
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2.5 text-sm';
  const variants = {
    primary: 'bg-teal text-white hover:bg-teal-dark',
    secondary: 'border border-line bg-white text-ink hover:bg-canvas',
    ghost: 'text-body hover:bg-canvas',
    amber: 'bg-amber text-white hover:brightness-95',
  }[variant];
  return <button className={`${base} ${sizes} ${variants} ${className}`} {...rest} />;
}

const PILL: Record<AutomationStatus, { text: string; cls: string; dot: string }> = {
  ready: { text: 'Ready', cls: 'bg-mint text-teal', dot: 'bg-teal' },
  attention: { text: 'Needs attention', cls: 'bg-red-bg text-red', dot: 'bg-red' },
  never: { text: 'Never run', cls: 'bg-canvas text-muted border border-line', dot: 'bg-muted' },
};

export function StatusPill({ status }: { status: AutomationStatus }) {
  const p = PILL[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${p.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
      {p.text}
    </span>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-teal' : 'bg-line'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function Kbd({ k, label }: { k: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-body">
      <span className="rounded bg-canvas px-1.5 py-0.5 text-xs text-muted ring-1 ring-line">{k}</span>
      {label}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  hints,
  width = 640,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  hints?: [string, string][];
  width?: number;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full overflow-hidden rounded-modal bg-white shadow-drag"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative px-6 pb-2 pt-6">
          <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-body">{subtitle}</p>}
          <button onClick={onClose} aria-label="Close" className="absolute right-5 top-5 rounded p-1 text-muted hover:bg-canvas">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-6 pt-3">{children}</div>
        {hints && hints.length > 0 && (
          <div className="flex items-center justify-center gap-6 border-t border-line bg-white py-3">
            {hints.map(([k, l]) => (
              <Kbd key={k} k={k} label={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-input border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20';

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-white px-6 py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-modal bg-mint text-teal">{icon}</div>
      <div className="text-base font-semibold text-ink">{title}</div>
      <p className="mx-auto mb-5 mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      {action}
    </div>
  );
}

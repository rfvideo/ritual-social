import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center animate-riseIn">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ash-100 text-ritual-400 shadow-glow-sm">
        {icon ?? <Inbox size={22} />}
      </div>
      <p className="font-display text-base text-mist-light">{title}</p>
      {description && <p className="max-w-xs text-sm text-mist-dim">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center animate-riseIn">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-400">
        <AlertTriangle size={22} />
      </div>
      <p className="font-display text-base text-mist-light">Something went wrong</p>
      <p className="max-w-xs text-sm text-mist-dim">{message ?? 'Failed to load data from Ritual Chain.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="ritual-btn-ghost">
          <RotateCw size={14} /> Retry
        </button>
      )}
    </div>
  );
}

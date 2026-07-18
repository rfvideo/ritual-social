import { ShieldAlert } from 'lucide-react';
import type { ModerationOutput } from '@/types';

const LABELS: Record<string, string> = {
  spam: 'Spam',
  scam: 'Scam',
  phishing: 'Phishing',
  toxic: 'Toxic Content',
  nsfw: 'NSFW Content',
};

export function ModerationWarningDialog({
  result,
  onCancel,
  onPublishAnyway,
}: {
  result: ModerationOutput;
  onCancel: () => void;
  onPublishAnyway: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-sm rounded-3xl border-red-500/30 p-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <ShieldAlert size={20} />
        </div>
        <h3 className="font-display text-lg text-white">AI Ritual flagged a potential violation</h3>
        <p className="mt-1 text-sm text-mist-dim">{result.reason ?? 'This content matches a risky pattern.'}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {result.categories.map((c) => (
            <span key={c} className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
              {LABELS[c] ?? c}
            </span>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <button className="ritual-btn-ghost flex-1" onClick={onCancel}>
            Edit post
          </button>
          <button
            className="flex-1 rounded-full border border-red-500/40 px-5 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10"
            onClick={onPublishAnyway}
          >
            Publish anyway
          </button>
        </div>
      </div>
    </div>
  );
}

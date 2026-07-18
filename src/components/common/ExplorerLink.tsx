import { ExternalLink } from 'lucide-react';
import { explorerTxUrl } from '@/config/chain';

export function ExplorerLink({ txHash, className }: { txHash: string; className?: string }) {
  const url = explorerTxUrl(txHash);
  if (!url) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-mist-dim ${className ?? ''}`} title={txHash}>
        Explorer belum dikonfigurasi
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1 text-xs font-mono text-ritual-400 transition hover:text-ritual-300 hover:underline ${className ?? ''}`}
    >
      Lihat di Ritual Explorer <ExternalLink size={12} />
    </a>
  );
}

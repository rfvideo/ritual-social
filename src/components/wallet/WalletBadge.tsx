import { BadgeCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { truncateAddress } from '@/lib/utils';

export function WalletBadge({ address }: { address: string }) {
  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    toast.success('Copied!');
  }

  return (
    <button
      onClick={handleCopy}
      title={`${address} — tap to copy`}
      className="inline-flex items-center gap-1 rounded-full border border-ritual-800 bg-ritual-900/40 px-2 py-0.5 font-mono text-[11px] text-ritual-300 transition hover:border-ritual-500 hover:bg-ritual-900/70"
    >
      <BadgeCheck size={11} />
      {truncateAddress(address)}
    </button>
  );
}

import { BadgeCheck } from 'lucide-react';
import { truncateAddress } from '@/lib/utils';

export function WalletBadge({ address }: { address: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-ritual-800 bg-ritual-900/40 px-2 py-0.5 font-mono text-[11px] text-ritual-300"
      title={address}
    >
      <BadgeCheck size={11} />
      {truncateAddress(address)}
    </span>
  );
}

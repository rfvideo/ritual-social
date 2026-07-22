import { Award } from 'lucide-react';
import { useReputation } from '@/hooks/useReputation';
import { ExplorerLink } from '@/components/common/ExplorerLink';
import type { UserProfile } from '@/types';

export function ReputationBadge({ profile }: { profile: UserProfile }) {
  const { data: reputation, isLoading } = useReputation(profile.address);

  if (isLoading || !reputation || !reputation.exists) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-ash-200 bg-ash-100/40 px-3 py-1 text-xs text-mist-dim">
        <Award size={12} /> No Ritual Cred yet
      </div>
    );
  }

  const tier =
    reputation.score >= 80 ? 'Elite' : reputation.score >= 60 ? 'Proven' : reputation.score >= 40 ? 'Rising' : 'New';
  const color =
    reputation.score >= 80 ? 'text-ritual-300' : reputation.score >= 60 ? 'text-emerald-400' : reputation.score >= 40 ? 'text-yellow-400' : 'text-mist-dim';

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 rounded-full border border-ash-200 bg-ash-100/40 px-3 py-1 text-xs font-medium ${color}`}>
        <Award size={12} />
        Ritual Cred {reputation.score}/100 · {tier}
      </div>
      {reputation.proofHash && reputation.proofHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
        <ExplorerLink txHash={reputation.proofHash} />
      )}
    </div>
  );
}

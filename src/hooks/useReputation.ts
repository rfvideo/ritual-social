import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { ritualReputationContract } from '@/contracts';
import { chainTimestampToMs } from '@/lib/utils';
import type { ReputationRecord } from '@/types';

export async function fetchReputation(
  publicClient: any,
  address: `0x${string}`,
): Promise<ReputationRecord> {
  const rep = (await publicClient.readContract({
    address: ritualReputationContract.address,
    abi: ritualReputationContract.abi,
    functionName: 'getReputation',
    args: [address],
  })) as unknown as [number, bigint, `0x${string}`, boolean];

  const [score, lastUpdatedAt, proofHash, exists] = rep;
  return {
    address,
    score: Number(score),
    lastUpdatedAt: chainTimestampToMs(lastUpdatedAt),
    proofHash,
    exists,
  };
}

export function useReputation(address?: `0x${string}`) {
  const publicClient = usePublicClient();
  return useQuery({
    queryKey: ['reputation', address],
    queryFn: () => fetchReputation(publicClient!, address!),
    enabled: !!publicClient && !!address && ritualReputationContract.address !== '0x0000000000000000000000000000000000000000',
    staleTime: 30_000,
  });
}

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { ritualSocialContract } from '@/contracts';
import type { PostRecord } from '@/types';

async function fetchIndexedReplyPostIds(address: string): Promise<string[]> {
  try {
    const res = await fetch(`/.netlify/functions/profile-replies?address=${address}`);
    if (!res.ok) return [];
    const { postIds } = (await res.json()) as { postIds: string[] };
    return postIds;
  } catch {
    return [];
  }
}

async function scanRecentReplyPostIds(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  address: string,
): Promise<string[]> {
  const latestBlock = await publicClient.getBlockNumber();
  const lookback = 100_000n;
  const fromBlock = latestBlock > lookback ? latestBlock - lookback : 0n;

  const logs = await publicClient.getContractEvents({
    address: ritualSocialContract.address,
    abi: ritualSocialContract.abi,
    eventName: 'CommentAdded',
    args: { author: address as `0x${string}` },
    fromBlock,
    toBlock: latestBlock,
  });

  return logs.map((log) => (log as any).args.postId.toString());
}

export function useProfileReplies(address: string | undefined, allPosts: PostRecord[]) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['profile-replies', address],
    queryFn: async (): Promise<PostRecord[]> => {
      const [indexed, recent] = await Promise.all([
        fetchIndexedReplyPostIds(address!),
        publicClient ? scanRecentReplyPostIds(publicClient, address!).catch(() => []) : Promise.resolve([]),
      ]);
      const set = new Set([...indexed, ...recent]);
      return allPosts.filter((p) => set.has(p.id));
    },
    enabled: !!address,
    staleTime: 10_000,
  });
}

export function useProfileLikes(address: string | undefined, allPosts: PostRecord[]) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['profile-likes', address, allPosts.map((p) => p.id).join(',')],
    queryFn: async (): Promise<PostRecord[]> => {
      if (!publicClient || !address || allPosts.length === 0) return [];

      const flags = await Promise.all(
        allPosts.map((p) =>
          publicClient
            .readContract({
              address: ritualSocialContract.address,
              abi: ritualSocialContract.abi,
              functionName: 'hasLiked',
              args: [BigInt(p.id), address as `0x${string}`],
            })
            .catch(() => false) as Promise<boolean>,
        ),
      );

      return allPosts.filter((_, i) => flags[i]);
    },
    enabled: !!publicClient && !!address && allPosts.length > 0,
    staleTime: 30_000,
  });
}

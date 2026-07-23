import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { ritualSocialContract } from '@/contracts';
import type { PostRecord } from '@/types';

export function useProfileReplies(address: string | undefined, allPosts: PostRecord[]) {
  return useQuery({
    queryKey: ['profile-replies', address],
    queryFn: async (): Promise<PostRecord[]> => {
      const res = await fetch(`/.netlify/functions/profile-replies?address=${address}`);
      if (!res.ok) throw new Error('Failed to load replies');
      const { postIds } = (await res.json()) as { postIds: string[] };
      const set = new Set(postIds);
      return allPosts.filter((p) => set.has(p.id));
    },
    enabled: !!address,
    staleTime: 30_000,
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

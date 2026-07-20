import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { fetchProfile } from './useProfile';
import type { UserProfile } from '@/types';

export function useFollowList(address: `0x${string}` | undefined, type: 'following' | 'followers', enabled: boolean) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['follow-list', address, type],
    queryFn: async (): Promise<UserProfile[]> => {
      const res = await fetch(`/.netlify/functions/follow-graph?address=${address}&type=${type}`);
      if (!res.ok) throw new Error('Failed to load list');
      const { addresses } = (await res.json()) as { addresses: string[] };
      return Promise.all(addresses.map((a) => fetchProfile(publicClient, a as `0x${string}`)));
    },
    enabled: enabled && !!address && !!publicClient,
    staleTime: 30_000,
  });
                                        }

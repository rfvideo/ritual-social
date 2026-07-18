import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicClient, useWriteContract, useAccount } from 'wagmi';
import { ritualSocialContract } from '@/contracts';
import { resolveIpfsUri } from '@/lib/ipfs';
import type { ProfileMetadata, UserProfile } from '@/types';
import toast from 'react-hot-toast';

const profileMetaCache = new Map<string, ProfileMetadata>();

async function fetchProfileMetadata(uri: string): Promise<ProfileMetadata> {
  if (!uri) {
    return { displayName: '', username: '', bio: '' };
  }
  if (profileMetaCache.has(uri)) return profileMetaCache.get(uri)!;
  try {
    const res = await fetch(resolveIpfsUri(uri));
    if (!res.ok) throw new Error('metadata fetch failed');
    const data = (await res.json()) as ProfileMetadata;
    profileMetaCache.set(uri, data);
    return data;
  } catch {
    return { displayName: '', username: '', bio: '' };
  }
}

/** Shared by feed/profile hooks — reads the on-chain struct then hydrates IPFS metadata. */
export async function fetchProfile(
  publicClient: any,
  address: `0x${string}`,
): Promise<UserProfile> {
  const struct = (await publicClient.readContract({
    address: ritualSocialContract.address,
    abi: ritualSocialContract.abi,
    functionName: 'profiles',
    args: [address],
  })) as any;

  const metadata = await fetchProfileMetadata(struct.metadataURI as string);

  return {
    address,
    displayName: metadata.displayName || `${address.slice(0, 6)}…${address.slice(-4)}`,
    username: metadata.username || address.slice(2, 10).toLowerCase(),
    bio: metadata.bio ?? '',
    website: metadata.website,
    location: metadata.location,
    avatarURI: metadata.avatarURI,
    bannerURI: metadata.bannerURI,
    joinedAt: Number(struct.joinedAt) * 1000,
    followerCount: Number(struct.followerCount),
    followingCount: Number(struct.followingCount),
    postCount: Number(struct.postCount),
  };
}

export function useProfile(address?: `0x${string}`) {
  const publicClient = usePublicClient();
  return useQuery({
    queryKey: ['profile', address],
    queryFn: () => fetchProfile(publicClient!, address!),
    enabled: !!publicClient && !!address,
    staleTime: 30_000,
  });
}

export function useIsFollowing(follower?: `0x${string}`, followee?: `0x${string}`) {
  const publicClient = usePublicClient();
  return useQuery({
    queryKey: ['isFollowing', follower, followee],
    queryFn: () =>
      publicClient!.readContract({
        address: ritualSocialContract.address,
        abi: ritualSocialContract.abi,
        functionName: 'isFollowing',
        args: [follower, followee],
      }) as Promise<boolean>,
    enabled: !!publicClient && !!follower && !!followee,
  });
}

export function useUpdateProfile() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const updateProfile = useCallback(
    async (metadataURI: string) => {
      setPending(true);
      try {
        const hash = await writeContractAsync({
          address: ritualSocialContract.address,
          abi: ritualSocialContract.abi,
          functionName: 'updateProfile',
          args: [metadataURI],
        });
        toast.loading('Menyimpan profil on-chain…', { id: hash });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          toast.success('Profil berhasil diperbarui', { id: hash });
          queryClient.invalidateQueries({ queryKey: ['profile', address] });
          return true;
        }
        toast.error('Transaksi revert', { id: hash });
        return false;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Transaksi gagal atau ditolak');
        return false;
      } finally {
        setPending(false);
      }
    },
    [writeContractAsync, publicClient, address, queryClient],
  );

  return { updateProfile, pending };
}

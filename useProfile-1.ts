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
  })) as unknown as [string, bigint, bigint, bigint, bigint, boolean];

  // Solidity's auto-generated getter for `mapping(address => Profile) public profiles`
  // returns the struct's fields as a positional tuple (metadataURI, joinedAt,
  // postCount, followerCount, followingCount, registered) — NOT a named object —
  // so we destructure by position rather than by field name.
  const [metadataURI, joinedAt, postCount, followerCount, followingCount] = struct;

  const metadata = await fetchProfileMetadata(metadataURI);

  return {
    address,
    displayName: metadata.displayName || `${address.slice(0, 6)}…${address.slice(-4)}`,
    username: metadata.username || address.slice(2, 10).toLowerCase(),
    bio: metadata.bio ?? '',
    website: metadata.website,
    location: metadata.location,
    avatarURI: metadata.avatarURI,
    bannerURI: metadata.bannerURI,
    joinedAt: Number(joinedAt) * 1000,
    followerCount: Number(followerCount),
    followingCount: Number(followingCount),
    postCount: Number(postCount),
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
          type: 'legacy',
          gas: 200_000n,
        });
        toast.loading('Saving profile on-chain…', { id: hash });
        const receipt = await publicClient!.waitForTransactionReceipt({ hash });
        if (receipt.status === 'success') {
          toast.success('Profile updated successfully', { id: hash });
          queryClient.invalidateQueries({ queryKey: ['profile', address] });
          return true;
        }
        toast.error('Transaction reverted', { id: hash });
        return false;
      } catch (err: any) {
        toast.error(err?.shortMessage ?? 'Transaction failed or rejected');
        return false;
      } finally {
        setPending(false);
      }
    },
    [writeContractAsync, publicClient, address, queryClient],
  );

  return { updateProfile, pending };
}

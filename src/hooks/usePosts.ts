import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicClient, useAccount } from 'wagmi';
import { ritualSocialContract } from '@/contracts';
import { fetchPostMetadata } from '@/lib/ipfs';
import { chainTimestampToMs } from '@/lib/utils';
import { fetchProfile } from './useProfile';
import type { PostRecord } from '@/types';
import { explorerTxUrl } from '@/config/chain';

interface PostDiscovery {
  postId: bigint;
  author: `0x${string}`;
  blockNumber: bigint;
  txHash: `0x${string}`;
}

const TARGET_POST_COUNT = 30;

async function discoverViaIndexer(): Promise<PostDiscovery[] | null> {
  try {
    const res = await fetch('/.netlify/functions/feed');
    if (!res.ok) return null;
    const { posts } = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) return null;
    return posts.map((p: any) => ({
      postId: BigInt(p.postId),
      author: p.author as `0x${string}`,
      blockNumber: BigInt(p.blockNumber),
      txHash: p.txHash as `0x${string}`,
    }));
  } catch {
    return null;
  }
}

async function discoverViaIdEnumeration(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
): Promise<bigint[]> {
  const nextPostId = (await publicClient.readContract({
    address: ritualSocialContract.address,
    abi: ritualSocialContract.abi,
    functionName: 'nextPostId',
  })) as bigint;

  const ids: bigint[] = [];
  for (let id = nextPostId - 1n; id >= 1n && ids.length < TARGET_POST_COUNT; id--) {
    ids.push(id);
  }
  return ids;
}

async function loadFeed(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  viewer?: `0x${string}`,
): Promise<PostRecord[]> {
  const [ids, indexed] = await Promise.all([
    discoverViaIdEnumeration(publicClient),
    discoverViaIndexer().catch(() => null),
  ]);

  const txByPostId = new Map<string, `0x${string}`>();
  for (const d of indexed ?? []) {
    txByPostId.set(d.postId.toString(), d.txHash);
  }

  const profileCache = new Map<string, ReturnType<typeof fetchProfile>>();

  function fetchProfileCached(author: `0x${string}`) {
    const key = author.toLowerCase();
    if (!profileCache.has(key)) {
      profileCache.set(key, fetchProfile(publicClient, author));
    }
    return profileCache.get(key)!;
  }

  const posts = await Promise.all(
    ids.map(async (postId) => {
      const rawStruct = (await publicClient.readContract({
        address: ritualSocialContract.address,
        abi: ritualSocialContract.abi,
        functionName: 'posts',
        args: [postId],
      })) as unknown as [string, string, bigint, bigint, bigint, bigint, boolean, bigint, boolean];

      const [author, contentURI, timestamp, likeCount, commentCount, repostCount, isRepost, originalPostId, exists] =
        rawStruct;

      if (!exists) return null;

      const [profile, likedByMe, repostedByMe] = await Promise.all([
        fetchProfileCached(author as `0x${string}`),
        viewer
          ? (publicClient.readContract({
              address: ritualSocialContract.address,
              abi: ritualSocialContract.abi,
              functionName: 'hasLiked',
              args: [postId, viewer],
            }) as Promise<boolean>)
          : Promise.resolve(false),
        viewer
          ? (publicClient.readContract({
              address: ritualSocialContract.address,
              abi: ritualSocialContract.abi,
              functionName: 'hasReposted',
              args: [postId, viewer],
            }) as Promise<boolean>)
          : Promise.resolve(false),
      ]);

      let caption = '';
      let images: string[] = [];
      try {
        const meta = await fetchPostMetadata(contentURI);
        caption = meta.caption;
        images = meta.images;
      } catch {
        caption = '(failed to load IPFS metadata)';
      }

      const record: PostRecord = {
        id: postId.toString(),
        author: profile,
        images,
        caption,
        createdAt: chainTimestampToMs(timestamp),
        likeCount: Number(likeCount),
        commentCount: Number(commentCount),
        repostCount: Number(repostCount),
        viewCount: 0,
        isRepost,
        originalPostId: isRepost ? String(originalPostId) : undefined,
        onChain: {
          txHash: txByPostId.get(postId.toString()) ?? ('0x0' as `0x${string}`),
          blockNumber: 0,
          timestamp: chainTimestampToMs(timestamp),
          from: author as `0x${string}`,
          to: ritualSocialContract.address,
          status: 'success',
        },
        likedByMe,
        repostedByMe,
      };
      return record;
    }),
  );

  const loaded = posts.filter((p): p is PostRecord => p !== null);

  // SORTING: Paling banyak engagement di atas
  const engagement = (p: PostRecord) => p.likeCount + p.commentCount + p.repostCount;

  return loaded.sort((a, b) => {
    const engA = engagement(a);
    const engB = engagement(b);

    // Urutkan berdasarkan engagement tertinggi
    if (engB !== engA) return engB - engA;

    // Jika engagement sama, postingan lebih baru di atas
    return b.createdAt - a.createdAt;
  });
}

export function useFeed() {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  return useQuery({
    queryKey: ['feed', address],
    queryFn: () => loadFeed(publicClient!, address),
    enabled: !!publicClient,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

export function usePost(postId?: string) {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  return useQuery({
    queryKey: ['post', postId, address],
    queryFn: async (): Promise<PostRecord> => {
      const id = BigInt(postId!);
      const rawStruct = (await publicClient!.readContract({
        address: ritualSocialContract.address,
        abi: ritualSocialContract.abi,
        functionName: 'posts',
        args: [id],
      })) as unknown as [string, string, bigint, bigint, bigint, bigint, boolean, bigint, boolean];

      const [author, contentURI, timestamp, likeCount, commentCount, repostCount, isRepost, originalPostId, exists] =
        rawStruct;

      if (!exists) throw new Error('Post not found');

      const [profile, likedByMe, repostedByMe, meta] = await Promise.all([
        fetchProfile(publicClient!, author as `0x${string}`),
        address
          ? (publicClient!.readContract({
              address: ritualSocialContract.address,
              abi: ritualSocialContract.abi,
              functionName: 'hasLiked',
              args: [id, address],
            }) as Promise<boolean>)
          : Promise.resolve(false),
        address
          ? (publicClient!.readContract({
              address: ritualSocialContract.address,
              abi: ritualSocialContract.abi,
              functionName: 'hasReposted',
              args: [id, address],
            }) as Promise<boolean>)
          : Promise.resolve(false),
        fetchPostMetadata(contentURI).catch(() => ({ caption: '(failed to load metadata)', images: [] }) as any),
      ]);

      return {
        id: postId!,
        author: profile,
        images: meta.images ?? [],
        caption: meta.caption ?? '',
        createdAt: chainTimestampToMs(timestamp),
        likeCount: Number(likeCount),
        commentCount: Number(commentCount),
        repostCount: Number(repostCount),
        viewCount: 0,
        isRepost,
        originalPostId: isRepost ? String(originalPostId) : undefined,
        onChain: {
          txHash: '0x0' as `0x${string}`,
          blockNumber: 0,
          timestamp: chainTimestampToMs(timestamp),
          from: author as `0x${string}`,
          to: ritualSocialContract.address,
          status: 'success',
        },
        likedByMe,
        repostedByMe,
      };
    },
    enabled: !!publicClient && !!postId,
  });
}

export function useInvalidateFeed() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['feed'] });
}

export function postExplorerUrl(txHash: string) {
  return explorerTxUrl(txHash);
                     }

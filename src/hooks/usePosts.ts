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
const CHUNK_SIZE = 50_000n;
const MAX_CHUNKS = 40;

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

async function discoverViaChainScan(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
): Promise<PostDiscovery[]> {
  const latestBlock = await publicClient.getBlockNumber();
  let toBlock = latestBlock;
  const collected: Awaited<ReturnType<typeof publicClient.getContractEvents>> = [];

  for (let i = 0; i < MAX_CHUNKS && toBlock > 0n; i++) {
    const fromBlock = toBlock > CHUNK_SIZE ? toBlock - CHUNK_SIZE : 0n;
    const chunkLogs = await publicClient.getContractEvents({
      address: ritualSocialContract.address,
      abi: ritualSocialContract.abi,
      eventName: 'PostCreated',
      fromBlock,
      toBlock,
    });
    collected.push(...chunkLogs);
    if (collected.length >= TARGET_POST_COUNT || fromBlock === 0n) break;
    toBlock = fromBlock - 1n;
  }

  return collected.map((log) => ({
    postId: (log as any).args.postId as bigint,
    author: (log as any).args.author as `0x${string}`,
    blockNumber: log.blockNumber!,
    txHash: log.transactionHash!,
  }));
}

async function loadFeed(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  viewer?: `0x${string}`,
): Promise<PostRecord[]> {
  const discovered = (await discoverViaIndexer()) ?? (await discoverViaChainScan(publicClient));

  const sorted = [...discovered].sort((a, b) => Number(b.blockNumber - a.blockNumber)).slice(0, TARGET_POST_COUNT);

  const profileCache = new Map<string, ReturnType<typeof fetchProfile>>();
  function fetchProfileCached(author: `0x${string}`) {
    const key = author.toLowerCase();
    if (!profileCache.has(key)) {
      profileCache.set(key, fetchProfile(publicClient, author));
    }
    return profileCache.get(key)!;
  }

  const posts = await Promise.all(
    sorted.map(async (discovery) => {
      const { postId, author } = discovery;

      const [rawStruct, profile, likedByMe, repostedByMe] = await Promise.all([
        publicClient.readContract({
          address: ritualSocialContract.address,
          abi: ritualSocialContract.abi,
          functionName: 'posts',
          args: [postId],
        }) as Promise<unknown>,
        fetchProfileCached(author),
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

      const [, contentURI, timestamp, likeCount, commentCount, repostCount, isRepost, originalPostId] =
        rawStruct as [string, string, bigint, bigint, bigint, bigint, boolean, bigint, boolean];

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
          txHash: discovery.txHash,
          blockNumber: Number(discovery.blockNumber),
          timestamp: chainTimestampToMs(timestamp),
          from: author,
          to: ritualSocialContract.address,
          status: 'success',
        },
        likedByMe,
        repostedByMe,
      };
      return record;
    }),
  );

  return posts;
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

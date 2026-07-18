import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicClient, useAccount } from 'wagmi';
import { ritualSocialContract } from '@/contracts';
import { fetchPostMetadata } from '@/lib/ipfs';
import { fetchProfile } from './useProfile';
import type { PostRecord } from '@/types';
import { explorerTxUrl } from '@/config/chain';

/**
 * Reads PostCreated / PostReposted logs directly from Ritual Chain, then
 * hydrates each post with its on-chain struct + IPFS metadata. This is a
 * real (if unindexed) read path — for feed-scale traffic you'll want to
 * swap this for a proper indexer/subgraph, but nothing here is mocked.
 */
async function loadFeed(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  viewer?: `0x${string}`,
): Promise<PostRecord[]> {
  const latestBlock = await publicClient.getBlockNumber();
  const lookback = 50_000n; // ~ adjust to your chain's block time / retention
  const fromBlock = latestBlock > lookback ? latestBlock - lookback : 0n;

  const logs = await publicClient.getContractEvents({
    address: ritualSocialContract.address,
    abi: ritualSocialContract.abi,
    eventName: 'PostCreated',
    fromBlock,
    toBlock: latestBlock,
  });

  const sorted = [...logs].sort((a, b) => Number(b.blockNumber! - a.blockNumber!)).slice(0, 60);

  const posts = await Promise.all(
    sorted.map(async (log) => {
      const postId = (log as any).args.postId as bigint;
      const author = (log as any).args.author as `0x${string}`;

      const [rawStruct, profile, likedByMe, repostedByMe] = await Promise.all([
        publicClient.readContract({
          address: ritualSocialContract.address,
          abi: ritualSocialContract.abi,
          functionName: 'posts',
          args: [postId],
        }) as Promise<unknown>,
        fetchProfile(publicClient, author),
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

      // RitualSocial's auto-generated `posts(id)` getter returns the Post
      // struct's fields as a positional tuple, not a named object — destructure
      // by position: (author, contentURI, timestamp, likeCount, commentCount,
      // repostCount, isRepost, originalPostId, exists).
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
        createdAt: Number(timestamp) * 1000,
        likeCount: Number(likeCount),
        commentCount: Number(commentCount),
        repostCount: Number(repostCount),
        viewCount: 0,
        isRepost,
        originalPostId: isRepost ? String(originalPostId) : undefined,
        onChain: {
          txHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber),
          timestamp: Number(timestamp) * 1000,
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
    refetchInterval: 30_000,
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
        createdAt: Number(timestamp) * 1000,
        likeCount: Number(likeCount),
        commentCount: Number(commentCount),
        repostCount: Number(repostCount),
        viewCount: 0,
        isRepost,
        originalPostId: isRepost ? String(originalPostId) : undefined,
        onChain: {
          txHash: '0x0' as `0x${string}`,
          blockNumber: 0,
          timestamp: Number(timestamp) * 1000,
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

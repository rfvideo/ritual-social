import { useQuery } from '@tanstack/react-query';
import { usePublicClient, useAccount } from 'wagmi';
import { ritualSocialContract } from '@/contracts';
import { fetchProfile } from './useProfile';
import type { NotificationRecord } from '@/types';

async function loadNotifications(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  viewer: `0x${string}`,
): Promise<NotificationRecord[]> {
  const latestBlock = await publicClient.getBlockNumber();
  const lookback = 50_000n;
  const fromBlock = latestBlock > lookback ? latestBlock - lookback : 0n;
  const range = { fromBlock, toBlock: latestBlock };

  const [likedLogs, followedLogs, commentLogs, repostLogs] = await Promise.all([
    publicClient.getContractEvents({
      address: ritualSocialContract.address,
      abi: ritualSocialContract.abi,
      eventName: 'PostLiked',
      args: { author: viewer },
      ...range,
    }),
    publicClient.getContractEvents({
      address: ritualSocialContract.address,
      abi: ritualSocialContract.abi,
      eventName: 'Followed',
      args: { followee: viewer },
      ...range,
    }),
    publicClient.getContractEvents({
      address: ritualSocialContract.address,
      abi: ritualSocialContract.abi,
      eventName: 'CommentAdded',
      ...range,
    }),
    publicClient.getContractEvents({
      address: ritualSocialContract.address,
      abi: ritualSocialContract.abi,
      eventName: 'PostReposted',
      ...range,
    }),
  ]);

  const notifications: NotificationRecord[] = [];

  for (const log of likedLogs) {
    const args = (log as any).args;
    if (args.liker.toLowerCase() === viewer.toLowerCase()) continue;
    const actor = await fetchProfile(publicClient, args.liker);
    notifications.push({
      id: `like-${log.transactionHash}-${log.logIndex}`,
      kind: 'like',
      actor,
      postId: args.postId.toString(),
      createdAt: Number((await publicClient.getBlock({ blockNumber: log.blockNumber! })).timestamp) * 1000,
      read: false,
    });
  }

  for (const log of followedLogs) {
    const args = (log as any).args;
    const actor = await fetchProfile(publicClient, args.follower);
    notifications.push({
      id: `follow-${log.transactionHash}-${log.logIndex}`,
      kind: 'follow',
      actor,
      createdAt: Number((await publicClient.getBlock({ blockNumber: log.blockNumber! })).timestamp) * 1000,
      read: false,
    });
  }

  // Comments/reposts need the underlying post's author resolved before we know they're "for" the viewer.
  for (const log of commentLogs) {
    const args = (log as any).args;
    if (args.author.toLowerCase() === viewer.toLowerCase()) continue;
    const post = (await publicClient.readContract({
      address: ritualSocialContract.address,
      abi: ritualSocialContract.abi,
      functionName: 'posts',
      args: [args.postId],
    })) as any;
    if (post.author.toLowerCase() !== viewer.toLowerCase()) continue;
    const actor = await fetchProfile(publicClient, args.author);
    notifications.push({
      id: `comment-${log.transactionHash}-${log.logIndex}`,
      kind: 'comment',
      actor,
      postId: args.postId.toString(),
      createdAt: Number(args.timestamp) * 1000,
      read: false,
    });
  }

  for (const log of repostLogs) {
    const args = (log as any).args;
    if (args.reposter.toLowerCase() === viewer.toLowerCase()) continue;
    const post = (await publicClient.readContract({
      address: ritualSocialContract.address,
      abi: ritualSocialContract.abi,
      functionName: 'posts',
      args: [args.postId],
    })) as any;
    if (post.author.toLowerCase() !== viewer.toLowerCase()) continue;
    const actor = await fetchProfile(publicClient, args.reposter);
    notifications.push({
      id: `repost-${log.transactionHash}-${log.logIndex}`,
      kind: 'repost',
      actor,
      postId: args.postId.toString(),
      createdAt: Number(args.timestamp) * 1000,
      read: false,
    });
  }

  return notifications.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
}

export function useNotifications() {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  return useQuery({
    queryKey: ['notifications', address],
    queryFn: () => loadNotifications(publicClient!, address!),
    enabled: !!publicClient && !!address,
    staleTime: 20_000,
    refetchInterval: 45_000,
  });
}

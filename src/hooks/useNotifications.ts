import { useQuery } from '@tanstack/react-query';
import { usePublicClient, useAccount } from 'wagmi';
import { ritualSocialContract } from '@/contracts';
import { fetchProfile } from './useProfile';
import { chainTimestampToMs } from '@/lib/utils';
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
      ...range,
    }),
    publicClient.getContractEvents({
      address: ritualSocialContract.address,
      abi: ritualSocialContract.abi,
      eventName: 'Followed',
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

  // Likes
  for (const log of likedLogs) {
    const args = (log as any).args;

    if (!args) continue;
    if (args.author.toLowerCase() !== viewer.toLowerCase()) continue;
    if (args.liker.toLowerCase() === viewer.toLowerCase()) continue;

    const actor = await fetchProfile(publicClient, args.liker);

    const block = await publicClient.getBlock({
      blockNumber: log.blockNumber!,
    });

    notifications.push({
      id: `like-${log.transactionHash}-${log.logIndex}`,
      kind: 'like',
      actor,
      postId: args.postId.toString(),
      createdAt: chainTimestampToMs(block.timestamp),
      read: false,
    });
  }

  // Follow
  for (const log of followedLogs) {
    const args = (log as any).args;

    if (!args) continue;
    if (args.followee.toLowerCase() !== viewer.toLowerCase()) continue;

    const actor = await fetchProfile(publicClient, args.follower);

    const block = await publicClient.getBlock({
      blockNumber: log.blockNumber!,
    });

    notifications.push({
      id: `follow-${log.transactionHash}-${log.logIndex}`,
      kind: 'follow',
      actor,
      createdAt: chainTimestampToMs(block.timestamp),
      read: false,
    });
  }

  // Comment
  for (const log of commentLogs) {
    const args = (log as any).args;

    if (!args) continue;
    if (args.author.toLowerCase() === viewer.toLowerCase()) continue;

    const post = (await publicClient.readContract({
      address: ritualSocialContract.address,
      abi: ritualSocialContract.abi,
      functionName: 'posts',
      args: [args.postId],
    })) as unknown as [string, ...unknown[]];

    const postAuthor = post[0];

    if (postAuthor.toLowerCase() !== viewer.toLowerCase()) continue;

    const actor = await fetchProfile(publicClient, args.author);

    const block = await publicClient.getBlock({
      blockNumber: log.blockNumber!,
    });

    notifications.push({
      id: `comment-${log.transactionHash}-${log.logIndex}`,
      kind: 'comment',
      actor,
      postId: args.postId.toString(),
      createdAt: chainTimestampToMs(block.timestamp),
      read: false,
    });
  }

  // Repost
  for (const log of repostLogs) {
    const args = (log as any).args;

    if (!args) continue;
    if (args.reposter.toLowerCase() === viewer.toLowerCase()) continue;

    const post = (await publicClient.readContract({
      address: ritualSocialContract.address,
      abi: ritualSocialContract.abi,
      functionName: 'posts',
      args: [args.postId],
    })) as unknown as [string, ...unknown[]];

    const postAuthor = post[0];

    if (postAuthor.toLowerCase() !== viewer.toLowerCase()) continue;

    const actor = await fetchProfile(publicClient, args.reposter);

    const block = await publicClient.getBlock({
      blockNumber: log.blockNumber!,
    });

    notifications.push({
      id: `repost-${log.transactionHash}-${log.logIndex}`,
      kind: 'repost',
      actor,
      postId: args.postId.toString(),
      createdAt: chainTimestampToMs(block.timestamp),
      read: false,
    });
  }

  return notifications
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);
}

export function useNotifications() {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  return useQuery({
    queryKey: ['notifications', address],
    queryFn: () => loadNotifications(publicClient!, address!),
    enabled: !!publicClient && !!address,
    staleTime: 20_000,
    refetchInterval: 15_000,
  });
}

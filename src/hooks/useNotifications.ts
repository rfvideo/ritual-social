import { useQuery } from '@tanstack/react-query';
import { usePublicClient, useAccount } from 'wagmi';
import { ritualSocialContract } from '@/contracts';
import { fetchProfile } from './useProfile';
import { fetchPostMetadata } from '@/lib/ipfs';
import { chainTimestampToMs } from '@/lib/utils';
import { getNotificationsLastSeenAt } from '@/lib/notificationReadState';
import type { NotificationRecord } from '@/types';

interface RawActivity {
  id: string;
  kind: 'like' | 'follow' | 'comment' | 'repost';
  actor: string;
  targetUser: string;
  postId?: string;
  commentText?: string;
  timestamp: number;
  blockNumber: string;
}

async function loadViaIndexer(viewer: `0x${string}`): Promise<RawActivity[] | null> {
  try {
    const res = await fetch(`/.netlify/functions/notifications?address=${viewer}`);
    if (!res.ok) return null;
    const { activity } = await res.json();
    return Array.isArray(activity) ? activity : null;
  } catch {
    return null;
  }
}

async function loadViaDirectScan(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  viewer: `0x${string}`,
): Promise<RawActivity[]> {
  const latestBlock = await publicClient.getBlockNumber();
  const lookback = 100_000n;
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
    publicClient.getContractEvents({ address: ritualSocialContract.address, abi: ritualSocialContract.abi, eventName: 'CommentAdded', ...range }),
    publicClient.getContractEvents({ address: ritualSocialContract.address, abi: ritualSocialContract.abi, eventName: 'PostReposted', ...range }),
  ]);

  const activity: RawActivity[] = [];

  for (const log of likedLogs) {
    const args = (log as any).args;
    activity.push({
      id: `like-${log.transactionHash}-${log.logIndex}`,
      kind: 'like',
      actor: args.liker,
      targetUser: args.author,
      postId: args.postId.toString(),
      timestamp: chainTimestampToMs(args.timestamp),
      blockNumber: log.blockNumber!.toString(),
    });
  }
  for (const log of followedLogs) {
    const args = (log as any).args;
    activity.push({
      id: `follow-${log.transactionHash}-${log.logIndex}`,
      kind: 'follow',
      actor: args.follower,
      targetUser: args.followee,
      timestamp: chainTimestampToMs(args.timestamp),
      blockNumber: log.blockNumber!.toString(),
    });
  }
  for (const log of commentLogs) {
    const args = (log as any).args;
    if (args.author.toLowerCase() === viewer.toLowerCase()) continue;
    const post = (await publicClient.readContract({
      address: ritualSocialContract.address,
      abi: ritualSocialContract.abi,
      functionName: 'posts',
      args: [args.postId],
    })) as unknown as [string, ...unknown[]];
    if (post[0].toLowerCase() !== viewer.toLowerCase()) continue;
    const commentText = await fetchPostMetadata(args.contentURI)
      .then((m) => m.caption)
      .catch(() => undefined);
    activity.push({
      id: `comment-${log.transactionHash}-${log.logIndex}`,
      kind: 'comment',
      actor: args.author,
      targetUser: viewer,
      postId: args.postId.toString(),
      commentText,
      timestamp: chainTimestampToMs(args.timestamp),
      blockNumber: log.blockNumber!.toString(),
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
    })) as unknown as [string, ...unknown[]];
    if (post[0].toLowerCase() !== viewer.toLowerCase()) continue;
    activity.push({
      id: `repost-${log.transactionHash}-${log.logIndex}`,
      kind: 'repost',
      actor: args.reposter,
      targetUser: viewer,
      postId: args.postId.toString(),
      timestamp: chainTimestampToMs(args.timestamp),
      blockNumber: log.blockNumber!.toString(),
    });
  }

  return activity;
}

async function loadNotifications(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  viewer: `0x${string}`,
): Promise<NotificationRecord[]> {
  const [indexed, recent] = await Promise.all([
    loadViaIndexer(viewer),
    loadViaDirectScan(publicClient, viewer).catch(() => [] as RawActivity[]),
  ]);
  const merged = new Map<string, RawActivity>();
  for (const a of [...(indexed ?? []), ...recent]) {
    merged.set(a.id, a);
  }
  const raw = Array.from(merged.values());

  const profileCache = new Map<string, ReturnType<typeof fetchProfile>>();
  function actorProfile(address: string) {
    const key = address.toLowerCase();
    if (!profileCache.has(key)) {
      profileCache.set(key, fetchProfile(publicClient, address as `0x${string}`));
    }
    return profileCache.get(key)!;
  }

  const lastSeenAt = getNotificationsLastSeenAt(viewer);

  const notifications = await Promise.all(
    raw.map(async (a) => ({
      id: a.id,
      kind: a.kind,
      actor: await actorProfile(a.actor),
      postId: a.postId,
      commentText: a.commentText,
      createdAt: a.timestamp,
      read: a.timestamp <= lastSeenAt,
    })),
  );

  return notifications.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
}

export function useNotifications() {
  const publicClient = usePublicClient();
  const { address } = useAccount();

  return useQuery({
    queryKey: ['notifications', address],
    queryFn: () => loadNotifications(publicClient!, address!),
    enabled: !!publicClient && !!address,
    staleTime: 8_000,
    refetchInterval: 12_000,
    retry: 2,
    retryDelay: (attempt) => 1000 * (attempt + 1),
  });
      }

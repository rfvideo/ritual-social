import type { Config } from '@netlify/functions';
import { createPublicClient, http, parseAbiItem } from 'viem';
import {
  readIndex,
  writeIndex,
  readCheckpoint,
  writeCheckpoint,
  readActivity,
  writeActivity,
  type IndexedPost,
  type ActivityEvent,
} from './_index-store';

const RPC_URL = process.env.VITE_RITUAL_RPC_URL ?? '';
const CONTRACT_ADDRESS = (process.env.VITE_RITUAL_SOCIAL_ADDRESS ?? '') as `0x${string}`;
const CHAIN_ID = Number(process.env.VITE_RITUAL_CHAIN_ID ?? 1979);

const CHUNK = 500_000n;
const INITIAL_BACKFILL = 2_000_000n;

const POST_CREATED_EVENT = parseAbiItem(
  'event PostCreated(uint256 indexed postId, address indexed author, string contentURI, uint64 timestamp)',
);
const POST_LIKED_EVENT = parseAbiItem(
  'event PostLiked(uint256 indexed postId, address indexed liker, address indexed author, uint64 timestamp)',
);
const COMMENT_ADDED_EVENT = parseAbiItem(
  'event CommentAdded(uint256 indexed commentId, uint256 indexed postId, address indexed author, string contentURI, uint64 timestamp)',
);
const POST_REPOSTED_EVENT = parseAbiItem(
  'event PostReposted(uint256 indexed postId, uint256 indexed newPostId, address indexed reposter, uint64 timestamp)',
);
const FOLLOWED_EVENT = parseAbiItem('event Followed(address indexed follower, address indexed followee, uint64 timestamp)');

export default async () => {
  if (!RPC_URL || !CONTRACT_ADDRESS) {
    console.error('[reindex] missing VITE_RITUAL_RPC_URL or VITE_RITUAL_SOCIAL_ADDRESS env vars');
    return;
  }

  const client = createPublicClient({
    chain: {
      id: CHAIN_ID,
      name: 'ritual',
      nativeCurrency: { name: 'RITUAL', symbol: 'RITUAL', decimals: 18 },
      rpcUrls: { default: { http: [RPC_URL] } },
    },
    transport: http(RPC_URL),
  });

  const latestBlock = await client.getBlockNumber();
  const storedCheckpoint = await readCheckpoint();
  const checkpoint = storedCheckpoint ?? (latestBlock > INITIAL_BACKFILL ? latestBlock - INITIAL_BACKFILL : 0n);

  const fromBlock = checkpoint + 1n;
  if (fromBlock > latestBlock) {
    console.log('[reindex] already up to date');
    return;
  }
  const toBlock = fromBlock + CHUNK < latestBlock ? fromBlock + CHUNK : latestBlock;

  try {
    const [postLogs, likeLogs, commentLogs, repostLogs, followLogs] = await Promise.all([
      client.getLogs({ address: CONTRACT_ADDRESS, event: POST_CREATED_EVENT, fromBlock, toBlock }),
      client.getLogs({ address: CONTRACT_ADDRESS, event: POST_LIKED_EVENT, fromBlock, toBlock }),
      client.getLogs({ address: CONTRACT_ADDRESS, event: COMMENT_ADDED_EVENT, fromBlock, toBlock }),
      client.getLogs({ address: CONTRACT_ADDRESS, event: POST_REPOSTED_EVENT, fromBlock, toBlock }),
      client.getLogs({ address: CONTRACT_ADDRESS, event: FOLLOWED_EVENT, fromBlock, toBlock }),
    ]);

    if (postLogs.length > 0) {
      const existing = await readIndex();
      const newEntries: IndexedPost[] = postLogs.map((log) => ({
        postId: (log.args.postId as bigint).toString(),
        author: log.args.author as string,
        blockNumber: log.blockNumber!.toString(),
        txHash: log.transactionHash!,
      }));
      const seen = new Set<string>();
      const merged = [...newEntries.reverse(), ...existing].filter((p) => {
        if (seen.has(p.postId)) return false;
        seen.add(p.postId);
        return true;
      });
      await writeIndex(merged);
      console.log(`[reindex] indexed ${newEntries.length} new post(s)`);
    }

    const postAuthorCache = new Map<string, string>();
    async function resolvePostAuthor(postId: bigint): Promise<string | null> {
      const key = postId.toString();
      if (postAuthorCache.has(key)) return postAuthorCache.get(key)!;
      try {
        const post = (await client.readContract({
          address: CONTRACT_ADDRESS,
          abi: [
            {
              name: 'posts',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: '', type: 'uint256' }],
              outputs: [{ name: 'author', type: 'address' }],
            },
          ],
          functionName: 'posts',
          args: [postId],
        })) as string;
        postAuthorCache.set(key, post);
        return post;
      } catch {
        return null;
      }
    }

    const newActivity: ActivityEvent[] = [];

    for (const log of likeLogs) {
      newActivity.push({
        id: `like-${log.transactionHash}-${log.logIndex}`,
        kind: 'like',
        actor: log.args.liker as string,
        targetUser: log.args.author as string,
        postId: (log.args.postId as bigint).toString(),
        timestamp: Number(log.args.timestamp) * 1000,
        blockNumber: log.blockNumber!.toString(),
      });
    }

    for (const log of followLogs) {
      newActivity.push({
        id: `follow-${log.transactionHash}-${log.logIndex}`,
        kind: 'follow',
        actor: log.args.follower as string,
        targetUser: log.args.followee as string,
        timestamp: Number(log.args.timestamp) * 1000,
        blockNumber: log.blockNumber!.toString(),
      });
    }

    for (const log of commentLogs) {
      const postAuthor = await resolvePostAuthor(log.args.postId as bigint);
      if (!postAuthor) continue;
      newActivity.push({
        id: `comment-${log.transactionHash}-${log.logIndex}`,
        kind: 'comment',
        actor: log.args.author as string,
        targetUser: postAuthor,
        postId: (log.args.postId as bigint).toString(),
        timestamp: Number(log.args.timestamp) * 1000,
        blockNumber: log.blockNumber!.toString(),
      });
    }

    for (const log of repostLogs) {
      const postAuthor = await resolvePostAuthor(log.args.postId as bigint);
      if (!postAuthor) continue;
      newActivity.push({
        id: `repost-${log.transactionHash}-${log.logIndex}`,
        kind: 'repost',
        actor: log.args.reposter as string,
        targetUser: postAuthor,
        postId: (log.args.postId as bigint).toString(),
        timestamp: Number(log.args.timestamp) * 1000,
        blockNumber: log.blockNumber!.toString(),
      });
    }

    if (newActivity.length > 0) {
      const existingActivity = await readActivity();
      const seen = new Set<string>();
      const merged = [...newActivity.reverse(), ...existingActivity].filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
      await writeActivity(merged);
      console.log(`[reindex] indexed ${newActivity.length} new activity event(s)`);
    }

    await writeCheckpoint(toBlock);
  } catch (err) {
    console.error('[reindex] failed, will retry same range next run:', err);
  }
};

export const config: Config = {
  schedule: '0 * * * *',
};

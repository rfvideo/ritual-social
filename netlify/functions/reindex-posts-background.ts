import type { Config } from '@netlify/functions';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { readIndex, writeIndex, readCheckpoint, writeCheckpoint, type IndexedPost } from './_index-store';

const RPC_URL = process.env.VITE_RITUAL_RPC_URL ?? '';
const CONTRACT_ADDRESS = (process.env.VITE_RITUAL_SOCIAL_ADDRESS ?? '') as `0x${string}`;
const CHAIN_ID = Number(process.env.VITE_RITUAL_CHAIN_ID ?? 1979);

const CHUNK = 500_000n;
const INITIAL_BACKFILL = 2_000_000n;

const POST_CREATED_EVENT = parseAbiItem(
  'event PostCreated(uint256 indexed postId, address indexed author, string contentURI, uint64 timestamp)',
);

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
    const logs = await client.getLogs({
      address: CONTRACT_ADDRESS,
      event: POST_CREATED_EVENT,
      fromBlock,
      toBlock,
    });

    if (logs.length > 0) {
      const existing = await readIndex();
      const newEntries: IndexedPost[] = logs.map((log) => ({
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
      console.log(`[reindex] indexed ${newEntries.length} new post(s) from blocks ${fromBlock}-${toBlock}`);
    }

    await writeCheckpoint(toBlock);
  } catch (err) {
    console.error('[reindex] failed, will retry same range next run:', err);
  }
};

export const config: Config = {
  schedule: '*/5 * * * *',
};

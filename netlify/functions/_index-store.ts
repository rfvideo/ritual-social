import { getStore } from '@netlify/blobs';

const STORE_NAME = 'ritual-social-index';
const INDEX_KEY = 'posts';
const CHECKPOINT_KEY = 'checkpoint';
const ACTIVITY_KEY = 'activity';
const FOLLOW_GRAPH_KEY = 'follow-graph';

const MAX_ENTRIES = 1000;
const MAX_ACTIVITY_ENTRIES = 500;

export interface IndexedPost {
  postId: string;
  author: string;
  blockNumber: string;
  txHash: string;
}

export type ActivityKind = 'like' | 'follow' | 'comment' | 'repost';

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  actor: string;
  targetUser: string;
  postId?: string;
  commentText?: string;
  timestamp: number;
  blockNumber: string;
}

export type FollowGraph = Record<string, string[]>;

function getIndexStore() {
  return getStore({
    name: STORE_NAME,
    siteID: process.env.NETLIFY_SITE_ID!,
    token: process.env.NETLIFY_BLOBS_TOKEN!,
  });
}

export async function readIndex(): Promise<IndexedPost[]> {
  const store = getIndexStore();
  const data = await store.get(INDEX_KEY, { type: 'json' }).catch(() => null);
  return (data as IndexedPost[] | null) ?? [];
}

export async function writeIndex(posts: IndexedPost[]): Promise<void> {
  const store = getIndexStore();
  await store.setJSON(INDEX_KEY, posts.slice(0, MAX_ENTRIES));
}

export async function readCheckpoint(): Promise<bigint | null> {
  const store = getIndexStore();
  const val = await store.get(CHECKPOINT_KEY).catch(() => null);
  return val ? BigInt(val as string) : null;
}

export async function writeCheckpoint(block: bigint): Promise<void> {
  const store = getIndexStore();
  await store.set(CHECKPOINT_KEY, block.toString());
}

export async function readActivity(): Promise<ActivityEvent[]> {
  const store = getIndexStore();
  const data = await store.get(ACTIVITY_KEY, { type: 'json' }).catch(() => null);
  return (data as ActivityEvent[] | null) ?? [];
}

export async function writeActivity(events: ActivityEvent[]): Promise<void> {
  const store = getIndexStore();
  await store.setJSON(ACTIVITY_KEY, events.slice(0, MAX_ACTIVITY_ENTRIES));
}

export async function readFollowGraph(): Promise<FollowGraph> {
  const store = getIndexStore();
  const data = await store.get(FOLLOW_GRAPH_KEY, { type: 'json' }).catch(() => null);
  return (data as FollowGraph | null) ?? {};
}

export async function writeFollowGraph(graph: FollowGraph): Promise<void> {
  const store = getIndexStore();
  await store.setJSON(FOLLOW_GRAPH_KEY, graph);
}

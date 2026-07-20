import type { Handler } from '@netlify/functions';
import { readFollowGraph } from './_index-store';
import { jsonResponse } from './_infernet-client';

export const handler: Handler = async (event) => {
  try {
    const address = (event.queryStringParameters?.address ?? '').toLowerCase();
    const type = event.queryStringParameters?.type === 'followers' ? 'followers' : 'following';
    if (!address) {
      return jsonResponse({ error: 'address query param is required', addresses: [] }, 400);
    }

    const graph = await readFollowGraph();

    if (type === 'following') {
      return jsonResponse({ addresses: graph[address] ?? [] });
    }

    const followers = Object.entries(graph)
      .filter(([, followees]) => followees.map((f) => f.toLowerCase()).includes(address))
      .map(([follower]) => follower);
    return jsonResponse({ addresses: followers });
  } catch (err: any) {
    console.error('[follow-graph]', err);
    return jsonResponse({ error: err.message ?? 'Failed to read follow graph', addresses: [] }, 500);
  }
};

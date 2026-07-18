import type { Handler } from '@netlify/functions';
import { runInfernetJob, jsonResponse } from './_infernet-client';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const { query } = JSON.parse(event.body ?? '{}');
  if (!query) return jsonResponse({ error: 'query is required' }, 400);

  // NOTE: real semantic search needs an embeddings index of your post corpus.
  // This function is the wiring point — point INFERNET_ROUTER_URL at a node
  // running an embeddings container, and swap the fallback below for a real
  // vector-similarity lookup against your indexed posts.
  const job = await runInfernetJob<{ postIds: string[]; explanation: string }>(
    { containerId: 'ritual-semantic-search', input: { query } },
    () => ({
      postIds: [],
      explanation:
        'Semantic search fallback active — connect INFERNET_ROUTER_URL to an embeddings container to enable real results.',
    }),
  );

  return jsonResponse(job);
};

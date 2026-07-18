import type { Handler } from '@netlify/functions';
import { runInfernetJob, jsonResponse } from './_infernet-client';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const { address, candidatePostIds } = JSON.parse(event.body ?? '{}');
  if (!Array.isArray(candidatePostIds)) {
    return jsonResponse({ error: 'candidatePostIds (array) is required' }, 400);
  }

  const job = await runInfernetJob<{ rankedPostIds: string[] }>(
    { containerId: 'ritual-recommend', input: { address, candidatePostIds } },
    () => ({
      // Fallback: reverse-chronological (newest first) is the neutral
      // default until a real preference model is wired up on your node.
      rankedPostIds: [...candidatePostIds].reverse(),
    }),
  );

  return jsonResponse(job);
};

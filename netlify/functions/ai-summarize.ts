import type { Handler } from '@netlify/functions';
import { runInfernetJob, jsonResponse } from './_infernet-client';
import type { SummaryOutput } from '../../src/types';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const { threadText } = JSON.parse(event.body ?? '{}');
  if (!threadText) return jsonResponse({ error: 'threadText is required' }, 400);

  const job = await runInfernetJob<SummaryOutput>(
    { containerId: 'ritual-summarize', input: { threadText } },
    () => {
      const sentences = String(threadText).split(/(?<=[.!?])\s+/).filter(Boolean);
      return {
        summary: sentences.slice(0, 2).join(' ') || 'Thread too short to summarize.',
        keyPoints: sentences.slice(0, 5),
      };
    },
  );

  return jsonResponse(job);
};

import type { Handler } from '@netlify/functions';
import { runInfernetJob, jsonResponse } from './_infernet-client';
import type { CaptionOutput } from '../../src/types';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const { imageURIs } = JSON.parse(event.body ?? '{}');
  if (!Array.isArray(imageURIs) || imageURIs.length === 0) {
    return jsonResponse({ error: 'imageURIs (non-empty array) is required' }, 400);
  }

  const job = await runInfernetJob<CaptionOutput>(
    { containerId: 'ritual-caption', input: { imageURIs } },
    () => ({
      caption: '',
      hashtags: [],
    }),
  );

  return jsonResponse(job);
};

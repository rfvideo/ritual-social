import type { Handler } from '@netlify/functions';
import { runInfernetJob, jsonResponse } from './_infernet-client';
import type { ModerationOutput } from '../../src/types';

const SPAM_PATTERNS = /\b(free\s*money|guaranteed\s*profit|airdrop\s*claim\s*now|dm\s*me\s*for)\b/i;
const PHISHING_PATTERNS = /\b(seed\s*phrase|connect\s*wallet\s*here|verify\s*your\s*wallet|claim\.\S+)\b/i;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const { text, imageURIs } = JSON.parse(event.body ?? '{}');
  if (typeof text !== 'string') return jsonResponse({ error: 'text is required' }, 400);

  const job = await runInfernetJob<ModerationOutput>(
    { containerId: 'ritual-moderate', input: { text, imageURIs: imageURIs ?? [] } },
    () => {
      const categories: ModerationOutput['categories'] = [];
      if (SPAM_PATTERNS.test(text)) categories.push('spam');
      if (PHISHING_PATTERNS.test(text)) categories.push('phishing', 'scam');
      return {
        flagged: categories.length > 0,
        categories,
        reason: categories.length > 0 ? 'Matched known spam/phishing heuristics (local fallback).' : undefined,
      };
    },
  );

  return jsonResponse(job);
};

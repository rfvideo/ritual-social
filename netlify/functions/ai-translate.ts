import type { Handler } from '@netlify/functions';
import { runInfernetJob, jsonResponse } from './_infernet-client';
import type { TranslationOutput } from '../../src/types';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const { text, targetLanguage } = JSON.parse(event.body ?? '{}');
  if (!text || !targetLanguage) {
    return jsonResponse({ error: 'text and targetLanguage are required' }, 400);
  }

  const job = await runInfernetJob<TranslationOutput>(
    {
      containerId: 'ritual-translate',
      input: { text, targetLanguage },
    },
    () => ({
      // Local fallback: naive passthrough so the UI flow is fully testable
      // before a real translation container is wired up on your node.
      sourceLanguage: 'auto',
      targetLanguage,
      translatedText: `[fallback:${targetLanguage}] ${text}`,
    }),
  );

  return jsonResponse(job);
};

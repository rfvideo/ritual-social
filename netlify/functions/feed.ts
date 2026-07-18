import type { Handler } from '@netlify/functions';
import { readIndex } from './_index-store';
import { jsonResponse } from './_infernet-client';

export const handler: Handler = async () => {
  try {
    const posts = await readIndex();
    return jsonResponse({ posts });
  } catch (err: any) {
    console.error('[feed]', err);
    return jsonResponse({ error: err.message ?? 'Failed to read index', posts: [] }, 500);
  }
};

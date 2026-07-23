import type { Handler } from '@netlify/functions';
import { readActivity } from './_index-store';
import { jsonResponse } from './_infernet-client';

export const handler: Handler = async (event) => {
  try {
    const address = (event.queryStringParameters?.address ?? '').toLowerCase();
    if (!address) {
      return jsonResponse({ error: 'address query param is required', postIds: [] }, 400);
    }
    const all = await readActivity();
    const postIds = Array.from(
      new Set(
        all
          .filter((a) => a.kind === 'comment' && a.actor.toLowerCase() === address && a.postId)
          .map((a) => a.postId as string),
      ),
    );
    return jsonResponse({ postIds });
  } catch (err: any) {
    console.error('[profile-replies]', err);
    return jsonResponse({ error: err.message ?? 'Failed to read activity', postIds: [] }, 500);
  }
};

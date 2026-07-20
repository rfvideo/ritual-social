import type { Handler } from '@netlify/functions';
import { readActivity } from './_index-store';
import { jsonResponse } from './_infernet-client';

export const handler: Handler = async (event) => {
  try {
    const address = (event.queryStringParameters?.address ?? '').toLowerCase();
    if (!address) {
      return jsonResponse({ error: 'address query param is required', activity: [] }, 400);
    }
    const all = await readActivity();
    const mine = all.filter((a) => a.targetUser.toLowerCase() === address && a.actor.toLowerCase() !== address);
    return jsonResponse({ activity: mine });
  } catch (err: any) {
    console.error('[notifications]', err);
    return jsonResponse({ error: err.message ?? 'Failed to read activity', activity: [] }, 500);
  }
};

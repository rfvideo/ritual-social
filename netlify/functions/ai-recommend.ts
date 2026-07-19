import type { Handler } from '@netlify/functions';
import { jsonResponse } from './_infernet-client';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const { candidatePostIds } = JSON.parse(event.body ?? '{}');

  if (!Array.isArray(candidatePostIds)) {
    return jsonResponse(
      { error: 'candidatePostIds (array) is required' },
      400,
    );
  }

  // Kembalikan urutan yang diterima dari frontend.
  // Frontend (usePosts.ts) sudah mengurutkan berdasarkan:
  // 1. Like terbanyak
  // 2. Comment terbanyak
  // 3. Repost terbanyak
  // 4. Jika sama, postingan terbaru
  return jsonResponse({
    id: 'local-ranking',
    status: 'completed',
    output: {
      rankedPostIds: candidatePostIds,
    },
  });
};

import type { Handler } from '@netlify/functions';
import { runInfernetJob, jsonResponse } from './_infernet-client';

/**
 * Post engagement signals forwarded to the ritual-recommend container.
 * The container ranks by engagement gravity with time decay — no ML
 * model download required, so this container starts instantly.
 */
interface PostSignal {
  postId: string;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  createdAt: number; // unix seconds
}

/**
 * Local fallback: mirrors the container's engagement-gravity formula so
 * results are consistent whether or not INFERNET_ROUTER_URL is configured.
 *
 * score = (likes + 2*comments + 1.5*reposts) * exp(-hours_old * 0.05)
 *         + 1 / (1 + hours_old)
 */
function localRank(posts: PostSignal[]): string[] {
  const now = Date.now() / 1000;
  return [...posts]
    .sort((a, b) => {
      const score = (p: PostSignal) => {
        const engagement = p.likeCount + 2 * p.commentCount + 1.5 * p.repostCount;
        const hoursOld = p.createdAt ? Math.max(0, (now - p.createdAt) / 3600) : 0;
        const decay = Math.exp(-hoursOld * 0.05);
        return engagement * decay + 1 / (1 + hoursOld);
      };
      return score(b) - score(a);
    })
    .map((p) => p.postId);
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const body = JSON.parse(event.body ?? '{}') as {
    posts?: PostSignal[];
    viewerAddress?: string;
    // Legacy callers send only candidatePostIds — supported for backward compat
    candidatePostIds?: string[];
  };

  // Legacy path: only postIds provided (no engagement signals available)
  if (!body.posts && Array.isArray(body.candidatePostIds)) {
    const syntheticPosts: PostSignal[] = body.candidatePostIds.map((id) => ({
      postId: id,
      likeCount: 0,
      commentCount: 0,
      repostCount: 0,
      createdAt: 0,
    }));
    const job = await runInfernetJob<{ rankedPostIds: string[] }>(
      { containerId: 'ritual-recommend', input: { posts: syntheticPosts, viewerAddress: '' } },
      () => ({ rankedPostIds: body.candidatePostIds! }),
    );
    return jsonResponse(job);
  }

  if (!Array.isArray(body.posts) || body.posts.length === 0) {
    return jsonResponse(
      { error: 'posts (non-empty PostSignal[]) or candidatePostIds (string[]) is required' },
      400,
    );
  }

  const job = await runInfernetJob<{ rankedPostIds: string[] }>(
    {
      containerId: 'ritual-recommend',
      input: { posts: body.posts, viewerAddress: body.viewerAddress ?? '' },
    },
    () => ({ rankedPostIds: localRank(body.posts!) }),
  );

  return jsonResponse(job);
};

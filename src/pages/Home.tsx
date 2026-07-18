import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useFeed } from '@/hooks/usePosts';
import { useFeedRecommendation } from '@/hooks/useAI';
import { PostFeedList } from '@/components/post/PostFeedList';
import type { PostRecord } from '@/types';

export function HomePage() {
  const { data: posts = [], isLoading, isError, refetch } = useFeed();
  const { address } = useAccount();
  const { run: rank } = useFeedRecommendation();
  const [ordered, setOrdered] = useState<PostRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function applyRanking() {
      if (posts.length === 0) {
        setOrdered([]);
        return;
      }
      const job = await rank({ address: address ?? '', candidatePostIds: posts.map((p) => p.id) });
      if (cancelled) return;
      if (job?.output.rankedPostIds?.length) {
        const byId = new Map(posts.map((p) => [p.id, p]));
        setOrdered(job.output.rankedPostIds.map((id) => byId.get(id)).filter(Boolean) as PostRecord[]);
      } else {
        setOrdered(posts);
      }
    }
    applyRanking();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-ash-200 bg-void-100/90 px-4 py-3 backdrop-blur-xl">
        <h1 className="font-display text-lg text-white">Home</h1>
      </div>
      <PostFeedList
        posts={ordered}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onRefresh={() => refetch()}
      />
    </div>
  );
}

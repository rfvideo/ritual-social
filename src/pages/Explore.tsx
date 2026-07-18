import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFeed } from '@/hooks/usePosts';
import { PostFeedList } from '@/components/post/PostFeedList';
import { TrendingList } from '@/components/explore/TrendingList';
import { SuggestedUsers } from '@/components/explore/SuggestedUsers';
import { resolveIpfsUri } from '@/lib/ipfs';
import { EmptyState } from '@/components/common/States';
import { ImageOff } from 'lucide-react';

export function ExplorePage() {
  const { data: posts = [], isLoading, isError, refetch } = useFeed();

  const trendingPosts = useMemo(
    () => [...posts].sort((a, b) => b.likeCount + b.repostCount - (a.likeCount + a.repostCount)).slice(0, 5),
    [posts],
  );

  const latestImages = useMemo(
    () =>
      posts
        .flatMap((p) => p.images.map((img) => ({ img, postId: p.id })))
        .slice(0, 9),
    [posts],
  );

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-ash-200 bg-void-100/90 px-4 py-3 backdrop-blur-xl">
        <h1 className="font-display text-lg text-white">Explore</h1>
      </div>

      <div className="space-y-6 p-4">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-mist-light">Trending Hashtag</h2>
          <TrendingList posts={posts} limit={6} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-mist-light">Popular &amp; Suggested Creator</h2>
          <SuggestedUsers posts={posts} limit={6} />
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-mist-light">Latest Image</h2>
          {latestImages.length === 0 ? (
            <EmptyState title="Belum ada gambar" icon={<ImageOff size={18} />} />
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {latestImages.map(({ img, postId }, i) => (
                <Link key={i} to={`/post/${postId}`} className="aspect-square overflow-hidden rounded-xl border border-ash-200">
                  <img src={resolveIpfsUri(img)} alt="" loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="border-t border-ash-200">
        <h2 className="px-4 py-3 text-sm font-semibold text-mist-light">Trending Post</h2>
        <PostFeedList posts={trendingPosts} isLoading={isLoading} isError={isError} onRetry={() => refetch()} />
      </div>
    </div>
  );
}

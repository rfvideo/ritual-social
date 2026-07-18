import { useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { PostCard } from './PostCard';
import { SkeletonFeed } from '@/components/common/Skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import type { PostRecord } from '@/types';
import { Inbox } from 'lucide-react';

const PAGE_SIZE = 10;

export function PostFeedList({
  posts,
  isLoading,
  isError,
  onRetry,
  onRefresh,
  emptyTitle = 'No posts yet',
  emptyDescription = 'Be the first to start the conversation on Ritual Social.',
}: {
  posts: PostRecord[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRefresh?: () => Promise<unknown>;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((v) => Math.min(v + PAGE_SIZE, posts.length));
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [posts.length]);

  function handleTouchStart(e: React.TouchEvent) {
    if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    setPulling(delta > 60);
  }
  async function handleTouchEnd() {
    if (pulling && onRefresh) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
    setPulling(false);
    touchStartY.current = null;
  }

  if (isLoading) return <SkeletonFeed />;
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (posts.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={<Inbox size={20} />} />;
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pulling || refreshing) && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-ritual-400">
          <RotateCw size={13} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Release to refresh'}
        </div>
      )}
      {posts.slice(0, visibleCount).map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {visibleCount < posts.length && <div ref={sentinelRef} className="py-2" />}
    </div>
  );
}

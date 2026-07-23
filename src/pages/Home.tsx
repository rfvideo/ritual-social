import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { useFeed } from '@/hooks/usePosts';
import { useFeedRecommendation } from '@/hooks/useAI';
import { useFollowList } from '@/hooks/useFollowList';
import { PostFeedList } from '@/components/post/PostFeedList';
import { TabBar } from '@/components/common/TabBar';
import { EmptyState } from '@/components/common/States';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';
import { Users } from 'lucide-react';
import type { PostRecord } from '@/types';

type HomeTab = 'for-you' | 'following';

const TABS = [
  { key: 'for-you', label: 'For You' },
  { key: 'following', label: 'Following' },
];

export function HomePage() {
  const { data: posts = [], isLoading, isError, refetch } = useFeed();
  const { address, isConnected } = useAccount();
  const { run: rank } = useFeedRecommendation();
  const [ordered, setOrdered] = useState<PostRecord[]>([]);
  const [tab, setTab] = useState<HomeTab>('for-you');

  useEffect(() => {
    setOrdered(posts);
  }, [posts]);

  const { data: followingProfiles = [], isLoading: followingLoading } = useFollowList(address, 'following', tab === 'following');
  const followingAddresses = useMemo(
    () => new Set(followingProfiles.map((p) => p.address.toLowerCase())),
    [followingProfiles],
  );
  const followingPosts = useMemo(
    () => posts.filter((p) => followingAddresses.has(p.author.address.toLowerCase())),
    [posts, followingAddresses],
  );

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
      <div className="sticky top-0 z-10 border-b border-ash-200 bg-void-100/90 backdrop-blur-xl">
        <TabBar tabs={TABS} active={tab} onChange={(key) => setTab(key as HomeTab)} />
      </div>

      {tab === 'for-you' ? (
        <PostFeedList
          posts={ordered}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          onRefresh={() => refetch()}
        />
      ) : !isConnected ? (
        <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <p className="text-sm text-mist-dim">Connect your wallet to see posts from people you follow.</p>
          <ConnectWalletButton />
        </div>
      ) : followingLoading || isLoading ? (
        <PostFeedList posts={[]} isLoading={true} isError={false} onRetry={() => refetch()} />
      ) : followingPosts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="Follow people to see their posts here."
          icon={<Users size={20} />}
        />
      ) : (
        <PostFeedList
          posts={followingPosts}
          isLoading={false}
          isError={isError}
          onRetry={() => refetch()}
          onRefresh={() => refetch()}
        />
      )}
    </div>
  );
}

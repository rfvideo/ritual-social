import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useFeed } from '@/hooks/usePosts';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { PostFeedList } from '@/components/post/PostFeedList';
import { SkeletonProfileHeader } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';

export function ProfilePage() {
  const { address } = useParams<{ address: string }>();
  const { data: profile, isLoading, isError, refetch } = useProfile(address as `0x${string}`);
  const { data: allPosts = [], isLoading: feedLoading, isError: feedError, refetch: refetchFeed } = useFeed();
  const [editOpen, setEditOpen] = useState(false);

  const authorPosts = useMemo(
    () => allPosts.filter((p) => p.author.address.toLowerCase() === address?.toLowerCase()),
    [allPosts, address],
  );

  const totalLikes = useMemo(() => authorPosts.reduce((sum, p) => sum + p.likeCount, 0), [authorPosts]);

  if (isLoading) return <SkeletonProfileHeader />;
  if (isError || !profile) return <ErrorState message="Profile not found." onRetry={() => refetch()} />;

  return (
    <div>
      <ProfileHeader profile={profile} totalLikes={totalLikes} onEdit={() => setEditOpen(true)} onFollowChange={() => refetch()} />

      <div className="border-t border-ash-200">
        <div className="border-b border-ash-200 px-4 py-3 text-sm font-semibold text-mist-light">Posts</div>
        <PostFeedList
          posts={authorPosts}
          isLoading={feedLoading}
          isError={feedError}
          onRetry={() => refetchFeed()}
          emptyTitle="No posts yet"
          emptyDescription={`@${profile.username} hasn't posted anything yet.`}
        />
      </div>

      <EditProfileModal open={editOpen} profile={profile} onClose={() => setEditOpen(false)} />
    </div>
  );
}

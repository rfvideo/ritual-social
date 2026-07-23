import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Image as ImageIcon, MessageCircle, Heart, FileText } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useFeed } from '@/hooks/usePosts';
import { useProfileReplies, useProfileLikes } from '@/hooks/useProfileTabs';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { PostFeedList } from '@/components/post/PostFeedList';
import { TabBar } from '@/components/common/TabBar';
import { SkeletonProfileHeader, SkeletonPost } from '@/components/common/Skeleton';
import { ErrorState, EmptyState } from '@/components/common/States';

type ProfileTab = 'posts' | 'replies' | 'media' | 'likes';

const TABS = [
  { key: 'posts', label: 'Posts' },
  { key: 'replies', label: 'Replies' },
  { key: 'media', label: 'Media' },
  { key: 'likes', label: 'Likes' },
];

export function ProfilePage() {
  const { address } = useParams<{ address: string }>();
  const { data: profile, isLoading, isError, refetch } = useProfile(address as `0x${string}`);
  const { data: allPosts = [], isLoading: feedLoading, isError: feedError, refetch: refetchFeed } = useFeed();
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<ProfileTab>('posts');

  const authorPosts = useMemo(
    () => allPosts.filter((p) => p.author.address.toLowerCase() === address?.toLowerCase()),
    [allPosts, address],
  );

  const mediaPosts = useMemo(() => authorPosts.filter((p) => p.images.length > 0), [authorPosts]);

  const { data: replyPosts = [], isLoading: repliesLoading } = useProfileReplies(address, allPosts);
  const { data: likedPosts = [], isLoading: likesLoading } = useProfileLikes(address, allPosts);

  if (isLoading) return <SkeletonProfileHeader />;
  if (isError || !profile) return <ErrorState message="Profile not found." onRetry={() => refetch()} />;

  const tabContent: Record<ProfileTab, { posts: typeof allPosts; loading: boolean; emptyTitle: string; emptyIcon: React.ReactNode }> = {
    posts: {
      posts: authorPosts,
      loading: feedLoading,
      emptyTitle: 'No posts yet',
      emptyIcon: <FileText size={20} />,
    },
    replies: {
      posts: replyPosts,
      loading: repliesLoading,
      emptyTitle: 'No replies yet',
      emptyIcon: <MessageCircle size={20} />,
    },
    media: {
      posts: mediaPosts,
      loading: feedLoading,
      emptyTitle: 'No media posts yet',
      emptyIcon: <ImageIcon size={20} />,
    },
    likes: {
      posts: likedPosts,
      loading: likesLoading,
      emptyTitle: 'No liked posts yet',
      emptyIcon: <Heart size={20} />,
    },
  };

  const current = tabContent[tab];

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <ProfileHeader profile={profile} onEdit={() => setEditOpen(true)} onFollowChange={() => refetch()} />

      <TabBar tabs={TABS} active={tab} onChange={(key) => setTab(key as ProfileTab)} />

      <div>
        {current.loading ? (
          <>
            <SkeletonPost />
            <SkeletonPost />
          </>
        ) : current.posts.length === 0 ? (
          <EmptyState
            title={current.emptyTitle}
            description={`@${profile.username} has nothing here yet.`}
            icon={current.emptyIcon}
          />
        ) : (
          <PostFeedList posts={current.posts} isLoading={false} isError={feedError} onRetry={() => refetchFeed()} />
        )}
      </div>

      <EditProfileModal open={editOpen} profile={profile} onClose={() => setEditOpen(false)} />
    </div>
  );
}

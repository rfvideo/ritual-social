import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePost } from '@/hooks/usePosts';
import { PostCard } from '@/components/post/PostCard';
import { CommentComposer } from '@/components/post/CommentComposer';
import { CommentList } from '@/components/post/CommentList';
import { SkeletonPost } from '@/components/common/Skeleton';
import { ErrorState } from '@/components/common/States';

export function PostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const { data: post, isLoading, isError, refetch } = usePost(postId);

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-ash-200 bg-void-100/90 px-4 py-3 backdrop-blur-xl">
        <Link to="/" className="rounded-full p-1.5 hover:bg-ash-100">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-display text-lg text-white">Post</h1>
      </div>

      {isLoading && <SkeletonPost />}
      {isError && <ErrorState message="Post not found or failed to load." onRetry={() => refetch()} />}
      {post && <PostCard post={post} />}

      {postId && (
        <>
          <CommentComposer postId={postId} />
          <CommentList postId={postId} />
        </>
      )}
    </div>
  );
}

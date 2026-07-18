import { useState } from 'react';
import { Heart, MessageCircle, Repeat2, Share, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLikePost, useRepost } from '@/hooks/useRitualSocial';
import { useInvalidateFeed } from '@/hooks/usePosts';
import { ConfirmTxDialog } from '@/components/common/ConfirmTxDialog';
import { formatCount, cn } from '@/lib/utils';
import type { PostRecord } from '@/types';

export function PostActions({ post }: { post: PostRecord }) {
  const { likePost, stage: likeStage, reset: resetLike } = useLikePost();
  const { repost, stage: repostStage, reset: resetRepost } = useRepost();
  const invalidateFeed = useInvalidateFeed();
  const [confirming, setConfirming] = useState<'like' | 'repost' | null>(null);

  async function handleConfirm() {
    if (confirming === 'like') {
      const result = await likePost(BigInt(post.id));
      if (result?.status === 'success') invalidateFeed();
    } else if (confirming === 'repost') {
      const result = await repost(BigInt(post.id));
      if (result?.status === 'success') invalidateFeed();
    }
    setTimeout(() => setConfirming(null), 700);
  }

  function handleShare() {
    const url = `${window.location.origin}/post/${post.id}`;
    if (navigator.share) {
      navigator.share({ url, title: 'Ritual Social' }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied');
    }
  }

  const stage = confirming === 'like' ? likeStage : repostStage;

  return (
    <>
      <div className="mt-3 flex max-w-md items-center justify-between text-mist-dim">
        <Link
          to={`/post/${post.id}`}
          className="group flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:text-ritual-300"
        >
          <MessageCircle size={17} className="transition group-hover:scale-110" />
          <span className="text-xs">{formatCount(post.commentCount)}</span>
        </Link>

        <button
          onClick={() => (post.repostedByMe ? toast('You already reposted this') : setConfirming('repost'))}
          className={cn(
            'group flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:text-ritual-300',
            post.repostedByMe && 'text-ritual-400',
          )}
        >
          <Repeat2 size={18} className="transition group-hover:scale-110" />
          <span className="text-xs">{formatCount(post.repostCount)}</span>
        </button>

        <button
          onClick={() => (post.likedByMe ? toast('You already liked this') : setConfirming('like'))}
          className={cn(
            'group flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:text-red-400',
            post.likedByMe && 'text-red-400',
          )}
        >
          <Heart size={17} fill={post.likedByMe ? 'currentColor' : 'none'} className="transition group-hover:scale-110" />
          <span className="text-xs">{formatCount(post.likeCount)}</span>
        </button>

        <div className="flex items-center gap-1.5 px-2 py-1 text-mist-dim/70">
          <Eye size={16} />
          <span className="text-xs">{formatCount(post.viewCount)}</span>
        </div>

        <button onClick={handleShare} className="rounded-full px-2 py-1 transition hover:text-ritual-300">
          <Share size={16} />
        </button>
      </div>

      <ConfirmTxDialog
        open={confirming !== null}
        title={confirming === 'like' ? 'Confirm Like' : 'Confirm Repost'}
        description="This is a real transaction on Ritual Chain and cannot be undone once confirmed."
        stage={stage}
        onConfirm={handleConfirm}
        onClose={() => {
          if (stage !== 'awaiting-wallet' && stage !== 'pending') {
            setConfirming(null);
            resetLike();
            resetRepost();
          }
        }}
      />
    </>
  );
}

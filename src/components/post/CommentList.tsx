import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Sparkles, Loader2, Heart, MessageCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Avatar } from '@/components/common/Avatar';
import { WalletBadge } from '@/components/wallet/WalletBadge';
import { SkeletonPost } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/States';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useComments, useLikeComment, useEditComment, useDeleteComment } from '@/hooks/useComments';
import { useSummarize } from '@/hooks/useAI';
import { uploadCommentContent } from '@/lib/ipfs';
import { formatRelativeTime, cn } from '@/lib/utils';
import type { CommentRecord } from '@/types';

interface CommentNodeProps {
  comment: CommentRecord;
  allComments: CommentRecord[];
  postId: string;
  depth: number;
  onReply: (commentId: string, username: string) => void;
}

function CommentNode({ comment: c, allComments, postId, depth, onReply }: CommentNodeProps) {
  const { address: viewer } = useAccount();
  const isOwner = viewer?.toLowerCase() === c.author.address.toLowerCase();
  const { likeComment, pendingCommentId } = useLikeComment(postId);
  const { editComment, pending: editing } = useEditComment(postId);
  const { deleteComment, pending: deleting } = useDeleteComment(postId);

  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editBody, setEditBody] = useState(c.body);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const replies = allComments.filter((r) => r.parentCommentId === c.id);

  async function handleLike() {
    if (!viewer) {
      toast.error('Connect your wallet to like comments.');
      return;
    }
    if (c.likedByMe) return;
    await likeComment(c.id);
  }

  async function handleSaveEdit() {
    if (!editBody.trim()) return;
    try {
      const contentURI = await uploadCommentContent(editBody.trim());
      const ok = await editComment(c.id, contentURI);
      if (ok) setEditOpen(false);
    } catch {
      toast.error('Failed to upload updated comment');
    }
  }

  async function handleConfirmDelete() {
    const ok = await deleteComment(c.id);
    if (ok) setConfirmDeleteOpen(false);
  }

  return (
    <div className={cn('border-b border-ash-200 px-4 py-4 animate-riseIn', depth > 0 && 'ml-8 border-l border-ash-200 pl-4')}>
      <div className="flex gap-3">
        <Link to={`/profile/${c.author.address}`}>
          <Avatar address={c.author.address} uri={c.author.avatarURI} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link to={`/profile/${c.author.address}`} className="text-sm font-semibold text-mist-light hover:underline">
                {c.author.displayName}
              </Link>
              <WalletBadge address={c.author.address} />
              <span className="text-xs text-mist-dim">
                · {formatRelativeTime(c.createdAt)}
                {c.edited && ' · edited'}
              </span>
            </div>

            {isOwner && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="rounded-full p-1 text-mist-dim hover:bg-ash-100"
                  aria-label="Comment options"
                >
                  <MoreHorizontal size={14} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-ash-200 bg-void-100 py-1 shadow-xl">
                    <button
                      onClick={() => {
                        setEditOpen(true);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-mist-light hover:bg-ash-100"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      onClick={() => {
                        setConfirmDeleteOpen(true);
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 hover:bg-ash-100"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {editOpen ? (
            <div className="mt-1.5">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-xl border border-ash-300 bg-void-200 px-3 py-2 text-sm text-mist-light focus:outline-none"
              />
              <div className="mt-1.5 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditOpen(false);
                    setEditBody(c.body);
                  }}
                  className="ritual-btn-ghost px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editBody.trim() || editing}
                  className="ritual-btn px-3 py-1.5 text-xs"
                >
                  {editing ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 text-sm text-mist-light">{c.body}</p>
          )}

          <div className="mt-1.5 flex items-center gap-4">
            <button
              onClick={handleLike}
              disabled={pendingCommentId === c.id}
              className={cn(
                'flex items-center gap-1 text-xs transition',
                c.likedByMe ? 'text-red-400' : 'text-mist-dim hover:text-red-400',
              )}
            >
              {pendingCommentId === c.id ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Heart size={13} fill={c.likedByMe ? 'currentColor' : 'none'} />
              )}
              {c.likeCount > 0 && c.likeCount}
            </button>
            <button
              onClick={() => onReply(c.id, c.author.username)}
              className="flex items-center gap-1 text-xs text-mist-dim hover:text-ritual-400"
            >
              <MessageCircle size={13} />
              {c.replyCount > 0 ? `${c.replyCount} ${c.replyCount === 1 ? 'reply' : 'replies'}` : 'Reply'}
            </button>
          </div>
        </div>
      </div>

      {replies.map((reply) => (
        <CommentNode key={reply.id} comment={reply} allComments={allComments} postId={postId} depth={depth + 1} onReply={onReply} />
      ))}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete comment?"
        description="This can't be undone. The comment will be hidden permanently, though the transaction stays on-chain."
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}

export function CommentList({ postId, onReply }: { postId: string; onReply: (commentId: string, username: string) => void }) {
  const { data: comments, isLoading, isError } = useComments(postId);
  const { run: summarize, loading: summarizing, result: summary } = useSummarize();

  const topLevel = (comments ?? []).filter((c) => c.parentCommentId === '0');
  const showSummaryCta = (comments?.length ?? 0) >= 6 && !summary;

  return (
    <div>
      {showSummaryCta && (
        <div className="border-b border-ash-200 px-4 py-3">
          <button
            onClick={() => summarize({ threadText: comments!.map((c) => c.body).join(' ') })}
            disabled={summarizing}
            className="flex items-center gap-1.5 text-sm text-ritual-400 hover:text-ritual-300"
          >
            {summarizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Summarize with AI
          </button>
        </div>
      )}

      {summary && (
        <div className="border-b border-ash-200 bg-ritual-900/20 px-4 py-3">
          <p className="text-sm text-mist-light">{summary.output.summary}</p>
        </div>
      )}

      {isLoading && (
        <>
          <SkeletonPost />
          <SkeletonPost />
        </>
      )}

      {isError && <EmptyState title="Failed to load comments" icon={<MessageCircle size={20} />} />}

      {!isLoading && topLevel.length === 0 && (
        <EmptyState title="No comments yet" description="Be the first to reply." icon={<MessageCircle size={20} />} />
      )}

      {topLevel.map((c) => (
        <CommentNode key={c.id} comment={c} allComments={comments ?? []} postId={postId} depth={0} onReply={onReply} />
      ))}
    </div>
  );
                    }

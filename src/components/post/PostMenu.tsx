import { useState, useRef, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { MoreHorizontal, Link2, Share2, Flag, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EditPostDialog } from './EditPostDialog';
import { useDeletePost } from '@/hooks/useRitualSocial';
import { useInvalidateFeed } from '@/hooks/usePosts';
import type { PostRecord } from '@/types';

export function PostMenu({ post }: { post: PostRecord }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { address: viewer } = useAccount();
  const isOwner = viewer?.toLowerCase() === post.author.address.toLowerCase();
  const postUrl = `${window.location.origin}/post/${post.id}`;
  const { deletePost, pending: deleting } = useDeletePost();
  const invalidateFeed = useInvalidateFeed();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function copyLink() {
    navigator.clipboard.writeText(postUrl);
    toast.success('Link copied!');
    setOpen(false);
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ url: postUrl, title: 'Ritual Social' });
      } catch {
        // user cancelled the native share sheet — not an error
      }
    } else {
      copyLink();
    }
    setOpen(false);
  }

  async function report() {
    if (!viewer) {
      toast.error('Connect your wallet to report a post.');
      setOpen(false);
      return;
    }
    try {
      const res = await fetch('/.netlify/functions/report-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, reporter: viewer, reason: 'Reported from post menu' }),
      });
      if (!res.ok) throw new Error();
      toast.success('Report submitted. Thanks for helping keep Ritual Social safe.');
    } catch {
      toast.error('Failed to submit report — try again later.');
    }
    setOpen(false);
  }

  async function handleConfirmDelete() {
    const ok = await deletePost(post.id);
    if (ok) {
      toast.success('Post deleted');
      invalidateFeed();
      setConfirmDeleteOpen(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-full p-1.5 text-mist-dim transition hover:bg-ash-100 hover:text-mist-light"
        aria-label="More options"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-2xl border border-ash-200 bg-void-100 py-1 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {isOwner && (
            <>
              <button
                onClick={() => {
                  setEditOpen(true);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-mist-light hover:bg-ash-100"
              >
                <Pencil size={15} /> Edit Post
              </button>
              <button
                onClick={() => {
                  setConfirmDeleteOpen(true);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-ash-100"
              >
                <Trash2 size={15} /> Delete Post
              </button>
              <div className="my-1 border-t border-ash-200" />
            </>
          )}
          <button
            onClick={copyLink}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-mist-light hover:bg-ash-100"
          >
            <Link2 size={15} /> Copy Link
          </button>
          <button
            onClick={share}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-mist-light hover:bg-ash-100"
          >
            <Share2 size={15} /> Share
          </button>
          {!isOwner && (
            <button
              onClick={report}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-ash-100"
            >
              <Flag size={15} /> Report
            </button>
          )}
        </div>
      )}

      <EditPostDialog post={post} open={editOpen} onClose={() => setEditOpen(false)} />

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete this post?"
        description="This can't be undone. The post will disappear from feeds, though the transaction history stays on-chain permanently."
        confirmLabel="Delete"
        destructive
        pending={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}

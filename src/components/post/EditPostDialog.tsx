import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEditPost } from '@/hooks/useRitualSocial';
import { useInvalidateFeed } from '@/hooks/usePosts';
import { uploadPostContent } from '@/lib/ipfs';
import { extractHashtags, extractMentions } from '@/lib/utils';
import type { PostRecord } from '@/types';

interface EditPostDialogProps {
  post: PostRecord;
  open: boolean;
  onClose: () => void;
}

export function EditPostDialog({ post, open, onClose }: EditPostDialogProps) {
  const [caption, setCaption] = useState(post.caption);
  const [saving, setSaving] = useState(false);
  const { editPost, pending } = useEditPost();
  const invalidateFeed = useInvalidateFeed();

  async function handleSave() {
    if (!caption.trim()) {
      toast.error('Post text cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const contentURI = await uploadPostContent({
        caption: caption.trim(),
        images: [],
        existingImageURIs: post.images,
        hashtags: extractHashtags(caption),
        mentions: extractMentions(caption),
      });
      const ok = await editPost(post.id, contentURI);
      if (ok) {
        toast.success('Post updated');
        invalidateFeed();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update post');
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || pending;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!busy ? onClose : undefined}
        >
          <motion.div
            className="glass-panel w-full max-w-lg rounded-t-3xl p-5 sm:rounded-3xl"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-mist-light">Edit Post</h2>
              <button onClick={onClose} disabled={busy} className="rounded-full p-1.5 text-mist-dim hover:bg-ash-100">
                <X size={18} />
              </button>
            </div>

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-2xl border border-ash-300 bg-void-200 p-3 text-[15px] text-mist-light focus:outline-none"
            />
            {post.images.length > 0 && (
              <p className="mt-2 text-xs text-mist-dim">
                {post.images.length} image{post.images.length > 1 ? 's' : ''} attached — editing text only.
              </p>
            )}

            <button onClick={handleSave} disabled={busy} className="ritual-btn mt-4 w-full">
              {busy ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

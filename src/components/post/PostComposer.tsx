import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import { Avatar } from '@/components/common/Avatar';
import { ImageUploader } from './ImageUploader';
import { ModerationWarningDialog } from '@/components/ai/ModerationWarningDialog';
import { ConfirmTxDialog } from '@/components/common/ConfirmTxDialog';
import { useAICaption, useModeration } from '@/hooks/useAI';
import { useCreatePost } from '@/hooks/useRitualSocial';
import { useInvalidateFeed } from '@/hooks/usePosts';
import { uploadImagesOnly, uploadPostContent } from '@/lib/ipfs';
import { extractHashtags, extractMentions } from '@/lib/utils';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';
import type { ModerationOutput } from '@/types';

const MAX_CHARS = 400;

export function PostComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address, isConnected } = useAccount();
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [uploadedImageURIs, setUploadedImageURIs] = useState<string[]>([]);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [moderationResult, setModerationResult] = useState<ModerationOutput | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingContentURI, setPendingContentURI] = useState<string | null>(null);

  const { run: runCaption, loading: captionLoading } = useAICaption();
  const { run: runModeration, loading: moderationLoading } = useModeration();
  const { createPost, stage, reset } = useCreatePost();
  const invalidateFeed = useInvalidateFeed();

  // Pin images to IPFS as soon as they're selected — this gives the AI
  // caption container a real, fetchable URL to actually look at, instead of
  // a local filename it could never analyze.
  useEffect(() => {
    let cancelled = false;
    async function pinImages() {
      if (images.length === 0) {
        setUploadedImageURIs([]);
        return;
      }
      setImagesUploading(true);
      try {
        const uris = await uploadImagesOnly(images);
        if (!cancelled) setUploadedImageURIs(uris);
      } catch (err: any) {
        if (!cancelled) toast.error(err.message ?? 'Failed to upload image(s) to IPFS');
      } finally {
        if (!cancelled) setImagesUploading(false);
      }
    }
    pinImages();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  function handleClose() {
    if (uploading || stage === 'awaiting-wallet' || stage === 'pending') return;
    setCaption('');
    setImages([]);
    setUploadedImageURIs([]);
    setModerationResult(null);
    setConfirmOpen(false);
    setPendingContentURI(null);
    reset();
    onClose();
  }

  async function handleSuggestCaption() {
    if (images.length === 0) {
      toast.error('Add a photo first so AI can write a caption for it.');
      return;
    }
    if (imagesUploading || uploadedImageURIs.length === 0) {
      toast.error('Still uploading your image(s) — try again in a moment.');
      return;
    }
    const job = await runCaption({ imageURIs: uploadedImageURIs });
    if (job?.output.caption) {
      setCaption((prev) => (prev.trim() ? prev : job.output.caption));
    } else if (job) {
      toast.error('AI captioning isn\u2019t connected yet — see infernet-containers/README.md to enable it.');
    }
  }

  async function proceedToPublish() {
    if (!caption.trim() && images.length === 0) {
      toast.error('Write something or add a photo first.');
      return;
    }
    if (images.length > 0 && imagesUploading) {
      toast.error('Still uploading your image(s) — try again in a moment.');
      return;
    }
    const modJob = await runModeration({ text: caption });
    if (modJob?.output.flagged) {
      setModerationResult(modJob.output);
      return;
    }
    await doUploadAndOpenConfirm();
  }

  async function doUploadAndOpenConfirm() {
    setUploading(true);
    try {
      const contentURI = await uploadPostContent({
        caption,
        images,
        existingImageURIs: uploadedImageURIs.length ? uploadedImageURIs : undefined,
        hashtags: extractHashtags(caption),
        mentions: extractMentions(caption),
      });
      setPendingContentURI(contentURI);
      setConfirmOpen(true);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to upload to decentralized storage');
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmPublish() {
    if (!pendingContentURI) return;
    const result = await createPost(pendingContentURI);
    if (result?.status === 'success') {
      invalidateFeed();
      setTimeout(handleClose, 900);
    }
  }

  const overLimit = caption.length > MAX_CHARS;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="glass-panel w-full max-w-lg rounded-t-3xl p-5 sm:rounded-3xl"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-white">Create Post</h2>
              <button onClick={handleClose} className="rounded-full p-1.5 text-mist-dim hover:bg-ash-100">
                <X size={18} />
              </button>
            </div>

            {!isConnected ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-mist-dim">Connect your wallet to start posting on Ritual Chain.</p>
                <ConnectWalletButton />
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <Avatar address={address!} size="md" />
                  <div className="flex-1">
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="What's happening in the Ritual ecosystem?"
                      rows={4}
                      className="w-full resize-none bg-transparent text-[15px] text-mist-light placeholder:text-mist-dim focus:outline-none"
                    />
                    <ImageUploader files={images} onChange={setImages} />
                    {imagesUploading && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-mist-dim">
                        <Loader2 size={11} className="animate-spin" /> Uploading image(s) to IPFS…
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-ash-200 pt-3">
                  <button
                    onClick={handleSuggestCaption}
                    disabled={captionLoading || images.length === 0 || imagesUploading}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ritual-400 transition hover:bg-ritual-900/40 disabled:opacity-40"
                  >
                    {captionLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Generate Caption with AI
                  </button>
                  <span className={`text-xs font-mono ${overLimit ? 'text-red-400' : 'text-mist-dim'}`}>
                    {caption.length}/{MAX_CHARS}
                  </span>
                </div>

                <button
                  onClick={proceedToPublish}
                  disabled={overLimit || uploading || moderationLoading}
                  className="ritual-btn mt-4 w-full"
                >
                  {uploading || moderationLoading ? <Loader2 size={16} className="animate-spin" /> : 'Publish to Ritual Chain'}
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}

      {moderationResult && (
        <ModerationWarningDialog
          result={moderationResult}
          onCancel={() => setModerationResult(null)}
          onPublishAnyway={async () => {
            setModerationResult(null);
            await doUploadAndOpenConfirm();
          }}
        />
      )}

      <ConfirmTxDialog
        open={confirmOpen}
        title="Confirm Publish"
        description="This post will be sent as a real transaction on Ritual Chain."
        stage={stage}
        onConfirm={handleConfirmPublish}
        onClose={() => {
          if (stage !== 'awaiting-wallet' && stage !== 'pending') setConfirmOpen(false);
        }}
      />
    </AnimatePresence>
  );
}

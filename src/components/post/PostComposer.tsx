import { useEffect, useState, type ClipboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import { Avatar } from '@/components/common/Avatar';
import { ImageUploader } from './ImageUploader';
import { ModerationWarningDialog } from '@/components/ai/ModerationWarningDialog';
import { PublishFlowDialog, type IpfsStatus } from './PublishFlowDialog';
import { useModeration } from '@/hooks/useAI';
import { useCreatePost } from '@/hooks/useRitualSocial';
import { useInvalidateFeed } from '@/hooks/usePosts';
import { useProfile } from '@/hooks/useProfile';
import { uploadImagesOnly, uploadPostContent } from '@/lib/ipfs';
import { extractHashtags, extractMentions } from '@/lib/utils';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';
import type { ModerationOutput } from '@/types';

const MAX_CHARS = 400;

export function PostComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isConnected } = useAccount();
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [uploadedImageURIs, setUploadedImageURIs] = useState<string[]>([]);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [moderationResult, setModerationResult] = useState<ModerationOutput | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingContentURI, setPendingContentURI] = useState<string | null>(null);
  const [ipfsStatus, setIpfsStatus] = useState<IpfsStatus>('uploading');

  const { run: runModeration, loading: moderationLoading } = useModeration();
  const { createPost, stage, reset } = useCreatePost();
  const invalidateFeed = useInvalidateFeed();
  const { address } = useAccount();
  const { data: myProfile } = useProfile(address);

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
    setIpfsStatus('uploading');
    reset();
    onClose();
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
    setConfirmOpen(true);
    setIpfsStatus('uploading');
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
      setIpfsStatus('done');
    } catch (err: any) {
      setIpfsStatus('error');
      toast.error(err.message ?? 'Failed to upload to decentralized storage');
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmPublish() {
    if (!pendingContentURI) return;
    const result = await createPost(pendingContentURI);
    if (result?.status === 'success') {
      toast.success('Post published! 🎉');
      invalidateFeed();
      setTimeout(handleClose, 1200);
    } else {
      toast.error('Failed to publish. Please try again.');
    }
  }

  const overLimit = caption.length > MAX_CHARS;
  const nearLimit = caption.length > MAX_CHARS * 0.9 && !overLimit;
  const canPublish = (caption.trim().length > 0 || images.length > 0) && !overLimit;

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
              <h2 className="font-display text-lg text-mist-light">Create Post</h2>
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
                  <Avatar address={address!} uri={myProfile?.avatarURI} size="md" />
                  <div className="flex-1">
                    {myProfile && (
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-mist-light">{myProfile.displayName}</span>
                        <span className="text-xs text-mist-dim">@{myProfile.username}</span>
                      </div>
                    )}
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      onPaste={(e: ClipboardEvent<HTMLTextAreaElement>) => {
                        const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith('image/'));
                        if (item && images.length < 4) {
                          const file = item.getAsFile();
                          if (file) setImages([...images, file]);
                        }
                      }}
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

                <div className="mt-3 flex items-center justify-end border-t border-ash-200 pt-3">
                  <span
                    className={`text-xs font-mono ${overLimit ? 'text-red-400' : nearLimit ? 'text-yellow-400' : 'text-mist-dim'}`}
                  >
                    {caption.length}/{MAX_CHARS}
                  </span>
                </div>

                <button
                  onClick={proceedToPublish}
                  disabled={!canPublish || uploading || moderationLoading}
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

      <PublishFlowDialog
        open={confirmOpen}
        ipfsStatus={ipfsStatus}
        txStage={stage}
        onConfirm={handleConfirmPublish}
        onClose={() => {
          if (stage !== 'awaiting-wallet' && stage !== 'pending') {
            setConfirmOpen(false);
            setPendingContentURI(null);
            setIpfsStatus('uploading');
            reset();
          }
        }}
      />
    </AnimatePresence>
  );
                    }

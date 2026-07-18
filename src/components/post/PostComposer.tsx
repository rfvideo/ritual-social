import { useState } from 'react';
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
import { uploadPostContent } from '@/lib/ipfs';
import { extractHashtags, extractMentions } from '@/lib/utils';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';
import type { ModerationOutput } from '@/types';

const MAX_CHARS = 400;

export function PostComposer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address, isConnected } = useAccount();
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [moderationResult, setModerationResult] = useState<ModerationOutput | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingContentURI, setPendingContentURI] = useState<string | null>(null);

  const { run: runCaption, loading: captionLoading } = useAICaption();
  const { run: runModeration, loading: moderationLoading } = useModeration();
  const { createPost, stage, reset } = useCreatePost();
  const invalidateFeed = useInvalidateFeed();

  function handleClose() {
    if (uploading || stage === 'awaiting-wallet' || stage === 'pending') return;
    setCaption('');
    setImages([]);
    setModerationResult(null);
    setConfirmOpen(false);
    setPendingContentURI(null);
    reset();
    onClose();
  }

  async function handleSuggestCaption() {
    if (images.length === 0) {
      toast.error('Unggah foto dulu supaya AI bisa membuat caption.');
      return;
    }
    // In production the images would already be pinned; for a snappy UX we
    // pass placeholder refs here and let the container inspect bytes via a
    // signed upload URL. Swap for real CIDs once your container expects them.
    const job = await runCaption({ imageURIs: images.map((f) => f.name) });
    if (job) {
      setCaption((prev) => (prev.trim() ? prev : job.output.caption));
    }
  }

  async function proceedToPublish() {
    if (!caption.trim() && images.length === 0) {
      toast.error('Tulis sesuatu atau unggah foto terlebih dahulu.');
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
        hashtags: extractHashtags(caption),
        mentions: extractMentions(caption),
      });
      setPendingContentURI(contentURI);
      setConfirmOpen(true);
    } catch (err: any) {
      toast.error(err.message ?? 'Gagal mengunggah ke penyimpanan terdesentralisasi');
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
              <h2 className="font-display text-lg text-white">Buat Postingan</h2>
              <button onClick={handleClose} className="rounded-full p-1.5 text-mist-dim hover:bg-ash-100">
                <X size={18} />
              </button>
            </div>

            {!isConnected ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-mist-dim">Connect wallet untuk mulai memposting di Ritual Chain.</p>
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
                      placeholder="Apa yang sedang terjadi di ekosistem Ritual?"
                      rows={4}
                      className="w-full resize-none bg-transparent text-[15px] text-mist-light placeholder:text-mist-dim focus:outline-none"
                    />
                    <ImageUploader files={images} onChange={setImages} />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-ash-200 pt-3">
                  <button
                    onClick={handleSuggestCaption}
                    disabled={captionLoading || images.length === 0}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ritual-400 transition hover:bg-ritual-900/40 disabled:opacity-40"
                  >
                    {captionLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Buat Caption dengan AI
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
                  {uploading || moderationLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Publish ke Ritual Chain'
                  )}
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
        title="Konfirmasi Publish"
        description="Postingan akan dikirim sebagai transaksi nyata ke Ritual Chain."
        stage={stage}
        onConfirm={handleConfirmPublish}
        onClose={() => {
          if (stage !== 'awaiting-wallet' && stage !== 'pending') setConfirmOpen(false);
        }}
      />
    </AnimatePresence>
  );
}

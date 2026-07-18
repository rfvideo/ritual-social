import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import { Avatar } from '@/components/common/Avatar';
import { ConfirmTxDialog } from '@/components/common/ConfirmTxDialog';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';
import { usePostComment } from '@/hooks/useComments';
import { uploadCommentContent } from '@/lib/ipfs';

export function CommentComposer({ postId }: { postId: string }) {
  const { address, isConnected } = useAccount();
  const [body, setBody] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingURI, setPendingURI] = useState<string | null>(null);
  const { submit, stage, reset } = usePostComment(postId);

  async function handleSend() {
    if (!body.trim()) return;
    setUploading(true);
    try {
      const contentURI = await uploadCommentContent(body.trim());
      setPendingURI(contentURI);
      setConfirmOpen(true);
    } catch (err: any) {
      toast.error(err.message ?? 'Gagal mengunggah komentar');
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    if (!pendingURI) return;
    const result = await submit(pendingURI);
    if (result?.status === 'success') {
      setBody('');
      setTimeout(() => setConfirmOpen(false), 700);
    }
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-ash-200 px-4 py-4">
        <p className="text-sm text-mist-dim">Connect wallet untuk berkomentar.</p>
        <ConnectWalletButton />
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-3 border-b border-ash-200 px-4 py-4">
        <Avatar address={address!} size="md" />
        <div className="flex-1">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tulis balasan…"
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-mist-light placeholder:text-mist-dim focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button onClick={handleSend} disabled={!body.trim() || uploading} className="ritual-btn px-4 py-2 text-xs">
              {uploading ? <Loader2 size={13} className="animate-spin" /> : 'Balas'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmTxDialog
        open={confirmOpen}
        title="Konfirmasi Komentar"
        description="Komentar akan tampil setelah transaksi berhasil dikonfirmasi di Ritual Chain."
        stage={stage}
        onConfirm={handleConfirm}
        onClose={() => {
          if (stage !== 'awaiting-wallet' && stage !== 'pending') {
            setConfirmOpen(false);
            reset();
          }
        }}
      />
    </>
  );
}

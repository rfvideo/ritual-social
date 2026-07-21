import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { useAccount } from 'wagmi';
import toast from 'react-hot-toast';
import { Avatar } from '@/components/common/Avatar';
import { ConfirmTxDialog } from '@/components/common/ConfirmTxDialog';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';
import { usePostComment } from '@/hooks/useComments';
import { uploadCommentContent } from '@/lib/ipfs';

interface CommentComposerProps {
  postId: string;
  replyTo?: { commentId: string; username: string } | null;
  onCancelReply?: () => void;
}

export function CommentComposer({ postId, replyTo, onCancelReply }: CommentComposerProps) {
  const { address, isConnected } = useAccount();
  const [body, setBody] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingURI, setPendingURI] = useState<string | null>(null);
  const { submit, stage, reset } = usePostComment(postId);

  useEffect(() => {
    if (replyTo) setBody('');
  }, [replyTo]);

  async function handleSend() {
    if (!body.trim()) return;
    setUploading(true);
    try {
      const contentURI = await uploadCommentContent(body.trim());
      setPendingURI(contentURI);
      setConfirmOpen(true);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to upload comment');
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    if (!pendingURI) return;
    const result = await submit(pendingURI, replyTo?.commentId ?? 0);
    if (result?.status === 'success') {
      setBody('');
      onCancelReply?.();
      setTimeout(() => setConfirmOpen(false), 700);
    }
  }

  if (!isConnected) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-ash-200 px-4 py-4">
        <p className="text-sm text-mist-dim">Connect your wallet to comment.</p>
        <ConnectWalletButton />
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-ash-200 px-4 py-4">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between rounded-xl bg-ash-100/60 px-3 py-1.5 text-xs text-mist-dim">
            <span>
              Replying to <span className="text-ritual-400">@{replyTo.username}</span>
            </span>
            <button onClick={onCancelReply} className="rounded-full p-1 hover:bg-ash-200" aria-label="Cancel reply">
              <X size={13} />
            </button>
          </div>
        )}
        <div className="flex gap-3">
          <Avatar address={address!} size="md" />
          <div className="flex-1">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={replyTo ? `Reply to @${replyTo.username}…` : 'Write a reply…'}
              rows={2}
              className="w-full resize-none bg-transparent text-sm text-mist-light placeholder:text-mist-dim focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <button onClick={handleSend} disabled={!body.trim() || uploading} className="ritual-btn px-4 py-2 text-xs">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : 'Reply'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmTxDialog
        open={confirmOpen}
        title="Confirm Comment"
        description="Your comment will appear once the transaction is confirmed on Ritual Chain."
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

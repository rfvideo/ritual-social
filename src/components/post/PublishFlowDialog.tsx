import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Check, Circle } from 'lucide-react';
import { ACTION_FEE_ETH } from '@/config/constants';
import type { TxStage } from '@/hooks/useRitualSocial';

export type IpfsStatus = 'uploading' | 'done' | 'error';

interface PublishFlowDialogProps {
  open: boolean;
  ipfsStatus: IpfsStatus;
  txStage: TxStage;
  onConfirm: () => void;
  onClose: () => void;
}

type StepState = 'done' | 'active' | 'pending' | 'error';

function Step({ label, state }: { label: string; state: StepState }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          state === 'done'
            ? 'bg-ritual-500 text-void'
            : state === 'active'
              ? 'bg-ritual-900/60 text-ritual-400'
              : state === 'error'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-ash-200 text-mist-dim'
        }`}
      >
        {state === 'done' ? (
          <Check size={13} />
        ) : state === 'active' ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Circle size={8} fill="currentColor" />
        )}
      </div>
      <span className={`text-sm ${state === 'pending' ? 'text-mist-dim' : 'text-mist-light'}`}>{label}</span>
    </div>
  );
}

export function PublishFlowDialog({ open, ipfsStatus, txStage, onConfirm, onClose }: PublishFlowDialogProps) {
  const ipfsDone = ipfsStatus === 'done';
  const awaitingWallet = txStage === 'awaiting-wallet';
  const pending = txStage === 'pending';
  const confirmed = txStage === 'confirmed';
  const failed = txStage === 'failed' || ipfsStatus === 'error';

  const readyToSign = ipfsDone && txStage === 'idle';
  const isBusy = ipfsStatus === 'uploading' || awaitingWallet || pending;

  function stepState(step: 'ipfs' | 'wallet' | 'chain' | 'published'): StepState {
    if (step === 'ipfs') {
      if (ipfsStatus === 'error') return 'error';
      return ipfsDone ? 'done' : 'active';
    }
    if (!ipfsDone) return 'pending';
    if (step === 'wallet') {
      if (failed) return 'error';
      if (awaitingWallet) return 'active';
      return pending || confirmed ? 'done' : readyToSign ? 'active' : 'pending';
    }
    if (step === 'chain') {
      if (pending) return 'active';
      return confirmed ? 'done' : 'pending';
    }
    return confirmed ? 'done' : 'pending';
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isBusy ? onClose : undefined}
        >
          <motion.div
            className="glass-panel w-full max-w-sm rounded-t-3xl p-6 sm:rounded-3xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg text-mist-light">Publishing your post</h3>

            <div className="mt-5 space-y-4">
              <Step label="Uploading to IPFS" state={stepState('ipfs')} />
              <Step label="Submitting transaction" state={stepState('wallet')} />
              <Step label="Confirming on Ritual Chain" state={stepState('chain')} />
              <Step label="Post published" state={stepState('published')} />
            </div>

            {readyToSign && (
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-ash-200 bg-void-200 px-4 py-3">
                <span className="text-sm text-mist">Transaction fee</span>
                <span className="font-mono text-sm font-semibold text-ritual-300">{ACTION_FEE_ETH} RITUAL</span>
              </div>
            )}

            {failed && <p className="mt-4 text-sm text-red-400">Something went wrong. You can close this and try again.</p>}

            <div className="mt-5 flex gap-3">
              <button className="ritual-btn-ghost flex-1" onClick={onClose} disabled={isBusy}>
                {confirmed ? 'Close' : 'Cancel'}
              </button>
              {readyToSign && (
                <button className="ritual-btn flex-1" onClick={onConfirm}>
                  Confirm & Publish
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

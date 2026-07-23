import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, ShieldCheck, Zap } from 'lucide-react';
import { ACTION_FEE_ETH } from '@/config/constants';
import type { TxStage } from '@/hooks/useRitualSocial';

interface ConfirmTxDialogProps {
  open: boolean;
  title: string;
  description: string;
  stage: TxStage;
  onConfirm: () => void;
  onClose: () => void;
}

const STAGE_LABEL: Record<TxStage, string> = {
  idle: '',
  'awaiting-wallet': 'Waiting for wallet confirmation…',
  pending: 'Transaction sent, waiting for block…',
  confirmed: 'Confirmed on-chain',
  failed: 'Transaction failed',
};

export function ConfirmTxDialog({ open, title, description, stage, onConfirm, onClose }: ConfirmTxDialogProps) {
  const isBusy = stage === 'awaiting-wallet' || stage === 'pending';

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
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-ritual-500/10 text-ritual-400">
              <Zap size={20} />
            </div>
            <h3 className="font-display text-lg text-mist-light">{title}</h3>
            <p className="mt-1 text-sm text-mist-dim">{description}</p>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-ash-200 bg-void-200 px-4 py-3">
              <span className="text-sm text-mist">Transaction fee</span>
              <span className="font-mono text-sm font-semibold text-ritual-300">{ACTION_FEE_ETH} RITUAL</span>
            </div>

            {stage !== 'idle' && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-ash-100 px-4 py-3 text-sm text-mist">
                {isBusy && <Loader2 size={15} className="animate-spin text-ritual-400" />}
                {stage === 'confirmed' && <ShieldCheck size={15} className="text-ritual-400" />}
                {STAGE_LABEL[stage]}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button className="ritual-btn-ghost flex-1" onClick={onClose} disabled={isBusy}>
                Cancel
              </button>
              <button className="ritual-btn flex-1" onClick={onConfirm} disabled={isBusy || stage === 'confirmed'}>
                {isBusy ? <Loader2 size={15} className="animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

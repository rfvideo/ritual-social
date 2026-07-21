import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!pending ? onCancel : undefined}
        >
          <motion.div
            className="glass-panel w-full max-w-sm rounded-t-3xl p-6 sm:rounded-3xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${
                destructive ? 'bg-red-500/10 text-red-400' : 'bg-ritual-500/10 text-ritual-400'
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <h3 className="font-display text-lg text-white">{title}</h3>
            <p className="mt-1 text-sm text-mist-dim">{description}</p>

            <div className="mt-5 flex gap-3">
              <button className="ritual-btn-ghost flex-1" onClick={onCancel} disabled={pending}>
                Cancel
              </button>
              <button
                className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  destructive ? 'bg-red-500 text-white hover:bg-red-600' : 'ritual-btn'
                }`}
                onClick={onConfirm}
                disabled={pending}
              >
                {pending ? <Loader2 size={15} className="mx-auto animate-spin" /> : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

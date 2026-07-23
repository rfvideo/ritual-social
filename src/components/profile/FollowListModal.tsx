import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X, Users } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { WalletBadge } from '@/components/wallet/WalletBadge';
import { EmptyState } from '@/components/common/States';
import { useFollowList } from '@/hooks/useFollowList';

interface FollowListModalProps {
  address: `0x${string}` | undefined;
  type: 'following' | 'followers';
  open: boolean;
  onClose: () => void;
}

export function FollowListModal({ address, type, open, onClose }: FollowListModalProps) {
  const { data: users, isLoading } = useFollowList(address, type, open);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-panel flex max-h-[75vh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ash-200 px-5 py-4">
              <h3 className="font-display text-lg text-mist-light">{type === 'following' ? 'Following' : 'Followers'}</h3>
              <button onClick={onClose} className="rounded-full p-1.5 text-mist-dim hover:bg-ash-100">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={22} className="animate-spin text-ritual-400" />
                </div>
              ) : users && users.length > 0 ? (
                users.map((u) => (
                  <Link
                    key={u.address}
                    to={`/profile/${u.address}`}
                    onClick={onClose}
                    className="flex items-center gap-3 border-b border-ash-200 px-5 py-3 last:border-0 hover:bg-ash-100/40"
                  >
                    <Avatar address={u.address} uri={u.avatarURI} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold text-mist-light">{u.displayName}</span>
                        <WalletBadge address={u.address} />
                      </div>
                      <p className="truncate text-sm text-mist-dim">@{u.username}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title={type === 'following' ? 'Not following anyone yet' : 'No followers yet'}
                  icon={<Users size={20} />}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

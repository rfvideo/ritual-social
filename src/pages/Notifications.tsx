import { useAccount } from 'wagmi';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { SkeletonFeed } from '@/components/common/Skeleton';
import { EmptyState, ErrorState } from '@/components/common/States';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';
import { Bell } from 'lucide-react';

export function NotificationsPage() {
  const { isConnected } = useAccount();
  const { data: notifications, isLoading, isError, refetch } = useNotifications();

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-ash-200 bg-void-100/90 px-4 py-3 backdrop-blur-xl">
        <h1 className="font-display text-lg text-white">Notifications</h1>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-mist-dim">Connect your wallet to see notifications.</p>
          <ConnectWalletButton />
        </div>
      ) : isLoading ? (
        <SkeletonFeed count={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : notifications && notifications.length > 0 ? (
        notifications.map((n) => <NotificationItem key={n.id} notification={n} />)
      ) : (
        <EmptyState title="No notifications yet" description="Activity like likes, comments, and follows will show up here." icon={<Bell size={20} />} />
      )}
    </div>
  );
}

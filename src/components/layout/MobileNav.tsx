import { NavLink } from 'react-router-dom';
import { Home, Compass, Bell, User, Plus } from 'lucide-react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { cn } from '@/lib/utils';
import { useAccount } from 'wagmi';
import { useNotifications } from '@/hooks/useNotifications';

const NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/notifications', label: 'Alerts', icon: Bell, hasBadge: true },
];

const itemClass = 'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium';

export function MobileNav({ onPublish }: { onPublish: () => void }) {
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { data: notifications } = useNotifications();
  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-ash-200 bg-void-100/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl lg:hidden">
      {NAV.map(({ to, label, icon: Icon, hasBadge }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => cn(itemClass, isActive ? 'text-ritual-400' : 'text-mist-dim')}
        >
          <span className="relative">
            <Icon size={21} />
            {hasBadge && unreadCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </span>
          {label}
        </NavLink>
      ))}

      <button
        onClick={onPublish}
        className="relative -mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ritual-gradient shadow-glow"
        aria-label="Publish"
      >
        <Plus size={24} className="text-void" />
      </button>

      {address ? (
        <NavLink
          to={`/profile/${address}`}
          className={({ isActive }) => cn(itemClass, isActive ? 'text-ritual-400' : 'text-mist-dim')}
        >
          <User size={21} />
          Profile
        </NavLink>
      ) : (
        <button onClick={openConnectModal} className={cn(itemClass, 'text-mist-dim')}>
          <User size={21} />
          Profile
        </button>
      )}
    </nav>
  );
}

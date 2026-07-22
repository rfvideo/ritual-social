import { NavLink } from 'react-router-dom';
import { Home, Compass, Search, Bell, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';
import { useAccount } from 'wagmi';
import { useNotifications } from '@/hooks/useNotifications';

const NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/notifications', label: 'Notifications', icon: Bell, hasBadge: true },
];

export function Sidebar({ onPublish }: { onPublish: () => void }) {
  const { address } = useAccount();
  const { data: notifications } = useNotifications();
  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-ash-200 px-3 py-5 lg:flex xl:w-72">
      <div>
        <div className="mb-6 flex items-center gap-2 px-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ritual-gradient shadow-glow-sm">
            <Sparkles size={18} className="text-void" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-lg tracking-tight text-white">Ritual Social</span>
            <a
              href="https://x.com/raupee_"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-mist-dim hover:text-ritual-400"
            >
              by Raupee
            </a>
          </div>
        </div>

        <nav className="space-y-1">
          {NAV.map(({ to, label, icon: Icon, hasBadge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-medium transition-colors',
                  isActive
                    ? 'bg-ash-100 text-ritual-300 shadow-glow-sm'
                    : 'text-mist hover:bg-ash-100/60 hover:text-white',
                )
              }
            >
              <span className="relative">
                <Icon size={20} />
                {hasBadge && unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              {label}
            </NavLink>
          ))}
          {address && (
            <NavLink
              to={`/profile/${address}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-medium transition-colors',
                  isActive
                    ? 'bg-ash-100 text-ritual-300 shadow-glow-sm'
                    : 'text-mist hover:bg-ash-100/60 hover:text-white',
                )
              }
            >
              <User size={20} />
              Profile
            </NavLink>
          )}
        </nav>

        <button onClick={onPublish} className="ritual-btn mt-5 w-full">
          Publish
        </button>
      </div>

      <ConnectWalletButton full />
    </aside>
  );
}

import { NavLink } from 'react-router-dom';
import { Home, Compass, Search, Bell, User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';
import { useAccount } from 'wagmi';

const NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/notifications', label: 'Notifications', icon: Bell },
];

export function Sidebar({ onPublish }: { onPublish: () => void }) {
  const { address } = useAccount();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-ash-200 px-3 py-5 lg:flex xl:w-72">
      <div>
        <div className="mb-6 flex items-center gap-2 px-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ritual-gradient shadow-glow-sm">
            <Sparkles size={18} className="text-void" />
          </div>
          <span className="font-display text-lg tracking-tight text-white">Ritual Social</span>
        </div>

        <nav className="space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
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
              <Icon size={20} />
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

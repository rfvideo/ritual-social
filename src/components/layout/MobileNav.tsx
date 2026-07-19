import { NavLink } from 'react-router-dom';
import { Home, Compass, Bell, User, Plus } from 'lucide-react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { cn } from '@/lib/utils';
import { useAccount } from 'wagmi';

const NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/notifications', label: 'Alerts', icon: Bell },
];

const itemClass = 'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium';

export function MobileNav({ onPublish }: { onPublish: () => void }) {
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-ash-200 bg-void-100/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl lg:hidden">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => cn(itemClass, isActive ? 'text-ritual-400' : 'text-mist-dim')}
        >
          <Icon size={21} />
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

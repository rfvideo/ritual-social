import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ash-200 bg-void-100/90 px-4 py-3 backdrop-blur-xl lg:hidden">
      <Link to="/" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ritual-gradient">
          <Sparkles size={16} className="text-void" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-base text-white">Ritual Social</span>
          <a
            href="https://x.com/raupee_"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-mist-dim hover:text-ritual-400"
          >
            by Raupee
          </a>
        </div>
      </Link>
      <ConnectWalletButton />
    </header>
  );
}

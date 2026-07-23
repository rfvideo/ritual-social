import { Link } from 'react-router-dom';
import { ConnectWalletButton } from '@/components/wallet/ConnectWalletButton';
import { RitualLogoMark } from '@/components/common/RitualLogoMark';

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ash-200 bg-void-100/90 px-4 py-2.5 backdrop-blur-xl lg:hidden">
      <Link to="/" className="flex flex-col items-center gap-0.5">
        <RitualLogoMark size={34} />
        <a
          href="https://x.com/raupee_"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] leading-none text-mist-dim hover:text-ritual-400"
        >
          by Raupee
        </a>
      </Link>
      <ConnectWalletButton />
    </header>
  );
}

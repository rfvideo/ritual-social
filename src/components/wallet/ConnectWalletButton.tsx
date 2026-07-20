import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, ChevronDown, AlertTriangle } from 'lucide-react';
import { truncateAddress } from '@/lib/utils';

export function ConnectWalletButton({ full = false }: { full?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
            })}
          >
            {!connected ? (
              <button onClick={openConnectModal} className={full ? 'ritual-btn w-full' : 'ritual-btn'}>
                <Wallet size={16} /> Connect Wallet
              </button>
            ) : chain.unsupported ? (
              <button
                onClick={openChainModal}
                className="ritual-btn-ghost border-red-500/50 text-red-400 hover:border-red-400"
              >
                <AlertTriangle size={16} /> Jaringan salah
              </button>
            ) : (
              <button
                onClick={openAccountModal}
                className="flex items-center gap-1.5 rounded-full border border-ash-300 bg-ash-100/60 py-1 pl-1 pr-2.5 transition hover:border-ritual-500 hover:shadow-glow-sm"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ritual-gradient text-void">
                  <Wallet size={12} />
                </span>
                <span className="font-mono text-xs text-mist-light">{truncateAddress(account.address)}</span>
                <ChevronDown size={12} className="text-mist-dim" />
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

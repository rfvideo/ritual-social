import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { metaMaskWallet, walletConnectWallet, coinbaseWallet } from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { ritualChain } from './chain';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'MISSING_WALLETCONNECT_PROJECT_ID';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [metaMaskWallet, walletConnectWallet, coinbaseWallet],
    },
  ],
  { appName: 'Ritual Social', projectId },
);

export const wagmiConfig = createConfig({
  connectors,
  chains: [ritualChain],
  transports: { [ritualChain.id]: http() },
  ssr: false,
});

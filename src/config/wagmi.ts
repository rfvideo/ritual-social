import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { ritualChain } from './chain';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'MISSING_WALLETCONNECT_PROJECT_ID';

export const wagmiConfig = getDefaultConfig({
  appName: 'Ritual Social',
  projectId,
  chains: [ritualChain],
  ssr: false,
});

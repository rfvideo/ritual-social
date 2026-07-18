import { defineChain } from 'viem';

/**
 * Ritual Chain — defined from your own RPC/explorer endpoints.
 * Ritual Chain is currently a private/testnet network, so nothing here is
 * guessed: fill VITE_RITUAL_RPC_URL / VITE_RITUAL_CHAIN_ID in your .env with
 * the access you already have. Nothing will connect until you do.
 */
const chainId = Number(import.meta.env.VITE_RITUAL_CHAIN_ID ?? 560000);
const rpcUrl = import.meta.env.VITE_RITUAL_RPC_URL ?? '';
const explorerUrl = import.meta.env.VITE_RITUAL_EXPLORER_URL ?? '';
const chainName = import.meta.env.VITE_RITUAL_CHAIN_NAME ?? 'Ritual Chain Testnet';
const nativeSymbol = import.meta.env.VITE_RITUAL_NATIVE_SYMBOL ?? 'RITUAL';
const nativeDecimals = Number(import.meta.env.VITE_RITUAL_NATIVE_DECIMALS ?? 18);

export const ritualChain = defineChain({
  id: chainId,
  name: chainName,
  nativeCurrency: {
    name: nativeSymbol,
    symbol: nativeSymbol,
    decimals: nativeDecimals,
  },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
  blockExplorers: explorerUrl
    ? {
        default: { name: 'Ritual Explorer', url: explorerUrl },
      }
    : undefined,
  testnet: true,
});

export const isChainConfigured = Boolean(rpcUrl);

export function explorerTxUrl(hash: string) {
  if (!explorerUrl) return null;
  return `${explorerUrl.replace(/\/$/, '')}/tx/${hash}`;
}

export function explorerAddressUrl(address: string) {
  if (!explorerUrl) return null;
  return `${explorerUrl.replace(/\/$/, '')}/address/${address}`;
}

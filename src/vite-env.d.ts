/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RITUAL_CHAIN_ID: string;
  readonly VITE_RITUAL_CHAIN_NAME: string;
  readonly VITE_RITUAL_RPC_URL: string;
  readonly VITE_RITUAL_EXPLORER_URL: string;
  readonly VITE_RITUAL_NATIVE_SYMBOL: string;
  readonly VITE_RITUAL_NATIVE_DECIMALS: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_RITUAL_SOCIAL_ADDRESS: string;
  readonly VITE_RITUAL_TREASURY_ADDRESS: string;
  readonly VITE_ACTION_FEE: string;
  readonly VITE_IPFS_GATEWAY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export const ACTION_FEE_ETH = import.meta.env.VITE_ACTION_FEE ?? '0.005';

export const RITUAL_SOCIAL_ADDRESS = (import.meta.env.VITE_RITUAL_SOCIAL_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

export const RITUAL_TREASURY_ADDRESS = (import.meta.env.VITE_RITUAL_TREASURY_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

export const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY ?? 'https://w3s.link/ipfs/';

export const CONTRACTS_DEPLOYED =
  RITUAL_SOCIAL_ADDRESS !== '0x0000000000000000000000000000000000000000';

export const AI_TERMS = [
  'ZK',
  'TEE',
  'MPC',
  'Inference',
  'Restaking',
  'Rollup',
  'Blockchain',
  'Smart Contract',
];

# Ritual Social

An AI-native social app built on Ritual Chain — wallet-native identity, every social action an on-chain transaction, and AI features served through Ritual's infrastructure.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Wallet:** wagmi v2 / viem / RainbowKit
- **Chain:** Ritual Chain (EVM-compatible) — custom chain defined in `src/config/chain.ts`
- **Contracts:** Solidity (`RitualSocial`, `RitualTreasury`) via Foundry — `contracts/`
- **Storage:** IPFS (Pinata or web3.storage) via Netlify function `ipfs-upload.ts`; only the CID is stored on-chain
- **AI — on-chain path:** Ritual Chain LLM precompile (`0x0000000000000000000000000000000000000802`) via `src/lib/ritualLLM.ts` — user wallet signs the tx, TEE executor settles on-chain, receipt decoded for result + proof
- **AI — container path:** Self-hosted Infernet-compatible containers in `infernet-containers/` routed via Netlify functions

## AI infrastructure

### On-chain Ritual LLM (verifiable proofs)
- `src/lib/ritualLLM.ts` — core: wallet funding, executor selection, precompile call, receipt decode
- `src/hooks/useRitualModeration.ts` — content moderation (used at publish time)
- `src/hooks/useRitualLLM.ts` — generic hook; also exports `useRitualTranslate`, `useRitualSummarize`, `useRitualExplain`
- `netlify/functions/ritual-da-secrets.ts` — server-side ECIES encryption of Pinata JWT for TEE executor

### Self-hosted Infernet containers (fast inference, no on-chain proof)
| Container | Model | Feature |
|---|---|---|
| `ritual-translate` | `facebook/nllb-200-distilled-600M` | Translation (200+ languages) |
| `ritual-caption` | `Salesforce/blip-image-captioning-base` | Image captioning |
| `ritual-moderate` | `unitary/toxic-bert` + regex | Toxicity + spam/phishing |
| `ritual-summarize` | `facebook/bart-large-cnn` | Thread summarization |
| `ritual-recommend` | Engagement-gravity ranking | Feed recommendation |

Start all containers: `cd infernet-containers && docker compose up --build`

## Running locally

```bash
npm install
netlify dev          # Vite + Netlify functions together (recommended)
# or:
npm run dev          # frontend only — Netlify functions not available
```

## Environment variables

Copy `.env.example` to `.env`. Required before the app is fully functional:
- `VITE_RITUAL_RPC_URL` — Ritual Chain RPC endpoint
- `VITE_WALLETCONNECT_PROJECT_ID` — free at cloud.walletconnect.com
- `PINATA_JWT` — used for both IPFS storage and DA credentials for the LLM precompile
- `VITE_RITUAL_SOCIAL_ADDRESS` / `VITE_RITUAL_TREASURY_ADDRESS` — after deploying contracts
- `INFERNET_ROUTER_URL` — points at your running `infernet-containers/router` service

## Deploying

```bash
netlify deploy --build --prod
```

## Project structure

```
src/
  lib/ritualLLM.ts         — Ritual LLM precompile integration
  hooks/useRitualLLM.ts    — Generic on-chain LLM hook
  hooks/useRitualModeration.ts — On-chain content moderation
  hooks/useAI.ts           — Infernet-container AI hooks
  config/chain.ts          — Ritual Chain definition
  contracts/               — ABI + address helpers
contracts/                 — Solidity + Foundry deploy scripts
netlify/functions/         — AI proxy + IPFS + feed index functions
infernet-containers/       — Self-hosted AI compute layer (Docker)
```

## User preferences

- Preserve existing project structure — only change files that are necessary
- Keep code clean, optimal, and ready for further development
- Use real Ritual infrastructure (LLM precompile, real ML models) not placeholders

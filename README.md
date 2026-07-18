# Ritual Social

An AI-native social app built on Ritual Chain — wallet-native identity, every
social action a real on-chain transaction, and AI features (translation,
captioning, moderation, summarization, semantic search, feed ranking, term
explainers) served through an Infernet-style compute layer you run yourself.

This is a real, working codebase (contracts compile, frontend builds clean —
see "What's been verified" below), not a mockup. A few pieces are
intentionally left as configuration for **you** to fill in — see
"Before you deploy" — because they depend on access only you have (your
Ritual Chain RPC) or accounts only you can create (IPFS pinning, WalletConnect).

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind, wagmi/viem/RainbowKit for wallet + contract calls, React Query for data fetching, Framer Motion for animation.
- **Chain:** Solidity contracts (`RitualSocial`, `RitualTreasury`) deployed via Foundry to your Ritual Chain RPC.
- **Storage:** Images/post content pinned to IPFS (Pinata or web3.storage) via a Netlify function; only the resulting CID is ever written on-chain.
- **AI:** Netlify functions proxy to an Infernet-style router + containers you self-host (`/infernet-containers`), with a transparent local fallback so every AI button works even before you've deployed your own node.

## Repo layout

```
src/                     — frontend app
contracts/               — Solidity + Foundry deploy script
netlify/functions/       — serverless functions (AI proxy, IPFS pinning)
infernet-containers/     — self-hosted AI compute layer (router + job containers)
```

## Before you deploy

You said you already have RPC access to Ritual Chain — you'll still need to:

1. **Deploy the contracts** — see `contracts/README.md`. Copy the two resulting addresses into `.env`.
2. **Fill in chain details** in `.env`: `VITE_RITUAL_CHAIN_ID`, `VITE_RITUAL_RPC_URL`, `VITE_RITUAL_EXPLORER_URL` (if your testnet has an explorer with tx-lookup URLs).
3. **Get a WalletConnect project ID** — free, at https://cloud.walletconnect.com — for `VITE_WALLETCONNECT_PROJECT_ID`.
4. **Set up IPFS pinning** — a free Pinata account gives you a JWT for `PINATA_JWT` (or use web3.storage; set `STORAGE_PROVIDER=web3storage` + `WEB3_STORAGE_TOKEN`).
5. **Stand up the AI compute layer** — `docker compose up --build` inside `infernet-containers/` (works locally or on any small VPS), then set `INFERNET_ROUTER_URL` to wherever it's reachable. Until you do this, every AI feature still works via clearly-labeled local fallbacks (see `netlify/functions/_infernet-client.ts`), so the app is usable end-to-end from day one.

Copy `.env.example` to `.env` and fill in the above.

## Local development

```bash
npm install
netlify dev        # runs Vite + the Netlify functions together, recommended
# or: npm run dev  # frontend only — AI/IPFS functions won't be reachable
```

## Deploying to Netlify

```bash
netlify deploy --build --prod
```

or connect the repo in the Netlify dashboard — `netlify.toml` already wires
up the build command, publish directory, and functions directory. Set every
non-`VITE_`-prefixed variable from `.env` (storage tokens, Infernet router
URL, deployer key is NOT needed at runtime) in Netlify's environment
variables UI — those are server-side secrets and must never ship in the
frontend bundle.

## What's been verified in this build

- `contracts/src/*.sol` compiled successfully with solc 0.8.24 against the
  **exact OpenZeppelin v5.6.1 source now vendored in `contracts/lib/`**
  (ReentrancyGuard, Ownable) — zero errors. `contracts/lib/openzeppelin-contracts`
  and `contracts/lib/forge-std` are pre-installed so you don't need to run
  `forge install` yourself.
- Foundry itself was installed and `forge install` ran successfully in the
  build environment. Running `forge build` (which downloads the native solc
  *binary* from `binaries.soliditylang.org`) failed only because that host
  isn't reachable from this sandbox's restricted network — the same source
  was independently verified with solc's compiler directly (see above), so
  `forge build` is expected to work normally on your machine, which won't
  have this restriction.
- The frontend (`npm run build`) compiles and bundles successfully with
  TypeScript strict mode on.
- Netlify functions type-check cleanly against `@netlify/functions` + Node types.

What hasn't been (and can't be, from this environment): a live deploy against
your actual Ritual Chain RPC, or an end-to-end run against a real Infernet
node — both require infrastructure only you can access, and your private
key should never be entered anywhere outside your own machine/wallet.

## Feature map (spec → implementation)

| Spec item | Where |
|---|---|
| Connect/disconnect/auto-login/sign message/sign tx | RainbowKit + wagmi, `ConnectWalletButton.tsx` |
| Auto-create account on first login | `RitualSocial.updateProfile` auto-registers on first write; profile reads default to wallet-derived display |
| Profile (avatar/banner/bio/website/location/stats) | `ProfileHeader.tsx`, `EditProfileModal.tsx`, `profile-upload.ts` |
| Feed (infinite scroll, images, like/comment/repost/share/views) | `PostFeedList.tsx`, `PostCard.tsx`, `PostActions.tsx` |
| Compose (caption/photos/emoji/hashtag/mention) + fee confirm + real tx | `PostComposer.tsx`, `ConfirmTxDialog.tsx`, `useCreatePost` |
| Like / Comment / Repost, each a real fee tx | `useRitualSocial.ts`, `PostActions.tsx`, `CommentComposer.tsx` |
| Follow / Unfollow (free) | `useFollowGraph`, `RitualSocial.follow/unfollow` |
| Search (user/post/hashtag, trending, recent, suggested) | `Search.tsx` |
| Explore (trending post/hashtag, popular/suggested creator, latest image) | `Explore.tsx` |
| Notifications (like/comment/reply/mention/follow/repost) | `useNotifications.ts`, `NotificationItem.tsx` |
| Decentralized image storage, on-chain reference only | `ipfs-upload.ts`, `contentURI` field on-chain |
| Real transactions, no mocks, tx hash/block/timestamp/from/to/status | Every write path in `useRitualSocial.ts` waits for a real receipt before updating UI |
| "Lihat di Ritual Explorer" | `ExplorerLink.tsx` |
| Treasury (reward/campaign/governance/event/tipping) | `RitualTreasury.sol` |
| AI translation (auto-detect, translate, show original) | `TranslateButton.tsx`, `ai-translate.ts` |
| AI feed recommendation | `useFeedRecommendation`, `ai-recommend.ts` |
| AI search (semantic/natural language) | `Search.tsx`, `ai-search.ts` |
| AI moderation (spam/scam/phishing/toxic/nsfw) gating publish | `ModerationWarningDialog.tsx`, `ai-moderate.ts` |
| AI caption suggestion | `PostComposer.tsx` "Buat Caption dengan AI", `ai-caption.ts` |
| AI thread summary | `CommentList.tsx` "Ringkas dengan AI", `ai-summarize.ts` |
| AI explain technical terms | `AIExplainTerms.tsx`, `ai-explain.ts` |
| AI proof/attestation display | `InfernetJobResult.proof` shape is wired through every AI hook — populate it from your real Infernet node's response once available |
| Skeleton/lazy loading, smooth animation, toast, error/empty state, retry, pull-to-refresh, mobile-first | `Skeleton.tsx`, `States.tsx`, Framer Motion throughout, `PostFeedList.tsx` |
| Security basics (spam/bot/double-tx/double-click/spoofing/unauthorized edit/API abuse/malicious upload) | See "Security notes" below |

## Security notes

- **Double-click / double-tx:** every write hook disables its trigger button
  while `stage` is `awaiting-wallet`/`pending`; the contract's `hasLiked`/
  `hasReposted` mappings additionally make double actions revert on-chain.
- **Wallet spoofing:** identity is the connected wallet's signature via
  wagmi/viem — there's no separate session token to spoof.
- **Unauthorized edit:** `updateProfile`, `createPost`, etc. are all
  `msg.sender`-scoped in the contract; nothing lets one address mutate
  another's data.
- **API abuse:** every Netlify function validates its input and returns 400
  on malformed payloads; `ipfs-upload.ts` enforces a 25MB request cap.
- **Malicious upload:** `ImageUploader.tsx` whitelists MIME types and caps
  file size client-side; treat this as UX, not a security boundary — for
  production, also validate file signatures server-side before pinning.
- **Spam/bot at the content layer:** handled by `ai-moderate.ts` gating
  publish, plus the fee itself as an economic spam deterrent per the spec.

## Known simplifications (and how to remove them)

- **Feed reads directly from chain logs**, not an indexer — fine for a
  testnet-scale demo, but `getContractEvents` over a 50k-block window won't
  scale to mainnet traffic. Swap `usePosts.ts` for a subgraph/indexer-backed
  query when you need it.
- **AI containers ship with placeholder logic**, not trained models — see
  the `TODO` in each `infernet-containers/*/app.py`. The plumbing (request →
  container → response → UI) is real and tested; the model weights are the
  part only you can decide on (latency/cost/language-coverage tradeoffs).
- **View counts are not tracked on-chain** (the spec's view counter is
  present in the UI but reads as 0) — tracking real views on-chain would
  itself cost gas per view, which usually isn't worth it; consider an
  off-chain counter (e.g. a lightweight analytics call) if you want this live.

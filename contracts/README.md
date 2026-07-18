# Ritual Social — Contracts

`RitualSocial.sol` + `RitualTreasury.sol`, built with [Foundry](https://book.getfoundry.sh/).
Already compiled once with `solc` during development — see root README for
the sanity-check output. ABIs used by the frontend live in
`../src/contracts/abi/`.

## Setup

`lib/openzeppelin-contracts` (v5.6.1) and `lib/forge-std` are already
vendored in this repo, so you don't need `forge install`. Just install
Foundry itself if you don't have it:

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
cd contracts
forge build
```

This project's source was verified to compile cleanly against these exact
vendored versions (solc 0.8.24) before delivery.

## Deploy to your Ritual Chain RPC

Set these in your shell (or a `.env` loaded with `source`):

```bash
export DEPLOYER_PRIVATE_KEY=0xyour_deployer_key
export RITUAL_RPC_URL=https://your-ritual-rpc-endpoint
```

Then:

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url ritual \
  --broadcast
```

This deploys `RitualTreasury`, then `RitualSocial` (wired to the treasury),
then calls `treasury.setSocialContract(...)`. Copy the two printed addresses
into the frontend's `.env`:

```
VITE_RITUAL_SOCIAL_ADDRESS=0x...
VITE_RITUAL_TREASURY_ADDRESS=0x...
```

## Verification on Ritual Explorer

If Ritual Explorer exposes an Etherscan-compatible verify API, add
`RITUAL_EXPLORER_API_KEY` / `RITUAL_EXPLORER_VERIFY_URL` to your env and run:

```bash
forge verify-contract <address> src/RitualSocial.sol:RitualSocial --chain ritual
```

If it doesn't (many private-testnet explorers don't yet), users can still
verify activity happened by opening the transaction hash directly — the
"Lihat di Ritual Explorer" button in the app does exactly that.

## Adjusting the action fee or treasury split

- `RitualSocial.setActionFee(newFee)` — owner-only, in wei.
- `RitualTreasury`'s 5-way split (creator reward / community campaign /
  governance / event / tipping) is currently even; change the `deposit()`
  function in `RitualTreasury.sol` if your DAO decides on a different mix.

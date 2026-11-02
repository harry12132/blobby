# Blobby

A playful creative-culture platform with a wallet-shaped foundation.

## Current prototype

Blobby is currently a frontend concept with mock balances and demo interactions. It does **not** connect to a wallet, create transactions, custody funds, or store private keys.

### What's here
- Responsive dashboard and navigation
- Creative drops for art, music and digital objects
- Creator discovery and follow interactions
- Collection detail modal and save/like states
- Wallet overview with sample BTC, ETH and SOL balances
- Send / receive interaction previews (non-functional demo)
- Visual identity and responsive layouts

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Product direction

Blobby is exploring creative commerce: a place for creators to release digital work, build memberships and connect with collectors, with a secure multi-chain wallet experience underneath.

## Security boundary

Do not use real seed phrases, private keys, or real funds with this prototype. Wallet connectivity, signing, swaps, fiat on/off ramps, creator payouts and on-chain contracts are not implemented. Any production wallet functionality requires a dedicated threat model, established wallet libraries, independent security review and appropriate legal/compliance work.

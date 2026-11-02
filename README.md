# Blobby

Blobby is a creative-culture platform with a non-custodial EVM wallet experience.

## Working MVP

- Connects to an injected browser wallet such as Rabby or MetaMask using the EIP-1193 provider interface.
- Restricts wallet connection and transaction submission to Ethereum Sepolia testnet (chain ID 11155111).
- Reads the connected public address and native ETH balance directly from the wallet's RPC provider.
- Loads ETH/USD and 24-hour market movement from CoinGecko.
- Displays a live testnet portfolio value when a wallet is connected.
- Supports sending Sepolia test ETH. The connected wallet presents the transaction for approval and handles signing. Blobby does not receive private keys.
- Displays and copies the connected public receive address.
- Keeps creator discovery and digital-drop content as demo data.

## Run locally

```bash
npm install
npm run dev
```

## Wallet setup

1. Install Rabby or MetaMask in the browser.
2. Create a separate test wallet. Do not import a wallet containing real assets.
3. Open Blobby and select **Connect wallet**.
4. Approve the connection and switch to **Ethereum Sepolia** when prompted.
5. Use Sepolia test ETH only. The app blocks transaction submission on other networks.

## Important boundaries

- This is a testnet MVP, not a production wallet.
- Never enter a real seed phrase or private key into Blobby. Key generation, import, storage and custody are not implemented.
- Transactions are limited in code to Sepolia testnet. Testnet tokens have no intended monetary value.
- No mainnet transfers, token swaps, fiat ramps, Bitcoin/Solana wallet support, creator payouts, NFT contracts, authentication backend or transaction-history indexer are implemented.
- Market prices are informational and may be unavailable or rate-limited by the public CoinGecko endpoint.
- The app has not undergone an independent security audit. Do not use it to store or manage real funds.
- Production use requires a threat model, independent security review, robust transaction simulation, chain/indexer infrastructure, and legal/compliance review where applicable.

## Build

```bash
npm run build
```

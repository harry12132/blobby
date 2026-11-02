# Blobby

Blobby is an experimental Layer 1 blockchain written in Rust. Its native asset is **BLOB**.

The repository starts with a deliberately small, auditable development node: signed transfers, account nonces, fee accounting, a bounded mempool, deterministic block hashing, a JSON HTTP API, and a development-only faucet. It is a foundation for a future distributed validator network—not yet a production blockchain.

## Current status

**Prototype / local devnet only.** The current block producer is a single local process. There is no distributed consensus, peer-to-peer networking, durable database, smart-contract VM, production wallet, or production-grade economic/security model yet. Do not use real funds or expose the development faucet to the internet.

## Quick start

Requirements: Rust stable (1.78+ recommended).

```bash
cargo test
cargo run --release
```

The node listens on `127.0.0.1:9944` by default.

Environment:
- `BLOBBY_BIND`: listen address (default `127.0.0.1:9944`)
- `BLOBBY_DEV_MODE`: enable development faucet (default `true`; set `false` to disable)

## API

- `GET /health`
- `GET /v1/status`
- `GET /v1/blocks`
- `GET /v1/accounts/:address`
- `POST /v1/transactions`
- `POST /dev/faucet` (development mode only)
- `POST /dev/produce-block` (development mode only)

Amounts are integer base units. BLOB uses 9 decimal places: 1 BLOB = 1,000,000,000 base units. The prototype minimum transaction fee is 1 base unit. Fees are burned in this prototype; this is not a final tokenomics decision.

## Key generation

```bash
cargo run --bin blobby-keygen
```

The command prints a new development keypair. Treat the secret key as a password: never share it, commit it, or use a development key for real assets.

## Performance claims

Blobby makes no TPS, latency, or fee-superiority claims yet. Benchmarks must be reproducible and run across multiple independently operated machines before comparisons with Solana, Sui, or other networks are meaningful.

See [docs/PROTOCOL.md](docs/PROTOCOL.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

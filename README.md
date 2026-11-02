# Blobby

Blobby is an experimental Layer 1 blockchain written in Rust. Its native asset is **BLOB**.

The node supports Ed25519-signed transfers, sequential account nonces, fee accounting, a bounded mempool, deterministic block hashing, a JSON HTTP API, and a development-only faucet. Ledger snapshots are persisted atomically and checked on startup.

## Status

**Experimental local devnet; not suitable for real funds.** This branch adds durable single-node state. It is not yet a decentralised blockchain: peer discovery, authenticated block gossip, Byzantine-fault-tolerant consensus, validator economics, smart contracts, and production wallet security remain unimplemented. Do not expose the development faucet or RPC to the public internet.

No TPS, latency, or fee-superiority claims are made. Those require reproducible multi-node benchmarks and independent review.

## Quick start

Requirements: Rust stable (1.78+).

```bash
cargo test
cargo run --release
```

The node listens on `127.0.0.1:9944` by default. The default binary is `blobby-node`.

## Environment

- `BLOBBY_BIND`: HTTP listen address (default `127.0.0.1:9944`)
- `BLOBBY_DEV_MODE`: development faucet and manual block production (default `true`; set `false` to disable)
- `BLOBBY_DATA_DIR`: durable ledger directory (default `./data`)

The ledger is saved to `$BLOBBY_DATA_DIR/ledger.json`. Successful faucet credits and committed blocks are written through an atomic snapshot replacement. The mempool remains in-memory, so pending transactions are lost on restart.

## API

- `GET /health`
- `GET /v1/status`
- `GET /v1/blocks`
- `GET /v1/accounts/:address`
- `POST /v1/transactions`
- `POST /dev/faucet` (development mode only)
- `POST /dev/produce-block` (development mode only)

Amounts are integer base units. BLOB uses 9 decimal places: 1 BLOB = 1,000,000,000 base units. The prototype minimum fee is 1 base unit. Fees are burned; this is not a final tokenomics decision.

## Key generation

```bash
cargo run --bin blobby-keygen
```

Never share or commit secret keys. The key generator is for development only.

## Benchmarking

Run the single-process microbenchmark with an optional transaction count (default 10,000):

```bash
cargo run --release --bin bench -- 10000
```

It reports transaction signing time and block-application throughput. This is a local microbenchmark, not network TPS and not comparable to published multi-validator chain benchmarks. Results depend on hardware and build settings.

The execution module also includes a deterministic conflict-free batch planner. It identifies independent account accesses but does not yet execute them in parallel.

See [docs/ROADMAP.md](docs/ROADMAP.md) for the staged networking, consensus, and performance plan.

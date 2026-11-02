# Blobby roadmap

## Stage 0 — Local protocol prototype
- [x] Rust node and HTTP API
- [x] Ed25519-signed transfers and account nonces
- [x] Fee accounting, bounded mempool, atomic block application
- [x] Deterministic block hashing

## Stage 1 — Durable single-node foundation
- [x] Versioned ledger snapshots
- [x] Atomic file replacement and checksum validation
- [x] Verify block heights, parent links, and hashes on startup
- [x] Persist faucet credits and committed blocks before publishing state
- [ ] Persist/recover the mempool
- [ ] Snapshot rotation, migrations, and crash-injection tests

## Stage 2 — Multi-node networking
- [ ] Node identity keys and authenticated peer handshakes
- [ ] Peer allowlists, rate limits, bounded messages, and protocol versioning
- [ ] Block and transaction gossip with replay protection
- [ ] State sync from a trusted finalized checkpoint
- [ ] Multi-process integration tests and network-partition tests

## Stage 3 — Consensus and validator safety
- [ ] Specify validator membership, authority model, and threat assumptions
- [ ] Adopt or formally specify a reviewed BFT protocol; do not ship ad-hoc voting
- [ ] Signed proposals, prevotes/precommits, quorum certificates, and equivocation evidence
- [ ] Persist consensus rounds and safety-critical locks before sending votes
- [ ] Fault-injection tests for Byzantine nodes and network partitions

## Stage 4 — Execution and performance
- [x] Deterministic conflict-free batch planner for independent account accesses
- [ ] Parallel execution with deterministic state-root comparison
- [ ] Criterion microbenchmarks and end-to-end multi-node load tests
- [ ] Publish reproducible TPS, p50/p95/p99 latency, hardware, and fee methodology
- [ ] Independent security review before any public testnet

A fast single machine is not a decentralised chain. Consensus safety and reproducibility take priority over headline TPS.

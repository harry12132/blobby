# Blobby roadmap

## Stage 0 — Local protocol prototype (current)
- [x] Rust workspace and node binary
- [x] Ed25519-signed transfer format
- [x] Account balances and sequential nonces
- [x] Minimum base-unit fee and fee accounting
- [x] Atomic block application and block hashing
- [x] Bounded in-memory mempool
- [x] Local HTTP API and development faucet
- [ ] Compile and run CI on GitHub Actions

## Stage 1 — Correctness and reproducibility
- [ ] CI: formatting, linting, unit tests, dependency audit
- [ ] Property-based tests for balances, nonces, replay and overflow
- [ ] Fuzz transaction and RPC input parsers
- [ ] Durable storage with crash-safe recovery
- [ ] Deterministic state root and block verification
- [ ] Benchmark harness with documented hardware

## Stage 2 — Distributed network
- [ ] Peer-to-peer transport and authenticated node identity
- [ ] Validator registration and genesis validator set
- [ ] BFT consensus with quorum certificates
- [ ] Network partitions, Byzantine and restart simulations
- [ ] Multi-machine testnet

## Stage 3 — Throughput
- [ ] Parallel signature verification
- [ ] Conflict-aware parallel transaction execution
- [ ] Efficient block propagation and batching
- [ ] State database and pruning strategy
- [ ] Sustained-load benchmarks across independent machines

## Stage 4 — Production readiness
- [ ] Independent protocol and cryptography audits
- [ ] Economic and validator incentive analysis
- [ ] Operational monitoring, backups and incident response
- [ ] Public testnet and bug bounty
- [ ] Mainnet only after external review and sustained testing

## Performance policy

No TPS, finality, decentralisation, security, or fee-superiority claim is considered achieved until independently reproducible measurements support it.

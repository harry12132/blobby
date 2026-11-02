# Blobby protocol notes (prototype)

## Identity and chain domain

- Network name: Blobby
- Native asset: BLOB
- Chain ID: `blobby-devnet-1`
- Address: lowercase hexadecimal encoding of a 32-byte Ed25519 public key
- Signature: Ed25519 over the canonical JSON serialization of the signable transaction fields

The chain ID is included in signed bytes to prevent a transaction signed for this devnet from being replayed on a network with a different chain ID.

## Transaction

A transaction contains sender, recipient, amount, fee, nonce, public key, and signature. Amounts and fees are unsigned integer base units. BLOB has 9 decimal places. The sender address must equal the public key bytes. The sender nonce must equal the account's next expected nonce.

The prototype enforces a minimum fee of one base unit. Fees are burned. Fee policy and supply economics remain open protocol decisions.

## Blocks

A block contains a monotonically increasing height, timestamp, previous block hash, transactions, and a SHA-256 hash of a canonical serialized block payload. A block is applied atomically: if any transaction fails, no state changes from that block are committed.

## Current trust model

This implementation has one local process and manually triggered block production. It has no peer discovery, validator set, quorum certificates, leader election, slashing, or Byzantine fault-tolerant consensus. Its "finality" is therefore local prototype state only, not distributed finality.

## Performance design principles

1. Separate transaction admission, ordering, execution, and persistence.
2. Parallelise signature checks and independent state access only after conflict detection is specified.
3. Keep the consensus protocol independent from the execution engine through explicit interfaces.
4. Benchmark end-to-end committed transactions across multiple machines, not just signature verification or local execution.
5. Avoid promising a fixed USD fee: the protocol can define base-unit fees, but fiat cost depends on the market value of BLOB and operating economics.

## Security limitations

This prototype is not audited and must not hold real funds. It currently lacks durable state persistence, peer-to-peer networking, distributed consensus, rate limiting, authentication for dev endpoints, transaction replacement policy, and robust protection against resource exhaustion. Do not expose dev mode to the public internet.

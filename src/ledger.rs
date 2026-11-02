use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::transaction::{Transaction, TransactionError};
use crate::types::{Account, Block, NetworkStatus, BASE_UNITS_PER_BLOB, MIN_TX_FEE};

pub const CHAIN_ID: &str = "blobby-devnet-1";
const GENESIS_HASH: &str = "blobby-genesis-v1";

#[derive(Debug, Error)]
pub enum LedgerError {
    #[error(transparent)]
    InvalidTransaction(#[from] TransactionError),
    #[error("incorrect transaction nonce: expected {expected}, received {received}")]
    InvalidNonce { expected: u64, received: u64 },
    #[error("insufficient funds")]
    InsufficientFunds,
    #[error("account balance overflow")]
    BalanceOverflow,
    #[error("block contains no transactions")]
    EmptyBlock,
}

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Ledger {
    accounts: HashMap<String, Account>,
    blocks: Vec<Block>,
    total_supply: u64,
}

#[derive(Serialize)]
struct BlockHashPayload<'a> {
    height: u64,
    timestamp_ms: u128,
    previous_hash: &'a str,
    transactions: &'a [Transaction],
}

impl Ledger {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn account(&self, address: &str) -> Account {
        self.accounts.get(address).cloned().unwrap_or_default()
    }

    pub fn height(&self) -> u64 {
        self.blocks.len() as u64
    }

    pub fn blocks(&self) -> &[Block] {
        &self.blocks
    }

    pub fn total_supply(&self) -> u64 {
        self.total_supply
    }

    pub fn credit_dev_account(&mut self, address: &str, amount: u64) -> Result<(), LedgerError> {
        let bytes = hex::decode(address).map_err(|_| LedgerError::InvalidTransaction(
            TransactionError::InvalidRecipient,
        ))?;
        if bytes.len() != 32 || amount == 0 {
            return Err(LedgerError::InvalidTransaction(TransactionError::InvalidRecipient));
        }
        let current = self.account(address);
        let next_balance = current.balance.checked_add(amount).ok_or(LedgerError::BalanceOverflow)?;
        let next_supply = self.total_supply.checked_add(amount).ok_or(LedgerError::BalanceOverflow)?;
        self.accounts.insert(address.to_owned(), Account { balance: next_balance, nonce: current.nonce });
        self.total_supply = next_supply;
        Ok(())
    }

    pub fn validate_transaction(&self, tx: &Transaction) -> Result<(), LedgerError> {
        tx.verify(CHAIN_ID)?;
        let sender = self.account(&tx.sender);
        if tx.nonce != sender.nonce {
            return Err(LedgerError::InvalidNonce { expected: sender.nonce, received: tx.nonce });
        }
        let required = tx.amount.checked_add(tx.fee).ok_or(LedgerError::BalanceOverflow)?;
        if sender.balance < required {
            return Err(LedgerError::InsufficientFunds);
        }
        Ok(())
    }

    /// Validate a candidate after replaying the transactions already queued in the mempool.
    /// This permits sequential nonces from one account while rejecting duplicate or overspending
    /// transactions before they enter the pool.
    pub fn validate_mempool_transaction(
        &self,
        pending: &[Transaction],
        candidate: &Transaction,
    ) -> Result<(), LedgerError> {
        let mut simulated = self.clone();
        for tx in pending {
            simulated.apply_transaction(tx)?;
        }
        simulated.apply_transaction(candidate)
    }

    pub fn produce_block(&mut self, transactions: Vec<Transaction>) -> Result<Block, LedgerError> {
        if transactions.is_empty() {
            return Err(LedgerError::EmptyBlock);
        }

        let mut candidate = self.clone();
        for tx in &transactions {
            candidate.apply_transaction(tx)?;
        }

        let height = self.height() + 1;
        let timestamp_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let previous_hash = self.blocks.last()
            .map(|block| block.hash.clone())
            .unwrap_or_else(|| GENESIS_HASH.to_owned());

        let hash = calculate_block_hash(height, timestamp_ms, &previous_hash, &transactions);
        let block = Block { height, timestamp_ms, previous_hash, transactions, hash };

        candidate.blocks.push(block.clone());
        *self = candidate;
        Ok(block)
    }

    fn apply_transaction(&mut self, tx: &Transaction) -> Result<(), LedgerError> {
        self.validate_transaction(tx)?;
        let mut sender = self.account(&tx.sender);
        if tx.sender == tx.recipient {
            sender.balance -= tx.fee;
            sender.nonce = sender.nonce.checked_add(1).ok_or(LedgerError::BalanceOverflow)?;
            self.accounts.insert(tx.sender.clone(), sender);
        } else {
            let mut recipient = self.account(&tx.recipient);
            let debit = tx.amount.checked_add(tx.fee).ok_or(LedgerError::BalanceOverflow)?;
            sender.balance -= debit;
            sender.nonce = sender.nonce.checked_add(1).ok_or(LedgerError::BalanceOverflow)?;
            recipient.balance = recipient.balance.checked_add(tx.amount).ok_or(LedgerError::BalanceOverflow)?;
            self.accounts.insert(tx.sender.clone(), sender);
            self.accounts.insert(tx.recipient.clone(), recipient);
        }
        self.total_supply = self.total_supply.checked_sub(tx.fee).ok_or(LedgerError::BalanceOverflow)?;
        Ok(())
    }

    /// Verify heights, parent links, and hashes before loading persisted state.
    pub fn verify_chain(&self) -> bool {
        let mut previous_hash = GENESIS_HASH.to_owned();
        for (index, block) in self.blocks.iter().enumerate() {
            if block.height != index as u64 + 1 || block.previous_hash != previous_hash {
                return false;
            }
            let expected = calculate_block_hash(
                block.height, block.timestamp_ms, &block.previous_hash, &block.transactions,
            );
            if block.hash != expected {
                return false;
            }
            previous_hash = block.hash.clone();
        }
        true
    }

    pub fn status(&self) -> NetworkStatus {
        NetworkStatus {
            network: "Blobby".to_owned(),
            ticker: "BLOB".to_owned(),
            chain_id: CHAIN_ID.to_owned(),
            height: self.height(),
            latest_block_hash: self.blocks.last().map(|b| b.hash.clone()).unwrap_or_else(|| GENESIS_HASH.to_owned()),
            total_supply: self.total_supply,
            minimum_fee: MIN_TX_FEE,
            decimals: 9,
            mode: "single-node-development-prototype".to_owned(),
        }
    }

    pub fn blob_amount_to_display(amount: u64) -> String {
        let whole = amount / BASE_UNITS_PER_BLOB;
        let fraction = amount % BASE_UNITS_PER_BLOB;
        format!("{whole}.{fraction:09}")
    }
}

fn calculate_block_hash(
    height: u64,
    timestamp_ms: u128,
    previous_hash: &str,
    transactions: &[Transaction],
) -> String {
    let payload = BlockHashPayload { height, timestamp_ms, previous_hash, transactions };
    let encoded = serde_json::to_vec(&payload).expect("block payload serialization is infallible");
    hex::encode(Sha256::digest(encoded))
}

#[cfg(test)]
mod tests {
    use ed25519_dalek::{Signer, SigningKey};
    use rand::rngs::OsRng;

    use super::*;
    use crate::transaction::Transaction;

    fn signed_tx(key: &SigningKey, recipient: &str, amount: u64, fee: u64, nonce: u64) -> Transaction {
        let sender = hex::encode(key.verifying_key().to_bytes());
        let bytes = Transaction::signing_bytes(CHAIN_ID, &sender, recipient, amount, fee, nonce).unwrap();
        let signature = key.sign(&bytes);
        Transaction {
            sender: sender.clone(),
            recipient: recipient.to_owned(),
            amount,
            fee,
            nonce,
            public_key: sender,
            signature: hex::encode(signature.to_bytes()),
        }
    }

    #[test]
    fn signed_transfer_updates_balances_and_nonce() {
        let key = SigningKey::generate(&mut OsRng);
        let recipient_key = SigningKey::generate(&mut OsRng);
        let sender = hex::encode(key.verifying_key().to_bytes());
        let recipient = hex::encode(recipient_key.verifying_key().to_bytes());
        let mut ledger = Ledger::new();
        ledger.credit_dev_account(&sender, 1_000).unwrap();

        ledger.produce_block(vec![signed_tx(&key, &recipient, 100, MIN_TX_FEE, 0)]).unwrap();

        assert_eq!(ledger.account(&sender).balance, 899);
        assert_eq!(ledger.account(&sender).nonce, 1);
        assert_eq!(ledger.account(&recipient).balance, 100);
        assert_eq!(ledger.total_supply(), 999);
    }

    #[test]
    fn failed_block_is_atomic() {
        let key = SigningKey::generate(&mut OsRng);
        let recipient_key = SigningKey::generate(&mut OsRng);
        let sender = hex::encode(key.verifying_key().to_bytes());
        let recipient = hex::encode(recipient_key.verifying_key().to_bytes());
        let mut ledger = Ledger::new();
        ledger.credit_dev_account(&sender, 150).unwrap();

        let first = signed_tx(&key, &recipient, 100, 1, 0);
        let second = signed_tx(&key, &recipient, 100, 1, 1);
        assert!(ledger.produce_block(vec![first, second]).is_err());
        assert_eq!(ledger.height(), 0);
        assert_eq!(ledger.account(&sender).balance, 150);
        assert_eq!(ledger.account(&recipient).balance, 0);
    }

    #[test]
    fn rejects_replayed_nonce() {
        let key = SigningKey::generate(&mut OsRng);
        let recipient_key = SigningKey::generate(&mut OsRng);
        let sender = hex::encode(key.verifying_key().to_bytes());
        let recipient = hex::encode(recipient_key.verifying_key().to_bytes());
        let mut ledger = Ledger::new();
        ledger.credit_dev_account(&sender, 100).unwrap();

        let tx = signed_tx(&key, &recipient, 10, 1, 0);
        ledger.produce_block(vec![tx.clone()]).unwrap();
        assert!(ledger.produce_block(vec![tx]).is_err());
    }

    #[test]
    fn self_transfer_burns_only_the_fee() {
        let key = SigningKey::generate(&mut OsRng);
        let address = hex::encode(key.verifying_key().to_bytes());
        let mut ledger = Ledger::new();
        ledger.credit_dev_account(&address, 100).unwrap();
        ledger.produce_block(vec![signed_tx(&key, &address, 40, 1, 0)]).unwrap();
        assert_eq!(ledger.account(&address).balance, 99);
        assert_eq!(ledger.total_supply(), 99);
    }

    #[test]
    fn mempool_validation_accepts_sequential_nonces() {
        let key = SigningKey::generate(&mut OsRng);
        let recipient_key = SigningKey::generate(&mut OsRng);
        let sender = hex::encode(key.verifying_key().to_bytes());
        let recipient = hex::encode(recipient_key.verifying_key().to_bytes());
        let mut ledger = Ledger::new();
        ledger.credit_dev_account(&sender, 100).unwrap();
        let first = signed_tx(&key, &recipient, 10, 1, 0);
        let second = signed_tx(&key, &recipient, 10, 1, 1);
        ledger.validate_mempool_transaction(&[], &first).unwrap();
        ledger.validate_mempool_transaction(&[first], &second).unwrap();
    }
}

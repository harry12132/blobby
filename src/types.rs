use serde::{Deserialize, Serialize};

pub const BASE_UNITS_PER_BLOB: u64 = 1_000_000_000;
pub const MIN_TX_FEE: u64 = 1;

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct Account {
    pub balance: u64,
    pub nonce: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Block {
    pub height: u64,
    pub timestamp_ms: u128,
    pub previous_hash: String,
    pub transactions: Vec<crate::transaction::Transaction>,
    pub hash: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NetworkStatus {
    pub network: String,
    pub ticker: String,
    pub chain_id: String,
    pub height: u64,
    pub latest_block_hash: String,
    pub total_supply: u64,
    pub minimum_fee: u64,
    pub decimals: u8,
    pub mode: String,
}

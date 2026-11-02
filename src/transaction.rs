use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::types::MIN_TX_FEE;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Transaction {
    pub sender: String,
    pub recipient: String,
    pub amount: u64,
    pub fee: u64,
    pub nonce: u64,
    pub public_key: String,
    pub signature: String,
}

#[derive(Serialize)]
struct SignableTransaction<'a> {
    chain_id: &'a str,
    sender: &'a str,
    recipient: &'a str,
    amount: u64,
    fee: u64,
    nonce: u64,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum TransactionError {
    #[error("sender must be a 32-byte hexadecimal public key")]
    InvalidSender,
    #[error("recipient must be a 32-byte hexadecimal address")]
    InvalidRecipient,
    #[error("public key is invalid")]
    InvalidPublicKey,
    #[error("signature is invalid")]
    InvalidSignature,
    #[error("transaction fee is below the network minimum")]
    FeeTooLow,
    #[error("amount must be greater than zero")]
    ZeroAmount,
    #[error("transaction encoding is invalid")]
    Encoding,
}

impl Transaction {
    pub fn signing_bytes(
        chain_id: &str,
        sender: &str,
        recipient: &str,
        amount: u64,
        fee: u64,
        nonce: u64,
    ) -> Result<Vec<u8>, TransactionError> {
        serde_json::to_vec(&SignableTransaction {
            chain_id,
            sender,
            recipient,
            amount,
            fee,
            nonce,
        })
        .map_err(|_| TransactionError::Encoding)
    }

    pub fn verify(&self, chain_id: &str) -> Result<(), TransactionError> {
        let sender_bytes = hex::decode(&self.sender).map_err(|_| TransactionError::InvalidSender)?;
        let recipient_bytes =
            hex::decode(&self.recipient).map_err(|_| TransactionError::InvalidRecipient)?;
        let public_bytes =
            hex::decode(&self.public_key).map_err(|_| TransactionError::InvalidPublicKey)?;

        if sender_bytes.len() != 32 || sender_bytes.as_slice() != public_bytes.as_slice() {
            return Err(TransactionError::InvalidSender);
        }
        if recipient_bytes.len() != 32 {
            return Err(TransactionError::InvalidRecipient);
        }
        if public_bytes.len() != 32 {
            return Err(TransactionError::InvalidPublicKey);
        }
        if self.amount == 0 {
            return Err(TransactionError::ZeroAmount);
        }
        if self.fee < MIN_TX_FEE {
            return Err(TransactionError::FeeTooLow);
        }

        let public_array: [u8; 32] = public_bytes
            .as_slice()
            .try_into()
            .map_err(|_| TransactionError::InvalidPublicKey)?;
        let verifying_key =
            VerifyingKey::from_bytes(&public_array).map_err(|_| TransactionError::InvalidPublicKey)?;

        let signature_bytes = hex::decode(&self.signature)
            .map_err(|_| TransactionError::InvalidSignature)?;
        let signature_array: [u8; 64] = signature_bytes
            .as_slice()
            .try_into()
            .map_err(|_| TransactionError::InvalidSignature)?;
        let signature = Signature::from_bytes(&signature_array);

        let message = Self::signing_bytes(
            chain_id,
            &self.sender,
            &self.recipient,
            self.amount,
            self.fee,
            self.nonce,
        )?;

        verifying_key
            .verify_strict(&message, &signature)
            .map_err(|_| TransactionError::InvalidSignature)
    }

    pub fn id(&self) -> String {
        let bytes = serde_json::to_vec(self).expect("transaction serialization is infallible");
        hex::encode(Sha256::digest(bytes))
    }
}

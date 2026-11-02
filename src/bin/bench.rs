use std::time::Instant;

use blobby::{ledger::CHAIN_ID, Ledger, Transaction, MIN_TX_FEE};
use ed25519_dalek::{Signer, SigningKey};
use rand::rngs::OsRng;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let count = std::env::args()
        .nth(1)
        .map(|value| value.parse::<usize>())
        .transpose()?
        .unwrap_or(10_000);
    if count == 0 || count > 1_000_000 {
        return Err("transaction count must be between 1 and 1,000,000".into());
    }

    let sender_key = SigningKey::generate(&mut OsRng);
    let recipient_key = SigningKey::generate(&mut OsRng);
    let sender = hex::encode(sender_key.verifying_key().to_bytes());
    let recipient = hex::encode(recipient_key.verifying_key().to_bytes());
    let funding = (count as u64)
        .checked_mul(1 + MIN_TX_FEE)
        .ok_or("funding amount overflow")?;

    let mut ledger = Ledger::new();
    ledger.credit_dev_account(&sender, funding)?;

    let started = Instant::now();
    let mut transactions = Vec::with_capacity(count);
    for nonce in 0..count as u64 {
        let bytes = Transaction::signing_bytes(
            CHAIN_ID, &sender, &recipient, 1, MIN_TX_FEE, nonce,
        )?;
        let signature = sender_key.sign(&bytes);
        transactions.push(Transaction {
            sender: sender.clone(),
            recipient: recipient.clone(),
            amount: 1,
            fee: MIN_TX_FEE,
            nonce,
            public_key: sender.clone(),
            signature: hex::encode(signature.to_bytes()),
        });
    }
    let signing_elapsed = started.elapsed();

    let execution_started = Instant::now();
    ledger.produce_block(transactions)?;
    let execution_elapsed = execution_started.elapsed();
    let total_elapsed = signing_elapsed + execution_elapsed;
    let tps = count as f64 / execution_elapsed.as_secs_f64().max(f64::MIN_POSITIVE);

    println!("Blobby single-process microbenchmark");
    println!("transactions: {count}");
    println!("signing_ms: {:.3}", signing_elapsed.as_secs_f64() * 1000.0);
    println!("block_apply_ms: {:.3}", execution_elapsed.as_secs_f64() * 1000.0);
    println!("block_apply_tps: {:.2}", tps);
    println!("total_ms: {:.3}", total_elapsed.as_secs_f64() * 1000.0);
    println!("NOTE: this is not a multi-node network TPS benchmark.");
    Ok(())
}

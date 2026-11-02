use std::{env, process};

use ed25519_dalek::{Signer, SigningKey};

use blobby::{ledger::CHAIN_ID, transaction::Transaction};

fn main() {
    let mut args = env::args().skip(1);
    let recipient = args.next().unwrap_or_else(|| usage());
    let amount: u64 = args
        .next()
        .unwrap_or_else(|| usage())
        .parse()
        .unwrap_or_else(|_| usage());
    let nonce: u64 = args
        .next()
        .unwrap_or_else(|| usage())
        .parse()
        .unwrap_or_else(|_| usage());

    if args.next().is_some() || amount == 0 {
        usage();
    }

    let secret_hex = env::var("BLOBBY_SECRET_KEY")
        .unwrap_or_else(|_| {
            eprintln!("Set BLOBBY_SECRET_KEY in the environment; do not pass it as an argument.");
            process::exit(2);
        });
    let secret = hex::decode(secret_hex.trim()).unwrap_or_else(|_| {
        eprintln!("BLOBBY_SECRET_KEY must be 32-byte hexadecimal.");
        process::exit(2);
    });
    let secret_bytes: [u8; 32] = secret.as_slice().try_into().unwrap_or_else(|_| {
        eprintln!("BLOBBY_SECRET_KEY must decode to exactly 32 bytes.");
        process::exit(2);
    });

    let signing_key = SigningKey::from_bytes(&secret_bytes);
    let public_key = hex::encode(signing_key.verifying_key().to_bytes());
    let recipient_bytes = hex::decode(&recipient).unwrap_or_else(|_| usage());
    if recipient_bytes.len() != 32 {
        usage();
    }

    let fee = 1;
    let signing_bytes = Transaction::signing_bytes(
        CHAIN_ID,
        &public_key,
        &recipient,
        amount,
        fee,
        nonce,
    )
    .expect("transaction signing payload should serialize");
    let signature = signing_key.sign(&signing_bytes);

    let transaction = Transaction {
        sender: public_key.clone(),
        recipient,
        amount,
        fee,
        nonce,
        public_key,
        signature: hex::encode(signature.to_bytes()),
    };

    println!(
        "{}",
        serde_json::to_string(&transaction).expect("transaction should serialize")
    );
}

fn usage() -> ! {
    eprintln!("Usage: cargo run --release --bin transfer -- <recipient-address> <amount-base-units> <nonce>");
    process::exit(2);
}

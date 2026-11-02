use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;

fn main() {
    let signing_key = SigningKey::generate(&mut OsRng);
    let verifying_key = signing_key.verifying_key();
    println!("Blobby development account");
    println!("Address: {}", hex::encode(verifying_key.to_bytes()));
    println!("Secret key (KEEP PRIVATE): {}", hex::encode(signing_key.to_bytes()));
    eprintln!("This is a development key. Never commit it or use it for real assets.");
}

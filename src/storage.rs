use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::Path,
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::Ledger;

const SNAPSHOT_VERSION: u32 = 1;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("storage I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("snapshot encoding error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("unsupported ledger snapshot version: {0}")]
    Version(u32),
    #[error("ledger snapshot checksum mismatch")]
    Checksum,
    #[error("persisted block chain failed integrity validation")]
    InvalidChain,
}

#[derive(Serialize, Deserialize)]
struct Snapshot {
    version: u32,
    checksum: String,
    ledger: Ledger,
}

pub fn load_ledger(path: &Path) -> Result<Ledger, StorageError> {
    if !path.exists() {
        return Ok(Ledger::new());
    }
    let snapshot: Snapshot = serde_json::from_slice(&fs::read(path)?)?;
    if snapshot.version != SNAPSHOT_VERSION {
        return Err(StorageError::Version(snapshot.version));
    }
    let ledger_bytes = serde_json::to_vec(&snapshot.ledger)?;
    let checksum = hex::encode(Sha256::digest(ledger_bytes));
    if checksum != snapshot.checksum {
        return Err(StorageError::Checksum);
    }
    if !snapshot.ledger.verify_chain() {
        return Err(StorageError::InvalidChain);
    }
    Ok(snapshot.ledger)
}

/// Atomically replace the snapshot. The caller publishes candidate state only after this succeeds.
pub fn save_ledger(path: &Path, ledger: &Ledger) -> Result<(), StorageError> {
    let ledger_bytes = serde_json::to_vec(ledger)?;
    let snapshot = Snapshot {
        version: SNAPSHOT_VERSION,
        checksum: hex::encode(Sha256::digest(ledger_bytes)),
        ledger: ledger.clone(),
    };
    let bytes = serde_json::to_vec_pretty(&snapshot)?;
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent)?;
    let name = path.file_name().and_then(|value| value.to_str()).unwrap_or("ledger.json");
    let temporary = parent.join(format!(".{name}.{}.tmp", std::process::id()));
    let mut file = OpenOptions::new().create(true).truncate(true).write(true).open(&temporary)?;
    file.write_all(&bytes)?;
    file.sync_all()?;
    drop(file);
    fs::rename(&temporary, path)?;
    if let Ok(directory) = File::open(parent) {
        let _ = directory.sync_all();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};
    use super::*;

    fn path() -> std::path::PathBuf {
        let id = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        std::env::temp_dir().join(format!("blobby-snapshot-{id}.json"))
    }

    #[test]
    fn missing_snapshot_starts_empty() {
        let ledger = load_ledger(&path()).unwrap();
        assert_eq!(ledger.height(), 0);
        assert_eq!(ledger.total_supply(), 0);
    }

    #[test]
    fn snapshot_round_trip_preserves_state() {
        let file = path();
        let mut ledger = Ledger::new();
        let address = "11".repeat(32);
        ledger.credit_dev_account(&address, 987_654_321).unwrap();
        save_ledger(&file, &ledger).unwrap();
        let restored = load_ledger(&file).unwrap();
        assert_eq!(restored.height(), ledger.height());
        assert_eq!(restored.total_supply(), ledger.total_supply());
        assert_eq!(restored.account(&address).balance, 987_654_321);
        let _ = fs::remove_file(file);
    }

    #[test]
    fn rejects_modified_snapshot() {
        let file = path();
        save_ledger(&file, &Ledger::new()).unwrap();
        let mut snapshot: Snapshot = serde_json::from_slice(&fs::read(&file).unwrap()).unwrap();
        snapshot.checksum = "invalid".to_owned();
        fs::write(&file, serde_json::to_vec(&snapshot).unwrap()).unwrap();
        assert!(matches!(load_ledger(&file), Err(StorageError::Checksum)));
        let _ = fs::remove_file(file);
    }
}

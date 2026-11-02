use std::{env, net::SocketAddr, path::PathBuf, sync::Arc};

use blobby::rpc::{router, AppState};
use blobby::{storage::load_ledger, Ledger};
use tokio::sync::{Mutex, RwLock};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    let bind: SocketAddr = env::var("BLOBBY_BIND")
        .unwrap_or_else(|_| "127.0.0.1:9944".to_owned())
        .parse()?;
    let dev_mode = env::var("BLOBBY_DEV_MODE")
        .map(|value| value != "false" && value != "0")
        .unwrap_or(true);

    let data_dir = PathBuf::from(
        env::var("BLOBBY_DATA_DIR").unwrap_or_else(|_| "./data".to_owned()),
    );
    std::fs::create_dir_all(&data_dir)?;
    let storage_path = Arc::new(data_dir.join("ledger.json"));
    let ledger = load_ledger(storage_path.as_ref())?;
    tracing::info!(height = ledger.height(), data_dir = %data_dir.display(), "Loaded durable ledger state");

    let state = AppState {
        ledger: Arc::new(RwLock::new(ledger)),
        mempool: Arc::new(Mutex::new(Vec::new())),
        dev_mode,
        storage_path,
    };
    let app = router(state);
    let listener = tokio::net::TcpListener::bind(bind).await?;
    tracing::info!(address = %bind, dev_mode, "Blobby devnet node listening");
    axum::serve(listener, app).await?;
    Ok(())
}

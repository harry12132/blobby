use std::{env, net::SocketAddr};

use blobby::rpc::{router, AppState};
use blobby::Ledger;
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

    let state = AppState {
        ledger: std::sync::Arc::new(RwLock::new(Ledger::new())),
        mempool: std::sync::Arc::new(Mutex::new(Vec::new())),
        dev_mode,
    };
    let app = router(state);
    let listener = tokio::net::TcpListener::bind(bind).await?;
    tracing::info!(address = %bind, dev_mode, "Blobby devnet node listening");
    axum::serve(listener, app).await?;
    Ok(())
}

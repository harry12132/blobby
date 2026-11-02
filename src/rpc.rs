use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, RwLock};

use crate::ledger::{Ledger, LedgerError, CHAIN_ID};
use crate::transaction::Transaction;
use crate::types::{Account, Block};

#[derive(Clone)]
pub struct AppState {
    pub ledger: Arc<RwLock<Ledger>>,
    pub mempool: Arc<Mutex<Vec<Transaction>>>,
    pub dev_mode: bool,
}

#[derive(Deserialize)]
pub struct FaucetRequest {
    pub address: String,
    pub amount: u64,
}

#[derive(Serialize)]
struct SubmitResponse {
    accepted: bool,
    transaction_id: String,
    mempool_size: usize,
}

#[derive(Serialize)]
struct ProduceResponse {
    produced: bool,
    block: Block,
    remaining_mempool: usize,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/v1/status", get(status))
        .route("/v1/blocks", get(blocks))
        .route("/v1/accounts/:address", get(account))
        .route("/v1/transactions", post(submit_transaction))
        .route("/dev/faucet", post(faucet))
        .route("/dev/produce-block", post(produce_block))
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}

async fn status(State(state): State<AppState>) -> Json<crate::types::NetworkStatus> {
    Json(state.ledger.read().await.status())
}

async fn blocks(State(state): State<AppState>) -> Json<Vec<Block>> {
    Json(state.ledger.read().await.blocks().to_vec())
}

async fn account(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> Result<Json<Account>, (StatusCode, Json<ErrorResponse>)> {
    let decoded = hex::decode(&address).map_err(|_| api_error(StatusCode::BAD_REQUEST, "address must be hexadecimal"))?;
    if decoded.len() != 32 {
        return Err(api_error(StatusCode::BAD_REQUEST, "address must be 32 bytes"));
    }
    Ok(Json(state.ledger.read().await.account(&address)))
}

async fn submit_transaction(
    State(state): State<AppState>,
    Json(tx): Json<Transaction>,
) -> Result<(StatusCode, Json<SubmitResponse>), (StatusCode, Json<ErrorResponse>)> {
    tx.verify(CHAIN_ID).map_err(|error| api_error(StatusCode::BAD_REQUEST, &error.to_string()))?;

    // Keep lock order consistent with block production: mempool, then ledger.
    let mut mempool = state.mempool.lock().await;
    {
        let ledger = state.ledger.read().await;
        ledger.validate_mempool_transaction(&mempool, &tx)
            .map_err(|error| api_error(StatusCode::BAD_REQUEST, &error.to_string()))?;
    }
    if mempool.len() >= 10_000 {
        return Err(api_error(StatusCode::SERVICE_UNAVAILABLE, "mempool is full"));
    }
    let transaction_id = tx.id();
    if mempool.iter().any(|pending| pending.id() == transaction_id) {
        return Err(api_error(StatusCode::CONFLICT, "transaction already in mempool"));
    }
    mempool.push(tx);
    Ok((StatusCode::ACCEPTED, Json(SubmitResponse {
        accepted: true,
        transaction_id,
        mempool_size: mempool.len(),
    })))
}

async fn faucet(
    State(state): State<AppState>,
    Json(request): Json<FaucetRequest>,
) -> Result<Json<Account>, (StatusCode, Json<ErrorResponse>)> {
    if !state.dev_mode {
        return Err(api_error(StatusCode::FORBIDDEN, "development faucet is disabled"));
    }
    if request.amount > 1_000 * crate::types::BASE_UNITS_PER_BLOB {
        return Err(api_error(StatusCode::BAD_REQUEST, "faucet limit is 1,000 BLOB per request"));
    }
    let mut ledger = state.ledger.write().await;
    ledger.credit_dev_account(&request.address, request.amount)
        .map_err(|error| api_error(StatusCode::BAD_REQUEST, &error.to_string()))?;
    Ok(Json(ledger.account(&request.address)))
}

async fn produce_block(
    State(state): State<AppState>,
) -> Result<Json<ProduceResponse>, (StatusCode, Json<ErrorResponse>)> {
    if !state.dev_mode {
        return Err(api_error(StatusCode::FORBIDDEN, "manual block production is disabled"));
    }

    let mut mempool = state.mempool.lock().await;
    if mempool.is_empty() {
        return Err(api_error(StatusCode::BAD_REQUEST, "mempool is empty"));
    }
    let pending = mempool.clone();
    let mut ledger = state.ledger.write().await;
    match ledger.produce_block(pending) {
        Ok(block) => {
            mempool.clear();
            Ok(Json(ProduceResponse {
                produced: true,
                block,
                remaining_mempool: mempool.len(),
            }))
        }
        Err(error) => {
            Err(api_error(StatusCode::BAD_REQUEST, &ledger_error_message(error)))
        }
    }
}

fn ledger_error_message(error: LedgerError) -> String {
    error.to_string()
}

fn api_error(status: StatusCode, message: &str) -> (StatusCode, Json<ErrorResponse>) {
    (status, Json(ErrorResponse { error: message.to_owned() }))
}

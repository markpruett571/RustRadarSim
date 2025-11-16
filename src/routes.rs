use crate::handlers::{analysis_websocket_handler, analyze_handler, simulate_handler, websocket_handler};
use axum::routing::{get, post};
use axum::Router;

pub fn create_router() -> Router {
    Router::new()
        .route("/api/simulate", get(simulate_handler))
        .route("/api/analyze", post(analyze_handler))
        .route("/ws", get(websocket_handler))
        .route("/ws/analyze", get(analysis_websocket_handler))
}


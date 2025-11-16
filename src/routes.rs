use crate::handlers::{analysis_websocket_handler, simulate_handler, websocket_handler};
use axum::routing::get;
use axum::Router;

pub fn create_router() -> Router {
    Router::new()
        .route("/api/simulate", get(simulate_handler))
        .route("/ws", get(websocket_handler))
        .route("/ws/analyze", get(analysis_websocket_handler))
}


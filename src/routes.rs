use crate::handlers::{analysis_websocket_handler, analyze_handler, websocket_handler};
use crate::observability::{health_handler, metrics_handler, AppMetrics};
use axum::routing::{get, post};
use axum::Router;
use std::sync::Arc;

pub fn create_router(metrics: Arc<AppMetrics>) -> Router {
    Router::new()
        .route("/api/analyze", post(analyze_handler))
        .route("/ws", get(websocket_handler))
        .route("/ws/analyze", get(analysis_websocket_handler))
        .route("/health", get(health_handler))
        .route("/metrics", get(metrics_handler))
        .with_state(metrics)
}


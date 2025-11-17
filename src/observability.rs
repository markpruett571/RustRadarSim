use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::RwLock;
use tracing::info;

/// Application health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub status: String,
    pub version: String,
    pub uptime_seconds: u64,
    pub checks: HealthChecks,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthChecks {
    pub api: String,
    pub websocket: String,
    pub analysis_service: String,
}

/// Application metrics
#[derive(Debug, Clone)]
pub struct AppMetrics {
    pub start_time: Instant,
    pub total_requests: Arc<RwLock<u64>>,
    pub successful_requests: Arc<RwLock<u64>>,
    pub failed_requests: Arc<RwLock<u64>>,
    pub active_websocket_connections: Arc<RwLock<u32>>,
    pub analysis_operations: Arc<RwLock<u64>>,
}

impl AppMetrics {
    pub fn new() -> Self {
        Self {
            start_time: Instant::now(),
            total_requests: Arc::new(RwLock::new(0)),
            successful_requests: Arc::new(RwLock::new(0)),
            failed_requests: Arc::new(RwLock::new(0)),
            active_websocket_connections: Arc::new(RwLock::new(0)),
            analysis_operations: Arc::new(RwLock::new(0)),
        }
    }

    pub async fn increment_requests(&self) {
        *self.total_requests.write().await += 1;
    }

    pub async fn increment_success(&self) {
        *self.successful_requests.write().await += 1;
    }

    pub async fn increment_failure(&self) {
        *self.failed_requests.write().await += 1;
    }

    pub async fn increment_websocket_connection(&self) {
        *self.active_websocket_connections.write().await += 1;
    }

    pub async fn decrement_websocket_connection(&self) {
        let mut count = self.active_websocket_connections.write().await;
        if *count > 0 {
            *count -= 1;
        }
    }

    pub async fn increment_analysis(&self) {
        *self.analysis_operations.write().await += 1;
    }

    pub fn uptime_seconds(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }
}

impl Default for AppMetrics {
    fn default() -> Self {
        Self::new()
    }
}

/// Health check endpoint handler
pub async fn health_handler(State(metrics): State<Arc<AppMetrics>>) -> impl IntoResponse {
    let uptime = metrics.uptime_seconds();

    let health = HealthStatus {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: uptime,
        checks: HealthChecks {
            api: "ok".to_string(),
            websocket: "ok".to_string(),
            analysis_service: "ok".to_string(),
        },
    };

    info!(
        "Health check requested - status: healthy, uptime: {}s",
        uptime
    );
    (StatusCode::OK, Json(health))
}

/// Metrics endpoint handler
#[derive(Debug, Serialize)]
pub struct MetricsResponse {
    pub uptime_seconds: u64,
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub active_websocket_connections: u32,
    pub analysis_operations: u64,
    pub success_rate: f64,
}

pub async fn metrics_handler(State(metrics): State<Arc<AppMetrics>>) -> impl IntoResponse {
    let uptime = metrics.uptime_seconds();
    let total = *metrics.total_requests.read().await;
    let success = *metrics.successful_requests.read().await;
    let failed = *metrics.failed_requests.read().await;
    let ws_connections = *metrics.active_websocket_connections.read().await;
    let analysis_ops = *metrics.analysis_operations.read().await;

    let success_rate = if total > 0 {
        (success as f64 / total as f64) * 100.0
    } else {
        100.0
    };

    let response = MetricsResponse {
        uptime_seconds: uptime,
        total_requests: total,
        successful_requests: success,
        failed_requests: failed,
        active_websocket_connections: ws_connections,
        analysis_operations: analysis_ops,
        success_rate,
    };

    (StatusCode::OK, Json(response))
}

/// Initialize tracing subscriber for structured logging
pub fn init_tracing() {
    let filter =
        std::env::var("RUST_LOG").unwrap_or_else(|_| "radar_sim=info,tower_http=info".to_string());

    let filter_clone = filter.clone();
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .with_thread_ids(false)
        .with_thread_names(false)
        .json()
        .init();

    info!("Tracing initialized with filter: {}", filter_clone);
}

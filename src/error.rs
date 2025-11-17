use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;
use tracing::error;

/// Application error types
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Analysis error: {0}")]
    AnalysisError(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("WebSocket error: {0}")]
    WebSocketError(String),

    #[error("Internal server error: {0}")]
    InternalError(String),

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Timeout: {0}")]
    Timeout(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::AnalysisError(msg) => {
                error!("Analysis error: {}", msg);
                (StatusCode::BAD_REQUEST, msg)
            }
            AppError::InvalidInput(msg) => {
                error!("Invalid input: {}", msg);
                (StatusCode::BAD_REQUEST, msg)
            }
            AppError::WebSocketError(msg) => {
                error!("WebSocket error: {}", msg);
                (StatusCode::BAD_REQUEST, msg)
            }
            AppError::InternalError(msg) => {
                error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, msg)
            }
            AppError::ServiceUnavailable(msg) => {
                error!("Service unavailable: {}", msg);
                (StatusCode::SERVICE_UNAVAILABLE, msg)
            }
            AppError::Timeout(msg) => {
                error!("Timeout: {}", msg);
                (StatusCode::REQUEST_TIMEOUT, msg)
            }
        };

        let body = Json(json!({
            "error": error_message,
            "status": status.as_u16(),
        }));

        (status, body).into_response()
    }
}

/// Result type alias for application errors
pub type AppResult<T> = Result<T, AppError>;

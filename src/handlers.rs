use crate::analysis::analyze_drone;
use crate::types::{
    AnalysisWebSocketMessage, TargetPosition, DroneAnalysis, WebSocketMessage,
};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::Json,
    http::StatusCode,
};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::Mutex;

#[utoipa::path(
    post,
    path = "/api/analyze",
    request_body = TargetPosition,
    responses(
        (status = 200, description = "Analysis result", body = DroneAnalysis),
        (status = 400, description = "Bad request")
    ),
    tag = "Analysis"
)]
pub async fn analyze_handler(
    axum::extract::Json(target): axum::extract::Json<TargetPosition>,
) -> Result<Json<DroneAnalysis>, StatusCode> {
    // Run analysis on a separate thread (blocking task)
    // This ensures it doesn't block the async runtime
    let analysis_result = tokio::task::spawn_blocking(move || {
        analyze_drone(&target)
    }).await;

    match analysis_result {
        Ok(analysis) => Ok(Json(analysis)),
        Err(e) => {
            eprintln!("Analysis task error: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn websocket_handler(ws: WebSocketUpgrade) -> axum::response::Response {
    ws.on_upgrade(handle_socket)
}

pub async fn analysis_websocket_handler(ws: WebSocketUpgrade) -> axum::response::Response {
    ws.on_upgrade(handle_analysis_socket)
}

async fn handle_socket(socket: WebSocket) {
    let (sender, mut receiver) = socket.split();
    let sender_arc = Arc::new(Mutex::new(sender));
    let mut tracking_handle: Option<tokio::task::JoinHandle<()>> = None;

    // Handle incoming messages
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                match serde_json::from_str::<WebSocketMessage>(&text) {
                    Ok(WebSocketMessage::StartTracking) => {
                        // Stop existing tracking if any
                        if let Some(handle) = tracking_handle.take() {
                            handle.abort();
                        }

                        // Start new tracking with default drone targets
                        let sender_clone = sender_arc.clone();
                        // Default drone targets for demonstration
                        let mut target_positions: Vec<TargetPosition> = vec![
                            TargetPosition {
                                id: 0,
                                range_m: 10_000.0,
                                azimuth_deg: 0.0,
                                vel_m_s: 30.0,
                                rcs: 1.0,
                            },
                            TargetPosition {
                                id: 1,
                                range_m: 15_000.0,
                                azimuth_deg: 120.0,
                                vel_m_s: -50.0,
                                rcs: 0.6,
                            },
                            TargetPosition {
                                id: 2,
                                range_m: 8_000.0,
                                azimuth_deg: 240.0,
                                vel_m_s: 25.0,
                                rcs: 0.8,
                            },
                        ];

                        let handle = tokio::spawn(async move {
                            let mut interval = tokio::time::interval(tokio::time::Duration::from_millis(100));
                            loop {
                                interval.tick().await;
                                
                                // Update target positions
                                for pos in &mut target_positions {
                                    // Update range based on velocity (negative velocity = moving away)
                                    pos.range_m += pos.vel_m_s * 0.1; // 0.1 seconds per update
                                    
                                    // Update azimuth (circular motion for demo)
                                    pos.azimuth_deg = (pos.azimuth_deg + 0.5) % 360.0;
                                    
                                    // Keep range within reasonable bounds
                                    if pos.range_m < 1000.0 {
                                        pos.range_m = 1000.0;
                                        pos.vel_m_s = -pos.vel_m_s; // Bounce back
                                    } else if pos.range_m > 50_000.0 {
                                        pos.range_m = 50_000.0;
                                        pos.vel_m_s = -pos.vel_m_s; // Bounce back
                                    }
                                }

                                // Send updated positions
                                let msg = WebSocketMessage::Targets {
                                    targets: target_positions.clone(),
                                };
                                if let Ok(json) = serde_json::to_string(&msg) {
                                    let mut s = sender_clone.lock().await;
                                    if s.send(Message::Text(json.into())).await.is_err() {
                                        break; // Connection closed
                                    }
                                }
                            }
                        });
                        tracking_handle = Some(handle);
                    }
                    Ok(_) => {
                        // Other message types can be handled here
                    }
                    Err(e) => {
                        let error_msg = WebSocketMessage::Error {
                            message: format!("Invalid message format: {}", e),
                        };
                        if let Ok(json) = serde_json::to_string(&error_msg) {
                            let mut s = sender_arc.lock().await;
                            let _ = s.send(Message::Text(json.into())).await;
                        }
                    }
                }
            }
            Message::Close(_) => {
                if let Some(handle) = tracking_handle.take() {
                    handle.abort();
                }
                break;
            }
            _ => {}
        }
    }
}

async fn handle_analysis_socket(socket: WebSocket) {
    let (sender, mut receiver) = socket.split();
    let sender_arc = Arc::new(Mutex::new(sender));
    
    // Handle incoming messages
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                match serde_json::from_str::<AnalysisWebSocketMessage>(&text) {
                    Ok(AnalysisWebSocketMessage::Analyze { drone_id, target }) => {
                        // Send status update
                        let status = AnalysisWebSocketMessage::AnalysisStatus {
                            message: format!("Analyzing drone #{}...", drone_id),
                        };
                        if let Ok(json) = serde_json::to_string(&status) {
                            let mut s = sender_arc.lock().await;
                            let _ = s.send(Message::Text(json.into())).await;
                        }
                        
                        // Run analysis on a separate thread (blocking task)
                        // This ensures it doesn't block the async runtime
                        let sender_clone = sender_arc.clone();
                        let analysis_result = tokio::task::spawn_blocking(move || {
                            analyze_drone(&target)
                        }).await;
                        
                        match analysis_result {
                            Ok(analysis) => {
                                let response = AnalysisWebSocketMessage::AnalysisResult { analysis };
                                if let Ok(json) = serde_json::to_string(&response) {
                                    let mut s = sender_clone.lock().await;
                                    let _ = s.send(Message::Text(json.into())).await;
                                }
                            }
                            Err(e) => {
                                let error_msg = AnalysisWebSocketMessage::AnalysisError {
                                    message: format!("Analysis task error: {}", e),
                                };
                                if let Ok(json) = serde_json::to_string(&error_msg) {
                                    let mut s = sender_clone.lock().await;
                                    let _ = s.send(Message::Text(json.into())).await;
                                }
                            }
                        }
                    }
                    Ok(_) => {
                        // Other message types
                    }
                    Err(e) => {
                        let error_msg = AnalysisWebSocketMessage::AnalysisError {
                            message: format!("Invalid message format: {}", e),
                        };
                        if let Ok(json) = serde_json::to_string(&error_msg) {
                            let mut s = sender_arc.lock().await;
                            let _ = s.send(Message::Text(json.into())).await;
                        }
                    }
                }
            }
            Message::Close(_) => {
                break;
            }
            _ => {}
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use crate::routes::create_router;
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_analyze_handler_success() {
        let app = create_router();
        
        let target = TargetPosition {
            id: 1,
            range_m: 10_000.0,
            azimuth_deg: 45.0,
            vel_m_s: 30.0,
            rcs: 0.8,
        };

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/analyze")
                    .method("POST")
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&target).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let analysis: DroneAnalysis = serde_json::from_slice(&body).unwrap();
        
        assert_eq!(analysis.drone_id, 1);
        assert!(!analysis.threat_level.is_empty());
        assert!(!analysis.estimated_type.is_empty());
        assert!(analysis.confidence > 0.0 && analysis.confidence <= 1.0);
        assert!(!analysis.recommendations.is_empty());
    }

    #[tokio::test]
    async fn test_analyze_handler_invalid_json() {
        let app = create_router();
        
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/analyze")
                    .method("POST")
                    .header("content-type", "application/json")
                    .body(Body::from("invalid json"))
                    .unwrap(),
            )
            .await
            .unwrap();

        // Should return 400 Bad Request for invalid JSON
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_analyze_handler_missing_body() {
        let app = create_router();
        
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/analyze")
                    .method("POST")
                    .header("content-type", "application/json")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        // Should return 400 Bad Request for missing body
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_analyze_handler_different_targets() {
        let app = create_router();
        
        let targets = vec![
            TargetPosition {
                id: 1,
                range_m: 3_000.0,
                azimuth_deg: 0.0,
                vel_m_s: 50.0,
                rcs: 0.9,
            },
            TargetPosition {
                id: 2,
                range_m: 20_000.0,
                azimuth_deg: 180.0,
                vel_m_s: 15.0,
                rcs: 0.5,
            },
        ];

        for target in targets {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri("/api/analyze")
                        .method("POST")
                        .header("content-type", "application/json")
                        .body(Body::from(serde_json::to_string(&target).unwrap()))
                        .unwrap(),
                )
                .await
                .unwrap();

            assert_eq!(response.status(), StatusCode::OK);
            
            let body = response.into_body().collect().await.unwrap().to_bytes();
            let analysis: DroneAnalysis = serde_json::from_slice(&body).unwrap();
            
            assert_eq!(analysis.drone_id, target.id);
            assert!(!analysis.threat_level.is_empty());
        }
    }
}


use crate::analysis::analyze_drone;
use crate::simulation::run_simulation;
use crate::types::{
    AnalysisWebSocketMessage, SimulationParams, SimulationResult, SimulationConfig,
    Target, TargetPosition, WebSocketMessage, DroneAnalysis,
};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query,
    },
    response::Json,
    http::StatusCode,
};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[utoipa::path(
    get,
    path = "/api/simulate",
    params(
        ("fc" = Option<f64>, Query, description = "Carrier frequency in Hz (default: 10 GHz)"),
        ("fs" = Option<f64>, Query, description = "Sampling rate in Hz (default: 1 MHz)"),
        ("prf" = Option<f64>, Query, description = "Pulse repetition frequency in Hz (default: 500 Hz)"),
        ("num_pulses" = Option<usize>, Query, description = "Number of pulses (default: 32)"),
        ("pulse_width" = Option<f64>, Query, description = "Pulse width in seconds (default: 50 μs)"),
        ("noise_sigma" = Option<f64>, Query, description = "Noise standard deviation (default: 0.1)"),
    ),
    responses(
        (status = 200, description = "Simulation result", body = SimulationResult)
    ),
    tag = "Simulation"
)]
pub async fn simulate_handler(_query: Query<HashMap<String, String>>) -> Json<SimulationResult> {
    // Use fixed radar parameters optimized for drone detection
    let sim_params = SimulationParams {
        fc: None,        // Will use default 10 GHz
        fs: None,        // Will use default 1 MHz
        prf: None,       // Will use default 500 Hz
        num_pulses: None, // Will use default 32
        pulse_width: None, // Will use default 50 μs
        noise_sigma: None, // Will use default 0.1
        targets: None,   // Use defaults
    };

    match run_simulation(sim_params) {
        Ok(result) => Json(result),
        Err(e) => {
            eprintln!("Simulation error: {}", e);
            // Return a default/empty result on error
            Json(SimulationResult {
                range_doppler_map: vec![],
                range_profile: vec![],
                config: SimulationConfig {
                    n_range_bins: 0,
                    n_doppler_bins: 0,
                    fs: 1.0e6,
                    prf: 500.0,
                    fc: 10.0e9,
                },
            })
        }
    }
}

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

async fn handle_socket(socket: WebSocket) {
    let (sender, mut receiver) = socket.split();
    let sender_arc = Arc::new(Mutex::new(sender));
    let mut tracking_handle: Option<tokio::task::JoinHandle<()>> = None;

    // Handle incoming messages
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                match serde_json::from_str::<WebSocketMessage>(&text) {
                    Ok(WebSocketMessage::Simulate { params: _ }) => {
                        // Send status update
                        let status = WebSocketMessage::Status {
                            message: "Running simulation...".to_string(),
                        };
                        if let Ok(json) = serde_json::to_string(&status) {
                            let mut s = sender_arc.lock().await;
                            let _ = s.send(Message::Text(json.into())).await;
                        }

                        // Run simulation with fixed parameters
                        let sender_clone = sender_arc.clone();
                        let sim_params = SimulationParams {
                            fc: None,
                            fs: None,
                            prf: None,
                            num_pulses: None,
                            pulse_width: None,
                            noise_sigma: None,
                            targets: None,
                        };
                        let result = tokio::task::spawn_blocking(move || {
                            run_simulation(sim_params)
                        })
                        .await;

                        match result {
                            Ok(Ok(sim_result)) => {
                                let response = WebSocketMessage::Result(sim_result);
                                if let Ok(json) = serde_json::to_string(&response) {
                                    let mut s = sender_clone.lock().await;
                                    let _ = s.send(Message::Text(json.into())).await;
                                }
                            }
                            Ok(Err(e)) => {
                                let error_msg = WebSocketMessage::Error {
                                    message: e.to_string(),
                                };
                                if let Ok(json) = serde_json::to_string(&error_msg) {
                                    let mut s = sender_clone.lock().await;
                                    let _ = s.send(Message::Text(json.into())).await;
                                }
                            }
                            Err(e) => {
                                let error_msg = WebSocketMessage::Error {
                                    message: format!("Task error: {}", e),
                                };
                                if let Ok(json) = serde_json::to_string(&error_msg) {
                                    let mut s = sender_clone.lock().await;
                                    let _ = s.send(Message::Text(json.into())).await;
                                }
                            }
                        }
                    }
                    Ok(WebSocketMessage::StartTracking { params: _ }) => {
                        // Stop existing tracking if any
                        if let Some(handle) = tracking_handle.take() {
                            handle.abort();
                        }

                        // Start new tracking with fixed default drone targets
                        let sender_clone = sender_arc.clone();
                        // Default drone targets for demonstration
                        let targets = vec![
                            Target { range_m: 10_000.0, vel_m_s: 30.0, rcs: 1.0 },
                            Target { range_m: 15_000.0, vel_m_s: -50.0, rcs: 0.6 },
                            Target { range_m: 8_000.0, vel_m_s: 25.0, rcs: 0.8 },
                        ];

                        // Convert targets to initial positions with azimuth
                        let mut target_positions: Vec<TargetPosition> = targets
                            .iter()
                            .enumerate()
                            .map(|(id, t)| TargetPosition {
                                id,
                                range_m: t.range_m,
                                azimuth_deg: (id as f64 * 120.0) % 360.0, // Spread targets around
                                vel_m_s: t.vel_m_s,
                                rcs: t.rcs,
                            })
                            .collect();

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


use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query,
    },
    http::Method,
    response::{Json, Response},
    routing::get,
    Router,
};
use ndarray::prelude::*;
use num_complex::Complex;
use rand_distr::{Distribution, Normal};
use serde::{Deserialize, Serialize};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::f64::consts::PI;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};

/// Physical constants
const C: f64 = 299_792_458.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Target {
    range_m: f64,
    vel_m_s: f64,
    rcs: f64, // amplitude scaling (simple)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SimulationParams {
    fc: Option<f64>,        // carrier frequency (Hz)
    fs: Option<f64>,        // sampling rate (Hz)
    prf: Option<f64>,       // pulses per second
    num_pulses: Option<usize>,
    pulse_width: Option<f64>, // pulse width (seconds)
    noise_sigma: Option<f64>,
    targets: Option<Vec<Target>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SimulationResult {
    range_doppler_map: Vec<Vec<f64>>, // [range_bins][doppler_bins]
    range_profile: Vec<f64>,          // averaged magnitude per range bin
    config: SimulationConfig,
}

#[derive(Debug, Serialize, Deserialize)]
struct SimulationConfig {
    n_range_bins: usize,
    n_doppler_bins: usize,
    fs: f64,
    prf: f64,
    fc: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TargetPosition {
    id: usize,
    range_m: f64,
    azimuth_deg: f64, // Angle in degrees (0-360)
    vel_m_s: f64,
    rcs: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum WebSocketMessage {
    #[serde(rename = "simulate")]
    Simulate { params: SimulationParams },
    #[serde(rename = "result")]
    Result(SimulationResult),
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "status")]
    Status { message: String },
    #[serde(rename = "targets")]
    Targets { targets: Vec<TargetPosition> },
    #[serde(rename = "start_tracking")]
    StartTracking { params: SimulationParams },
}

fn run_simulation(params: SimulationParams) -> Result<SimulationResult, Box<dyn std::error::Error + Send + Sync>> {
    // Default parameters
    let fc = params.fc.unwrap_or(10.0e9);
    let lambda = C / fc;
    let fs = params.fs.unwrap_or(1.0e6);
    let prf = params.prf.unwrap_or(500.0);
    let pri = 1.0 / prf;
    let num_pulses = params.num_pulses.unwrap_or(32);
    let pulse_width = params.pulse_width.unwrap_or(50e-6);
    let noise_sigma = params.noise_sigma.unwrap_or(0.1);

    // fast-time samples per PRI
    let n_fast = (pri * fs) as usize;
    let pulse_len = ((pulse_width * fs) as usize).max(1);

    // Make transmit pulse envelope (rectangular window)
    let tx_pulse: Vec<Complex<f64>> = (0..pulse_len)
        .map(|_| Complex::new(1.0f64, 0.0))
        .collect();

    // Define targets
    let targets = params.targets.unwrap_or_else(|| {
        vec![
            Target { range_m: 10_000.0, vel_m_s: 30.0, rcs: 1.0 },
            Target { range_m: 15_000.0, vel_m_s: -50.0, rcs: 0.6 },
        ]
    });

    // Pre-calc delays in samples and Doppler freqs
    let mut t_delay_samples: Vec<usize> = Vec::new();
    let mut fd_hz: Vec<f64> = Vec::new();
    for tg in &targets {
        let tau = 2.0 * tg.range_m / C;
        let delay_samples = (tau * fs).round() as isize;
        let delay_samples = if delay_samples < 0 { 0 } else { delay_samples as usize };
        t_delay_samples.push(delay_samples);
        let fd = 2.0 * tg.vel_m_s / lambda;
        fd_hz.push(fd);
    }

    // Prepare RNG for gaussian noise
    let gauss = Normal::new(0.0, noise_sigma)
        .map_err(|e| format!("Failed to create Normal distribution: {}", e))?;
    let mut rng = rand::thread_rng();

    // Container for matched filter outputs across pulses
    let n_range_bins = n_fast.saturating_sub(pulse_len) + 1;
    let mut rd_matrix = Array2::<f64>::zeros((n_range_bins, num_pulses));

    // For each pulse:
    for p in 0..num_pulses {
        let mut rx = vec![Complex::new(0.0, 0.0); n_fast];
        let t0 = p as f64 * pri;

        // add echoes from each target
        for (ti, tg) in targets.iter().enumerate() {
            let delay = t_delay_samples[ti];
            let fd = fd_hz[ti];
            for n in 0..pulse_len {
                let fast_idx = delay + n;
                if fast_idx >= n_fast {
                    break;
                }
                let t_abs = t0 + (fast_idx as f64) / fs;
                let phase = 2.0 * PI * fd * t_abs;
                let ph = Complex::from_polar(1.0, phase);
                let amp = tg.rcs;
                rx[fast_idx] += ph * tx_pulse[n] * amp;
            }
        }

        // add gaussian noise
        for n in 0..n_fast {
            let nr = gauss.sample(&mut rng);
            let ni = gauss.sample(&mut rng);
            rx[n] += Complex::new(nr, ni);
        }

        // matched filter
        let mut mf = vec![Complex::new(0.0, 0.0); n_range_bins];
        for k in 0..n_range_bins {
            let mut acc = Complex::new(0.0, 0.0);
            for m in 0..pulse_len {
                acc += rx[k + m] * tx_pulse[m].conj();
            }
            mf[k] = acc;
        }

        // Save magnitude into matrix
        for (rbin, &val) in mf.iter().enumerate() {
            rd_matrix[(rbin, p)] = val.norm();
        }
    }

    // Compute range-Doppler map
    let n_doppler = num_pulses;
    let mut rd_map = Array2::<f64>::zeros((n_range_bins, n_doppler));

    for r in 0..n_range_bins {
        let mut slow_time = vec![Complex::new(0.0, 0.0); num_pulses];
        for p in 0..num_pulses {
            let mut acc = Complex::new(0.0, 0.0);
            let t0 = p as f64 * pri;
            for (ti, tg) in targets.iter().enumerate() {
                let _delay = t_delay_samples[ti];
                let fd = fd_hz[ti];
                let center_fast_idx = r + pulse_len / 2;
                if center_fast_idx >= n_fast {
                    continue;
                }
                let t_abs = t0 + (center_fast_idx as f64) / fs;
                let phase = 2.0 * PI * fd * t_abs;
                let ph = Complex::from_polar(1.0, phase);
                acc += ph * Complex::new(tg.rcs, 0.0);
            }
            let nr = gauss.sample(&mut rng) * 0.01;
            let ni = gauss.sample(&mut rng) * 0.01;
            slow_time[p] = acc + Complex::new(nr, ni);
        }

        // DFT (slow-time) -> get doppler bins
        for k in 0..n_doppler {
            let mut sum = Complex::new(0.0, 0.0);
            for (n, &st) in slow_time.iter().enumerate() {
                let angle = -2.0 * PI * (k as f64) * (n as f64) / (n_doppler as f64);
                let tw = Complex::from_polar(1.0, angle);
                sum += st * tw;
            }
            rd_map[(r, k)] = sum.norm();
        }
    }

    // Convert to Vec<Vec<f64>> for JSON serialization
    let mut rd_map_vec = Vec::new();
    for r in 0..n_range_bins {
        let mut row = Vec::new();
        for k in 0..n_doppler {
            row.push(rd_map[(r, k)]);
        }
        rd_map_vec.push(row);
    }

    // Compute range profile (averaged over pulses)
    let mut range_profile = Vec::new();
    for r in 0..n_range_bins {
        let avg: f64 = rd_matrix.slice(s![r, ..]).mean().unwrap_or(0.0);
        range_profile.push(avg);
    }

    Ok(SimulationResult {
        range_doppler_map: rd_map_vec,
        range_profile,
        config: SimulationConfig {
            n_range_bins,
            n_doppler_bins: n_doppler,
            fs,
            prf,
            fc,
        },
    })
}

async fn simulate_handler(Query(params): Query<HashMap<String, String>>) -> Json<SimulationResult> {
    let sim_params = SimulationParams {
        fc: params.get("fc").and_then(|s| s.parse().ok()),
        fs: params.get("fs").and_then(|s| s.parse().ok()),
        prf: params.get("prf").and_then(|s| s.parse().ok()),
        num_pulses: params.get("num_pulses").and_then(|s| s.parse().ok()),
        pulse_width: params.get("pulse_width").and_then(|s| s.parse().ok()),
        noise_sigma: params.get("noise_sigma").and_then(|s| s.parse().ok()),
        targets: None, // For now, use defaults
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

async fn websocket_handler(ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(socket: WebSocket) {
    let (mut sender, mut receiver) = socket.split();
    let sender_arc = Arc::new(Mutex::new(sender));
    let mut tracking_handle: Option<tokio::task::JoinHandle<()>> = None;

    // Handle incoming messages
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                match serde_json::from_str::<WebSocketMessage>(&text) {
                    Ok(WebSocketMessage::Simulate { params }) => {
                        // Send status update
                        let status = WebSocketMessage::Status {
                            message: "Running simulation...".to_string(),
                        };
                        if let Ok(json) = serde_json::to_string(&status) {
                            let mut s = sender_arc.lock().await;
                            let _ = s.send(Message::Text(json)).await;
                        }

                        // Run simulation in a blocking task
                        let params_clone = params.clone();
                        let sender_clone = sender_arc.clone();
                        let result = tokio::task::spawn_blocking(move || {
                            run_simulation(params_clone)
                        })
                        .await;

                        match result {
                            Ok(Ok(sim_result)) => {
                                let response = WebSocketMessage::Result(sim_result);
                                if let Ok(json) = serde_json::to_string(&response) {
                                    let mut s = sender_clone.lock().await;
                                    let _ = s.send(Message::Text(json)).await;
                                }
                            }
                            Ok(Err(e)) => {
                                let error_msg = WebSocketMessage::Error {
                                    message: e.to_string(),
                                };
                                if let Ok(json) = serde_json::to_string(&error_msg) {
                                    let mut s = sender_clone.lock().await;
                                    let _ = s.send(Message::Text(json)).await;
                                }
                            }
                            Err(e) => {
                                let error_msg = WebSocketMessage::Error {
                                    message: format!("Task error: {}", e),
                                };
                                if let Ok(json) = serde_json::to_string(&error_msg) {
                                    let mut s = sender_clone.lock().await;
                                    let _ = s.send(Message::Text(json)).await;
                                }
                            }
                        }
                    }
                    Ok(WebSocketMessage::StartTracking { params }) => {
                        // Stop existing tracking if any
                        if let Some(handle) = tracking_handle.take() {
                            handle.abort();
                        }

                        // Start new tracking
                        let sender_clone = sender_arc.clone();
                        let targets = params.targets.clone().unwrap_or_else(|| {
                            vec![
                                Target { range_m: 10_000.0, vel_m_s: 30.0, rcs: 1.0 },
                                Target { range_m: 15_000.0, vel_m_s: -50.0, rcs: 0.6 },
                            ]
                        });

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
                                    if s.send(Message::Text(json)).await.is_err() {
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
                            let _ = s.send(Message::Text(json)).await;
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

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/simulate", get(simulate_handler))
        .route("/ws", get(websocket_handler))
        .layer(cors);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001").await?;
    println!("Server running on http://127.0.0.1:3001");
    println!("API endpoint: http://127.0.0.1:3001/api/simulate");
    println!("WebSocket endpoint: ws://127.0.0.1:3001/ws");

    axum::serve(listener, app).await?;

    Ok(())
}

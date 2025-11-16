use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Target {
    /// Range in meters
    pub range_m: f64,
    /// Velocity in meters per second
    pub vel_m_s: f64,
    /// Radar cross section (amplitude scaling)
    pub rcs: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SimulationParams {
    /// Carrier frequency in Hz (default: 10 GHz)
    pub fc: Option<f64>,
    /// Sampling rate in Hz (default: 1 MHz)
    pub fs: Option<f64>,
    /// Pulse repetition frequency in Hz (default: 500 Hz)
    pub prf: Option<f64>,
    /// Number of pulses (default: 32)
    pub num_pulses: Option<usize>,
    /// Pulse width in seconds (default: 50 μs)
    pub pulse_width: Option<f64>,
    /// Noise standard deviation (default: 0.1)
    pub noise_sigma: Option<f64>,
    /// List of targets to simulate
    pub targets: Option<Vec<Target>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SimulationResult {
    /// Range-Doppler map as 2D array [range_bins][doppler_bins]
    pub range_doppler_map: Vec<Vec<f64>>,
    /// Averaged magnitude per range bin
    pub range_profile: Vec<f64>,
    /// Simulation configuration used
    pub config: SimulationConfig,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SimulationConfig {
    /// Number of range bins
    pub n_range_bins: usize,
    /// Number of Doppler bins
    pub n_doppler_bins: usize,
    /// Sampling rate in Hz
    pub fs: f64,
    /// Pulse repetition frequency in Hz
    pub prf: f64,
    /// Carrier frequency in Hz
    pub fc: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TargetPosition {
    /// Target identifier
    pub id: usize,
    /// Range in meters
    pub range_m: f64,
    /// Azimuth angle in degrees (0-360)
    pub azimuth_deg: f64,
    /// Velocity in meters per second
    pub vel_m_s: f64,
    /// Radar cross section
    pub rcs: f64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type")]
#[schema(as = utoipa::openapi::Object)]
pub enum WebSocketMessage {
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

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type")]
#[schema(as = utoipa::openapi::Object)]
pub enum AnalysisWebSocketMessage {
    #[serde(rename = "analyze")]
    Analyze { drone_id: usize, target: TargetPosition },
    #[serde(rename = "analysis_result")]
    AnalysisResult { analysis: DroneAnalysis },
    #[serde(rename = "analysis_error")]
    AnalysisError { message: String },
    #[serde(rename = "analysis_status")]
    AnalysisStatus { message: String },
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DroneAnalysis {
    /// Drone identifier
    pub drone_id: usize,
    /// Threat level: "low", "medium", or "high"
    pub threat_level: String,
    /// Estimated drone type
    pub estimated_type: String,
    /// Confidence score (0.0 to 1.0)
    pub confidence: f64,
    /// Trajectory analysis results
    pub trajectory_analysis: TrajectoryAnalysis,
    /// Risk assessment results
    pub risk_assessment: RiskAssessment,
    /// List of recommendations
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct TrajectoryAnalysis {
    /// Heading in degrees
    pub heading_deg: f64,
    /// Speed in meters per second
    pub speed_m_s: f64,
    /// Estimated altitude in meters
    pub altitude_estimate_m: f64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RiskAssessment {
    /// Proximity risk score (0-100)
    pub proximity_risk: f64,
    /// Velocity risk score (0-100)
    pub velocity_risk: f64,
    /// Overall risk score (0-100)
    pub overall_risk: f64,
}


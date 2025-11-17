use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

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
    #[serde(rename = "start_tracking")]
    StartTracking,
    #[serde(rename = "targets")]
    Targets { targets: Vec<TargetPosition> },
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "status")]
    Status { message: String },
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


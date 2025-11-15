export interface SimulationConfig {
  n_range_bins: number
  n_doppler_bins: number
  fs: number
  prf: number
  fc: number
}

export interface SimulationResult {
  range_doppler_map: number[][]
  range_profile: number[]
  config: SimulationConfig
}

export interface SimulationParams {
  fc?: number
  fs?: number
  prf?: number
  num_pulses?: number
  pulse_width?: number
  noise_sigma?: number
}

export interface TargetPosition {
  id: number
  range_m: number
  azimuth_deg: number
  vel_m_s: number
  rcs: number
}

export interface DroneAnalysis {
  drone_id: number
  threat_level: 'low' | 'medium' | 'high'
  estimated_type: string
  confidence: number
  trajectory_analysis: {
    heading_deg: number
    speed_m_s: number
    altitude_estimate_m: number
  }
  risk_assessment: {
    proximity_risk: number
    velocity_risk: number
    overall_risk: number
  }
  recommendations: string[]
}

export type WebSocketMessage =
  | { type: 'simulate'; params: SimulationParams }
  | { type: 'result'; range_doppler_map: number[][]; range_profile: number[]; config: SimulationConfig }
  | { type: 'error'; message: string }
  | { type: 'status'; message: string }
  | { type: 'targets'; targets: TargetPosition[] }
  | { type: 'start_tracking'; params: SimulationParams }

export type AnalysisWebSocketMessage =
  | { type: 'analyze'; drone_id: number; target: TargetPosition }
  | { type: 'analysis_result'; analysis: DroneAnalysis }
  | { type: 'analysis_error'; message: string }
  | { type: 'analysis_status'; message: string }


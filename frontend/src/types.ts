
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
  | { type: 'start_tracking' }
  | { type: 'targets'; targets: TargetPosition[] }
  | { type: 'error'; message: string }
  | { type: 'status'; message: string }

export type AnalysisWebSocketMessage =
  | { type: 'analyze'; drone_id: number; target: TargetPosition }
  | { type: 'analysis_result'; analysis: DroneAnalysis }
  | { type: 'analysis_error'; message: string }
  | { type: 'analysis_status'; message: string }


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

export type WebSocketMessage =
  | { type: 'simulate'; params: SimulationParams }
  | { type: 'result'; range_doppler_map: number[][]; range_profile: number[]; config: SimulationConfig }
  | { type: 'error'; message: string }
  | { type: 'status'; message: string }
  | { type: 'targets'; targets: TargetPosition[] }
  | { type: 'start_tracking'; params: SimulationParams }


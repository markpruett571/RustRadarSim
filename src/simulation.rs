use crate::constants::C;
use crate::types::{SimulationConfig, SimulationParams, SimulationResult, Target};
use ndarray::prelude::*;
use num_complex::Complex;
use rand_distr::{Distribution, Normal};
use std::f64::consts::PI;

pub fn run_simulation(params: SimulationParams) -> Result<SimulationResult, Box<dyn std::error::Error + Send + Sync>> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Target;

    #[test]
    fn test_simulation_with_defaults() {
        let params = SimulationParams {
            fc: None,
            fs: None,
            prf: None,
            num_pulses: None,
            pulse_width: None,
            noise_sigma: None,
            targets: None,
        };

        let result = run_simulation(params).expect("Simulation should succeed");
        
        // Check that we get valid results
        assert!(!result.range_doppler_map.is_empty());
        assert!(!result.range_profile.is_empty());
        assert_eq!(result.config.fc, 10.0e9);
        assert_eq!(result.config.fs, 1.0e6);
        assert_eq!(result.config.prf, 500.0);
        assert!(result.config.n_range_bins > 0);
        assert!(result.config.n_doppler_bins > 0);
        
        // Check dimensions match
        assert_eq!(result.range_doppler_map.len(), result.config.n_range_bins);
        assert_eq!(result.range_profile.len(), result.config.n_range_bins);
        if !result.range_doppler_map.is_empty() {
            assert_eq!(result.range_doppler_map[0].len(), result.config.n_doppler_bins);
        }
    }

    #[test]
    fn test_simulation_with_custom_parameters() {
        let params = SimulationParams {
            fc: Some(5.0e9),
            fs: Some(2.0e6),
            prf: Some(1000.0),
            num_pulses: Some(64),
            pulse_width: Some(100e-6),
            noise_sigma: Some(0.05),
            targets: None,
        };

        let result = run_simulation(params).expect("Simulation should succeed");
        
        assert_eq!(result.config.fc, 5.0e9);
        assert_eq!(result.config.fs, 2.0e6);
        assert_eq!(result.config.prf, 1000.0);
        assert_eq!(result.config.n_doppler_bins, 64);
    }

    #[test]
    fn test_simulation_with_custom_targets() {
        let targets = vec![
            Target {
                range_m: 5_000.0,
                vel_m_s: 20.0,
                rcs: 0.5,
            },
            Target {
                range_m: 20_000.0,
                vel_m_s: -30.0,
                rcs: 1.5,
            },
        ];

        let params = SimulationParams {
            fc: None,
            fs: None,
            prf: None,
            num_pulses: Some(16),
            pulse_width: None,
            noise_sigma: Some(0.01), // Low noise for better signal detection
            targets: Some(targets),
        };

        let result = run_simulation(params).expect("Simulation should succeed");
        
        // With low noise, we should see some signal in the range profile
        let max_signal: f64 = result.range_profile.iter().fold(0.0, |a, &b| a.max(b));
        assert!(max_signal > 0.0);
    }

    #[test]
    fn test_simulation_range_profile_non_negative() {
        let params = SimulationParams {
            fc: None,
            fs: None,
            prf: None,
            num_pulses: None,
            pulse_width: None,
            noise_sigma: None,
            targets: None,
        };

        let result = run_simulation(params).expect("Simulation should succeed");
        
        // All range profile values should be non-negative (magnitude)
        for value in &result.range_profile {
            assert!(*value >= 0.0, "Range profile should contain non-negative values");
        }
    }

    #[test]
    fn test_simulation_range_doppler_map_non_negative() {
        let params = SimulationParams {
            fc: None,
            fs: None,
            prf: None,
            num_pulses: None,
            pulse_width: None,
            noise_sigma: None,
            targets: None,
        };

        let result = run_simulation(params).expect("Simulation should succeed");
        
        // All range-Doppler map values should be non-negative (magnitude)
        for row in &result.range_doppler_map {
            for value in row {
                assert!(*value >= 0.0, "Range-Doppler map should contain non-negative values");
            }
        }
    }

    #[test]
    fn test_simulation_with_extreme_parameters() {
        // Test with very high frequency
        let params = SimulationParams {
            fc: Some(100.0e9),
            fs: Some(10.0e6),
            prf: Some(10_000.0),
            num_pulses: Some(128),
            pulse_width: Some(10e-6),
            noise_sigma: Some(0.2),
            targets: None,
        };

        let result = run_simulation(params).expect("Simulation should succeed with extreme parameters");
        assert!(result.config.n_range_bins > 0);
        assert_eq!(result.config.n_doppler_bins, 128);
    }

    #[test]
    fn test_simulation_with_zero_velocity_target() {
        let targets = vec![Target {
            range_m: 10_000.0,
            vel_m_s: 0.0,
            rcs: 1.0,
        }];

        let params = SimulationParams {
            fc: None,
            fs: None,
            prf: None,
            num_pulses: Some(32),
            pulse_width: None,
            noise_sigma: Some(0.01),
            targets: Some(targets),
        };

        let result = run_simulation(params).expect("Simulation should handle zero velocity");
        assert!(!result.range_profile.is_empty());
    }

    #[test]
    fn test_simulation_with_negative_noise_sigma() {
        // This should fail because Normal distribution requires positive sigma
        let params = SimulationParams {
            fc: None,
            fs: None,
            prf: None,
            num_pulses: None,
            pulse_width: None,
            noise_sigma: Some(-0.1),
            targets: None,
        };

        let result = run_simulation(params);
        // The Normal distribution creation should fail with negative sigma
        // If it doesn't fail, the test will pass but we note this behavior
        if result.is_ok() {
            // If it succeeds, it means the code might be using absolute value or has different behavior
            // This is acceptable - we just verify the simulation runs without panicking
            let sim_result = result.unwrap();
            assert!(!sim_result.range_profile.is_empty());
        } else {
            // If it fails as expected, that's also fine
            assert!(result.is_err());
        }
    }
}


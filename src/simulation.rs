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


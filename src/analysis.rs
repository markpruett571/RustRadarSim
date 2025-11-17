use crate::types::{DroneAnalysis, RiskAssessment, TargetPosition, TrajectoryAnalysis};

pub fn analyze_drone(target: &TargetPosition) -> DroneAnalysis {
    // Simulate analysis computation (this would be more complex in reality)
    use std::time::Duration;
    std::thread::sleep(Duration::from_millis(500)); // Simulate processing time
    
    let speed = target.vel_m_s.abs();
    let range_km = target.range_m / 1000.0;
    
    // Determine threat level
    let threat_level = if range_km < 5.0 && speed > 40.0 {
        "high"
    } else if range_km < 10.0 || speed > 30.0 {
        "medium"
    } else {
        "low"
    };
    
    // Estimate drone type based on characteristics
    let estimated_type = if speed > 50.0 {
        "Racing/High-Speed"
    } else if target.rcs > 0.8 {
        "Commercial/Large"
    } else {
        "Consumer/Small"
    };
    
    // Calculate confidence based on RCS and consistency
    let confidence = (target.rcs * 0.6 + 0.4).min(1.0);
    
    // Trajectory analysis
    let heading_deg = target.azimuth_deg;
    let altitude_estimate_m = if range_km < 2.0 {
        50.0 + (range_km * 25.0)
    } else {
        100.0 + (range_km * 20.0)
    };
    
    // Risk assessment
    let proximity_risk = (1.0 - (range_km / 50.0).min(1.0)) * 100.0;
    let velocity_risk = (speed / 100.0).min(1.0) * 100.0;
    let overall_risk = (proximity_risk * 0.6 + velocity_risk * 0.4).min(100.0);
    
    // Generate recommendations
    let mut recommendations = Vec::new();
    if proximity_risk > 70.0 {
        recommendations.push("High proximity risk - consider immediate action".to_string());
    }
    if velocity_risk > 60.0 {
        recommendations.push("High velocity detected - monitor closely".to_string());
    }
    if range_km < 3.0 {
        recommendations.push("Drone in close range - alert security personnel".to_string());
    }
    if recommendations.is_empty() {
        recommendations.push("Continue monitoring - no immediate action required".to_string());
    }
    
    DroneAnalysis {
        drone_id: target.id,
        threat_level: threat_level.to_string(),
        estimated_type: estimated_type.to_string(),
        confidence,
        trajectory_analysis: TrajectoryAnalysis {
            heading_deg,
            speed_m_s: speed,
            altitude_estimate_m,
        },
        risk_assessment: RiskAssessment {
            proximity_risk,
            velocity_risk,
            overall_risk,
        },
        recommendations,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::TargetPosition;

    #[test]
    fn test_analyze_drone_high_threat() {
        let target = TargetPosition {
            id: 1,
            range_m: 3_000.0, // 3 km - close range
            azimuth_deg: 45.0,
            vel_m_s: 50.0, // High speed
            rcs: 0.9,
        };

        let analysis = analyze_drone(&target);
        
        assert_eq!(analysis.drone_id, 1);
        assert_eq!(analysis.threat_level, "high");
        assert!(analysis.confidence > 0.0 && analysis.confidence <= 1.0);
        assert_eq!(analysis.trajectory_analysis.speed_m_s, 50.0);
        assert_eq!(analysis.trajectory_analysis.heading_deg, 45.0);
        assert!(analysis.risk_assessment.overall_risk > 0.0);
        assert!(!analysis.recommendations.is_empty());
    }

    #[test]
    fn test_analyze_drone_medium_threat() {
        let target = TargetPosition {
            id: 2,
            range_m: 8_000.0, // 8 km
            azimuth_deg: 90.0,
            vel_m_s: 35.0, // Medium-high speed
            rcs: 0.7,
        };

        let analysis = analyze_drone(&target);
        
        assert_eq!(analysis.threat_level, "medium");
        assert_eq!(analysis.trajectory_analysis.speed_m_s, 35.0);
    }

    #[test]
    fn test_analyze_drone_low_threat() {
        let target = TargetPosition {
            id: 3,
            range_m: 20_000.0, // 20 km - far away
            azimuth_deg: 180.0,
            vel_m_s: 15.0, // Low speed
            rcs: 0.5,
        };

        let analysis = analyze_drone(&target);
        
        assert_eq!(analysis.threat_level, "low");
        assert_eq!(analysis.trajectory_analysis.speed_m_s, 15.0);
    }

    #[test]
    fn test_analyze_drone_racing_type() {
        let target = TargetPosition {
            id: 4,
            range_m: 10_000.0,
            azimuth_deg: 0.0,
            vel_m_s: 60.0, // Very high speed
            rcs: 0.6,
        };

        let analysis = analyze_drone(&target);
        
        assert_eq!(analysis.estimated_type, "Racing/High-Speed");
    }

    #[test]
    fn test_analyze_drone_commercial_type() {
        let target = TargetPosition {
            id: 5,
            range_m: 10_000.0,
            azimuth_deg: 0.0,
            vel_m_s: 20.0,
            rcs: 0.9, // Large RCS
        };

        let analysis = analyze_drone(&target);
        
        assert_eq!(analysis.estimated_type, "Commercial/Large");
    }

    #[test]
    fn test_analyze_drone_consumer_type() {
        let target = TargetPosition {
            id: 6,
            range_m: 10_000.0,
            azimuth_deg: 0.0,
            vel_m_s: 25.0,
            rcs: 0.5, // Small RCS
        };

        let analysis = analyze_drone(&target);
        
        assert_eq!(analysis.estimated_type, "Consumer/Small");
    }

    #[test]
    fn test_analyze_drone_confidence_calculation() {
        let target_high_rcs = TargetPosition {
            id: 7,
            range_m: 10_000.0,
            azimuth_deg: 0.0,
            vel_m_s: 20.0,
            rcs: 1.0,
        };

        let target_low_rcs = TargetPosition {
            id: 8,
            range_m: 10_000.0,
            azimuth_deg: 0.0,
            vel_m_s: 20.0,
            rcs: 0.1,
        };

        let analysis_high = analyze_drone(&target_high_rcs);
        let analysis_low = analyze_drone(&target_low_rcs);
        
        // Higher RCS should generally lead to higher confidence
        assert!(analysis_high.confidence >= analysis_low.confidence);
        assert!(analysis_high.confidence > 0.0 && analysis_high.confidence <= 1.0);
        assert!(analysis_low.confidence > 0.0 && analysis_low.confidence <= 1.0);
    }

    #[test]
    fn test_analyze_drone_risk_assessment() {
        let target_close = TargetPosition {
            id: 9,
            range_m: 1_000.0, // Very close
            azimuth_deg: 0.0,
            vel_m_s: 30.0,
            rcs: 0.8,
        };

        let target_far = TargetPosition {
            id: 10,
            range_m: 40_000.0, // Far away
            azimuth_deg: 0.0,
            vel_m_s: 30.0,
            rcs: 0.8,
        };

        let analysis_close = analyze_drone(&target_close);
        let analysis_far = analyze_drone(&target_far);
        
        // Closer target should have higher proximity risk
        assert!(analysis_close.risk_assessment.proximity_risk > analysis_far.risk_assessment.proximity_risk);
        assert!(analysis_close.risk_assessment.overall_risk > analysis_far.risk_assessment.overall_risk);
    }

    #[test]
    fn test_analyze_drone_recommendations() {
        let target_high_risk = TargetPosition {
            id: 11,
            range_m: 2_000.0, // Very close
            azimuth_deg: 0.0,
            vel_m_s: 80.0, // Very high speed
            rcs: 0.9,
        };

        let analysis = analyze_drone(&target_high_risk);
        
        // Should have multiple recommendations for high-risk scenario
        assert!(!analysis.recommendations.is_empty());
        assert!(analysis.recommendations.len() >= 1);
    }

    #[test]
    fn test_analyze_drone_negative_velocity() {
        let target = TargetPosition {
            id: 12,
            range_m: 10_000.0,
            azimuth_deg: 0.0,
            vel_m_s: -30.0, // Negative velocity (moving away)
            rcs: 0.7,
        };

        let analysis = analyze_drone(&target);
        
        // Speed should be absolute value
        assert_eq!(analysis.trajectory_analysis.speed_m_s, 30.0);
    }

    #[test]
    fn test_analyze_drone_altitude_estimate() {
        let target_close = TargetPosition {
            id: 13,
            range_m: 1_000.0, // 1 km
            azimuth_deg: 0.0,
            vel_m_s: 20.0,
            rcs: 0.7,
        };

        let target_far = TargetPosition {
            id: 14,
            range_m: 10_000.0, // 10 km
            azimuth_deg: 0.0,
            vel_m_s: 20.0,
            rcs: 0.7,
        };

        let analysis_close = analyze_drone(&target_close);
        let analysis_far = analyze_drone(&target_far);
        
        // Altitude estimate should be reasonable
        assert!(analysis_close.trajectory_analysis.altitude_estimate_m > 0.0);
        assert!(analysis_far.trajectory_analysis.altitude_estimate_m > 0.0);
        // Far target should have higher altitude estimate
        assert!(analysis_far.trajectory_analysis.altitude_estimate_m > analysis_close.trajectory_analysis.altitude_estimate_m);
    }
}


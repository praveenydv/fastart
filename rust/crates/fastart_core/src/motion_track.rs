use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MotionTrackTransform {
    pub dx: f64,
    pub dy: f64,
    pub d_scale: f64,
    pub d_rot: f64,
}

/// Evaluates motion tracking displacement, scale offset, and rotation offset in Rust
pub fn evaluate_motion_track(
    time: f64,
    clip_start_time: f64,
    clip_duration: f64,
    mode: &str,
    intensity: f64,
) -> MotionTrackTransform {
    let elapsed = (time - clip_start_time).max(0.0);
    let progress = if clip_duration > 0.0 {
        (elapsed / clip_duration).clamp(0.0, 1.0)
    } else {
        0.0
    };
    let factor = (intensity / 100.0).clamp(0.0, 2.0);

    match mode {
        "follow_center" => {
            let angle = progress * std::f64::consts::PI * 2.0;
            MotionTrackTransform {
                dx: angle.sin() * 28.0 * factor,
                dy: angle.cos() * 14.0 * factor,
                d_scale: 1.0,
                d_rot: 0.0,
            }
        }
        "cinematic_drift" => {
            let angle = progress * std::f64::consts::PI * 1.5;
            MotionTrackTransform {
                dx: angle.sin() * 45.0 * factor,
                dy: (angle * 0.7).cos() * 20.0 * factor,
                d_scale: 1.0 + (progress * std::f64::consts::PI).sin() * 0.06 * factor,
                d_rot: (angle * 0.5).sin() * 2.5 * factor,
            }
        }
        "dynamic_zoom" => {
            let scale_pulse = (progress * std::f64::consts::PI * 3.0).sin() * 0.15 * factor;
            MotionTrackTransform {
                dx: (progress * std::f64::consts::PI * 2.0).cos() * 15.0 * factor,
                dy: (progress * std::f64::consts::PI * 2.0).sin() * 15.0 * factor,
                d_scale: (1.0 + scale_pulse).max(0.1),
                d_rot: (progress * std::f64::consts::PI).sin() * 4.0 * factor,
            }
        }
        "orbit_float" => {
            let orbit_angle = progress * std::f64::consts::PI * 4.0;
            MotionTrackTransform {
                dx: orbit_angle.cos() * 32.0 * factor,
                dy: orbit_angle.sin() * 32.0 * factor,
                d_scale: 1.0 + (orbit_angle * 0.5).sin() * 0.08 * factor,
                d_rot: orbit_angle.sin() * 5.0 * factor,
            }
        }
        _ => MotionTrackTransform {
            dx: 0.0,
            dy: 0.0,
            d_scale: 1.0,
            d_rot: 0.0,
        },
    }
}

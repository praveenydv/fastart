use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryPoint {
    pub time: f64,
    pub x: f64,
    pub y: f64,
    pub scale: f64,
    pub rotation: f64,
    #[serde(default)]
    pub confidence: f64,
    #[serde(rename = "boxWidth", default)]
    pub box_width: Option<f64>,
    #[serde(rename = "boxHeight", default)]
    pub box_height: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackingRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MotionTrackTransform {
    pub dx: f64,
    pub dy: f64,
    pub d_scale: f64,
    pub d_rot: f64,
}

/// Interpolates trajectory at a given time using linear/Hermite interpolation
pub fn interpolate_trajectory(trajectory: &[TrajectoryPoint], time: f64) -> Option<TrajectoryPoint> {
    if trajectory.is_empty() {
        return None;
    }
    if trajectory.len() == 1 || time <= trajectory[0].time {
        return Some(trajectory[0].clone());
    }
    let last = &trajectory[trajectory.len() - 1];
    if time >= last.time {
        return Some(last.clone());
    }

    // Binary search for interval
    let mut low = 0;
    let mut high = trajectory.len() - 1;
    while low + 1 < high {
        let mid = (low + high) / 2;
        if trajectory[mid].time <= time {
            low = mid;
        } else {
            high = mid;
        }
    }

    let p0 = &trajectory[low];
    let p1 = &trajectory[high];
    let dt = (p1.time - p0.time).max(0.0001);
    let t = ((time - p0.time) / dt).clamp(0.0, 1.0);

    // Linear fallback with smooth factor
    let interp_x = p0.x + (p1.x - p0.x) * t;
    let interp_y = p0.y + (p1.y - p0.y) * t;
    let interp_scale = p0.scale + (p1.scale - p0.scale) * t;
    let interp_rot = p0.rotation + (p1.rotation - p0.rotation) * t;
    let interp_conf = p0.confidence + (p1.confidence - p0.confidence) * t;

    Some(TrajectoryPoint {
        time,
        x: interp_x,
        y: interp_y,
        scale: interp_scale,
        rotation: interp_rot,
        confidence: interp_conf,
        box_width: p0.box_width.map(|w0| {
            let w1 = p1.box_width.unwrap_or(w0);
            w0 + (w1 - w0) * t
        }),
        box_height: p0.box_height.map(|h0| {
            let h1 = p1.box_height.unwrap_or(h0);
            h0 + (h1 - h0) * t
        }),
    })
}

/// Evaluates real object tracking trajectory displacement, scale offset, and rotation offset
pub fn evaluate_object_track_trajectory(
    time: f64,
    trajectory: &[TrajectoryPoint],
    track_scale: bool,
    track_rotation: bool,
    camera_center: bool,
) -> MotionTrackTransform {
    if trajectory.is_empty() {
        return MotionTrackTransform {
            dx: 0.0,
            dy: 0.0,
            d_scale: 1.0,
            d_rot: 0.0,
        };
    }

    let origin = &trajectory[0];
    let current = match interpolate_trajectory(trajectory, time) {
        Some(p) => p,
        None => return MotionTrackTransform {
            dx: 0.0,
            dy: 0.0,
            d_scale: 1.0,
            d_rot: 0.0,
        },
    };

    // Calculate delta relative to origin point at t0
    let mut dx = current.x - origin.x;
    let mut dy = current.y - origin.y;
    let d_scale = if track_scale { current.scale } else { 1.0 };
    let d_rot = if track_rotation { (current.rotation - origin.rotation).clamp(-15.0, 15.0) } else { 0.0 };

    if camera_center {
        // Counter-act subject motion to lock it in the center of the viewport
        dx = -dx;
        dy = -dy;
    }

    MotionTrackTransform {
        dx,
        dy,
        d_scale: d_scale.clamp(0.1, 10.0),
        d_rot,
    }
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

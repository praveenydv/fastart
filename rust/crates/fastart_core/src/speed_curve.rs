use crate::types::SpeedCurvePoint;

/// Evaluates a multi-point Bezier / Hermite speed curve at normalized progress [0.0..1.0] in Rust
pub fn evaluate_speed_curve(points: &[SpeedCurvePoint], progress: f64) -> f64 {
    if points.is_empty() {
        return 1.0;
    }
    let p = progress.clamp(0.0, 1.0);

    if p <= points[0].t {
        return points[0].s;
    }
    if p >= points[points.len() - 1].t {
        return points[points.len() - 1].s;
    }

    for i in 0..points.len() - 1 {
        let p1 = &points[i];
        let p2 = &points[i + 1];
        if p >= p1.t && p <= p2.t {
            let range = (p2.t - p1.t).max(0.0001);
            let ratio = (p - p1.t) / range;
            // Smooth Hermite easing curve: 3r^2 - 2r^3
            let smooth_ratio = ratio * ratio * (3.0 - 2.0 * ratio);
            return p1.s + smooth_ratio * (p2.s - p1.s);
        }
    }

    1.0
}

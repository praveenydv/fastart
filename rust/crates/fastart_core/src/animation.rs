// animation.rs – Rust-backed keyframe generator for FastArt animation presets.
// Computes per-frame values for the given preset entirely in Rust,
// keeping heavy math off the JS/UI thread and guaranteeing identical output
// across Android (JNI), iOS (FFI) and Web (WASM).
//
// Output layout (repeating per frame):
//   [opacity, scaleX, scaleY, translateX, translateY, rotationDeg]
// Frame count is always `frames` (caller-controlled).

/// A single animation frame's transform snapshot
#[derive(Debug, Clone)]
pub struct AnimKeyframe {
    pub opacity: f32,
    pub scale_x: f32,
    pub scale_y: f32,
    pub translate_x: f32, // percentage of element width
    pub translate_y: f32, // percentage of element height
    pub rotation: f32,    // degrees
}

impl AnimKeyframe {
    fn identity() -> Self {
        AnimKeyframe { opacity: 1.0, scale_x: 1.0, scale_y: 1.0, translate_x: 0.0, translate_y: 0.0, rotation: 0.0 }
    }
}

// ---------------------------------------------------------------------------
// Easing helpers (all work on t in [0..1])
// ---------------------------------------------------------------------------

#[inline]
fn ease_in_out(t: f32) -> f32 {
    t * t * (3.0 - 2.0 * t)
}

#[inline]
fn ease_out_cubic(t: f32) -> f32 {
    let t1 = 1.0 - t;
    1.0 - t1 * t1 * t1
}

#[inline]
fn ease_in_cubic(t: f32) -> f32 {
    t * t * t
}

/// Spring-like overshoot easing (cubic bezier approximation of (0.34, 1.56, 0.64, 1))
#[inline]
fn spring_overshoot(t: f32) -> f32 {
    // Simple overshoot: goes slightly past 1 then settles
    let s = 1.70158_f32;
    let t1 = t - 1.0;
    t1 * t1 * ((s + 1.0) * t1 + s) + 1.0
}

// ---------------------------------------------------------------------------
// Main public function
// ---------------------------------------------------------------------------

/// Generate keyframes for an animation preset.
///
/// * `preset`   – e.g. "fade_in", "zoom_in", "pulse"
/// * `category` – "in", "out", or "loop"
/// * `frames`   – number of frames to generate (e.g. 60 for 1 s at 60 fps)
///
/// Returns a flat Vec<f32> with `frames * 6` elements laid out as:
/// [opacity, scaleX, scaleY, translateX, translateY, rotationDeg, ...]
pub fn generate_animation_keyframes(preset: &str, category: &str, frames: usize) -> Vec<f32> {
    let n = frames.max(2);
    let mut out = Vec::with_capacity(n * 6);

    for i in 0..n {
        let t = i as f32 / (n - 1) as f32; // 0..1
        let kf = compute_keyframe(preset, category, t);
        out.push(kf.opacity);
        out.push(kf.scale_x);
        out.push(kf.scale_y);
        out.push(kf.translate_x);
        out.push(kf.translate_y);
        out.push(kf.rotation);
    }

    out
}

/// Compute a single keyframe value at normalised time `t` ∈ [0, 1].
fn compute_keyframe(preset: &str, category: &str, t: f32) -> AnimKeyframe {
    let mut kf = AnimKeyframe::identity();

    match preset {
        // ---- In presets ----
        "fade_in" => {
            kf.opacity = ease_in_out(t);
        }
        "zoom_in" => {
            let p = ease_out_cubic(t);
            kf.opacity = p;
            kf.scale_x = 0.3 + 0.7 * p;
            kf.scale_y = kf.scale_x;
        }
        "zoom_in_2" => {
            let p = spring_overshoot(t.min(1.0));
            kf.opacity = ease_out_cubic(t);
            kf.scale_x = 0.2 + 0.8 * p;
            kf.scale_y = kf.scale_x;
        }
        "slide_right" if category == "in" => {
            let p = ease_out_cubic(t);
            kf.opacity = ease_in_out(t);
            kf.translate_x = -100.0 * (1.0 - p); // enters from left
        }
        "slide_left" if category == "in" => {
            let p = ease_out_cubic(t);
            kf.opacity = ease_in_out(t);
            kf.translate_x = 100.0 * (1.0 - p); // enters from right
        }
        "slide_up" if category == "in" => {
            let p = ease_out_cubic(t);
            kf.opacity = ease_in_out(t);
            kf.translate_y = 100.0 * (1.0 - p); // rises up from below
        }
        "slide_down" if category == "in" => {
            let p = ease_out_cubic(t);
            kf.opacity = ease_in_out(t);
            kf.translate_y = -100.0 * (1.0 - p); // drops down from top
        }
        "spin_in" => {
            let p = ease_out_cubic(t);
            kf.opacity = ease_in_out(t);
            kf.scale_x = 0.3 + 0.7 * p;
            kf.scale_y = kf.scale_x;
            kf.rotation = -180.0 * (1.0 - p);
        }
        "bounce_in" => {
            // multi-step bounce via piecewise easing
            let p = if t < 0.6 {
                spring_overshoot(t / 0.6)
            } else {
                ease_out_cubic((t - 0.6) / 0.4) * 0.06 + 0.94
            };
            kf.opacity = ease_in_out(t);
            kf.scale_x = 0.3 + 0.7 * p;
            kf.scale_y = kf.scale_x;
        }
        "shake_in" => {
            // shake: translateX oscillates while opacity builds
            kf.opacity = ease_in_out(t);
            kf.translate_x = if t < 0.5 {
                (6.0 * (1.0 - t * 2.0)) * (t * std::f32::consts::PI * 8.0).sin()
            } else {
                0.0
            };
        }
        "blur_in" => {
            // Blur can't be done with Animated directly, but we still provide opacity
            kf.opacity = ease_in_out(t);
        }
        "wipe_right" => {
            // Clip path is web-only; use opacity as proxy
            kf.opacity = ease_in_out(t);
        }

        // ---- Out presets ----
        "fade_out" => {
            kf.opacity = 1.0 - ease_in_out(t);
        }
        "zoom_out" => {
            let p = 1.0 - ease_in_cubic(t);
            kf.opacity = p;
            kf.scale_x = 0.3 + 0.7 * p;
            kf.scale_y = kf.scale_x;
        }
        "shrink_out" => {
            let p = 1.0 - ease_in_out(t);
            kf.opacity = p;
            kf.scale_x = p.max(0.01);
            kf.scale_y = kf.scale_x;
        }
        "slide_right" if category == "out" => {
            let p = ease_in_cubic(t);
            kf.opacity = 1.0 - ease_in_out(t);
            kf.translate_x = 100.0 * p;
        }
        "slide_left" if category == "out" => {
            let p = ease_in_cubic(t);
            kf.opacity = 1.0 - ease_in_out(t);
            kf.translate_x = -100.0 * p;
        }
        "slide_down" if category == "out" => {
            let p = ease_in_cubic(t);
            kf.opacity = 1.0 - ease_in_out(t);
            kf.translate_y = 100.0 * p;
        }
        "slide_up" if category == "out" => {
            let p = ease_in_cubic(t);
            kf.opacity = 1.0 - ease_in_out(t);
            kf.translate_y = -100.0 * p;
        }
        "spin_out" => {
            let p = ease_in_cubic(t);
            kf.opacity = 1.0 - ease_in_out(t);
            kf.scale_x = (1.0 - 0.8 * p).max(0.01);
            kf.scale_y = kf.scale_x;
            kf.rotation = 180.0 * p;
        }
        "shake_out" => {
            kf.opacity = 1.0 - ease_in_out(t);
            kf.translate_x = (4.0 * (1.0 - t)) * (t * std::f32::consts::PI * 8.0).sin();
        }
        "dissolve" => {
            kf.opacity = 1.0 - ease_in_out(t);
        }
        "wipe_left" => {
            kf.opacity = 1.0 - ease_in_out(t);
        }

        // ---- Loop presets (t runs 0→1 repeatedly) ----
        "pulse" => {
            // scale oscillates 1 → 1.22 → 1
            let s = (t * std::f32::consts::TAU).sin() * 0.5 + 0.5;
            kf.scale_x = 1.0 + 0.22 * s;
            kf.scale_y = kf.scale_x;
        }
        "bounce" => {
            let s = (t * std::f32::consts::PI).sin();
            kf.translate_y = -8.0 * s; // % of element height
        }
        "float" => {
            let s = (t * std::f32::consts::TAU).sin() * 0.5 + 0.5;
            kf.translate_y = -5.0 * s;
        }
        "wave" => {
            kf.rotation = 10.0 * (t * std::f32::consts::TAU).sin();
        }
        "wobble" => {
            kf.translate_x = 3.0 * (t * std::f32::consts::TAU).sin();
            kf.rotation = 4.0 * (t * std::f32::consts::TAU + 0.2).sin();
        }
        "pendulum" => {
            kf.rotation = 15.0 * (t * std::f32::consts::TAU).sin();
        }
        "swing" => {
            kf.rotation = 12.0 * (t * std::f32::consts::TAU - std::f32::consts::FRAC_PI_2).sin();
        }
        "heartbeat" => {
            // double-thump pattern
            let t2 = (t * 2.0) % 1.0;
            let s = if t2 < 0.15 {
                1.0 + 0.24 * (t2 / 0.15)
            } else if t2 < 0.28 {
                1.24 - 0.24 * ((t2 - 0.15) / 0.13)
            } else if t2 < 0.42 {
                1.0 + 0.16 * ((t2 - 0.28) / 0.14)
            } else if t2 < 0.5 {
                1.16 - 0.16 * ((t2 - 0.42) / 0.08)
            } else {
                1.0
            };
            kf.scale_x = s;
            kf.scale_y = s;
        }
        "zoom_pulse" => {
            let s = (t * std::f32::consts::TAU).sin() * 0.5 + 0.5;
            kf.scale_x = 0.92 + 0.28 * s;
            kf.scale_y = kf.scale_x;
        }
        "jitter" => {
            // pseudo-random feel using multiple sine harmonics
            kf.translate_x = 2.0 * (t * std::f32::consts::TAU * 7.3).sin()
                           + 1.0 * (t * std::f32::consts::TAU * 13.7).sin();
            kf.translate_y = 2.0 * (t * std::f32::consts::TAU * 5.1).cos()
                           + 1.0 * (t * std::f32::consts::TAU * 11.2).cos();
        }

        // Fallback: identity (no animation)
        _ => {}
    }

    kf
}


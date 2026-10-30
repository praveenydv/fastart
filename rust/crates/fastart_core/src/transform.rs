use crate::compositor::{blend_pixel_over, BlendMode};
use crate::types::{ClipTransform, CutoutConfig, FrameBuffer, KeyframePoint, MaskConfig, MaskKeyframePoint};

#[derive(Debug, Clone, Copy)]
pub struct EvaluatedTransform {
    pub scale_x: f32,
    pub scale_y: f32,
    pub rotation_rad: f32,
    pub x: f32,
    pub y: f32,
    pub opacity: f32,
    pub flip_x: bool,
    pub flip_y: bool,
}

impl Default for EvaluatedTransform {
    fn default() -> Self {
        Self {
            scale_x: 1.0,
            scale_y: 1.0,
            rotation_rad: 0.0,
            x: 0.0,
            y: 0.0,
            opacity: 1.0,
            flip_x: false,
            flip_y: false,
        }
    }
}

pub fn evaluate_keyframes(
    base: Option<&ClipTransform>,
    keyframes: Option<&[KeyframePoint]>,
    time: f64,
) -> EvaluatedTransform {
    let mut result = EvaluatedTransform::default();

    if let Some(t) = base {
        let s = t.scale.unwrap_or(1.0) as f32;
        result.scale_x = t.scale_x.unwrap_or(s as f64) as f32;
        result.scale_y = t.scale_y.unwrap_or(s as f64) as f32;
        result.rotation_rad = (t.rotation.unwrap_or(0.0) as f32).to_radians();
        result.x = t.x.unwrap_or(0.0) as f32;
        result.y = t.y.unwrap_or(0.0) as f32;
        result.opacity = t.opacity.unwrap_or(1.0) as f32;
        result.flip_x = t.flip_x.unwrap_or(false);
        result.flip_y = t.flip_y.unwrap_or(false);
    }

    if let Some(kfs) = keyframes {
        if kfs.is_empty() {
            return result;
        }

        if time <= kfs[0].time {
            let k = &kfs[0];
            apply_keyframe(&mut result, k);
            return result;
        }

        if time >= kfs[kfs.len() - 1].time {
            let k = &kfs[kfs.len() - 1];
            apply_keyframe(&mut result, k);
            return result;
        }

        // Interpolate between two keyframes
        for i in 0..kfs.len() - 1 {
            let k1 = &kfs[i];
            let k2 = &kfs[i + 1];
            if time >= k1.time && time <= k2.time {
                let range = (k2.time - k1.time).max(0.0001);
                let t = ((time - k1.time) / range) as f32;
                // Smooth Hermite easing (3t^2 - 2t^3)
                let ease_t = t * t * (3.0 - 2.0 * t);

                let mut e1 = result;
                let mut e2 = result;
                apply_keyframe(&mut e1, k1);
                apply_keyframe(&mut e2, k2);

                result.scale_x = e1.scale_x + (e2.scale_x - e1.scale_x) * ease_t;
                result.scale_y = e1.scale_y + (e2.scale_y - e1.scale_y) * ease_t;
                result.rotation_rad = e1.rotation_rad + (e2.rotation_rad - e1.rotation_rad) * ease_t;
                result.x = e1.x + (e2.x - e1.x) * ease_t;
                result.y = e1.y + (e2.y - e1.y) * ease_t;
                result.opacity = e1.opacity + (e2.opacity - e1.opacity) * ease_t;
                return result;
            }
        }
    }

    result
}

fn apply_keyframe(target: &mut EvaluatedTransform, kf: &KeyframePoint) {
    let s = kf.transform.scale.unwrap_or(1.0) as f32;
    target.scale_x = kf.transform.scale_x.unwrap_or(s as f64) as f32;
    target.scale_y = kf.transform.scale_y.unwrap_or(s as f64) as f32;
    target.rotation_rad = (kf.transform.rotation.unwrap_or(0.0) as f32).to_radians();
    target.x = kf.transform.x.unwrap_or(0.0) as f32;
    target.y = kf.transform.y.unwrap_or(0.0) as f32;
    target.opacity = (kf.opacity * kf.transform.opacity.unwrap_or(1.0)) as f32;
    target.flip_x = kf.transform.flip_x.unwrap_or(false);
    target.flip_y = kf.transform.flip_y.unwrap_or(false);
}

/// Evaluates shape mask parameters smoothly across keyframes.
/// Prioritizes dedicated `mask_keyframes`, falling back to embedded `keyframes` for legacy projects.
pub fn evaluate_mask_keyframes(
    base: Option<&MaskConfig>,
    mask_keyframes: Option<&[MaskKeyframePoint]>,
    keyframes: Option<&[KeyframePoint]>,
    time: f64,
) -> Option<MaskConfig> {
    // 1. Dedicated mask keyframes
    if let Some(mkfs) = mask_keyframes {
        if !mkfs.is_empty() {
            if time <= mkfs[0].time {
                return Some(mkfs[0].mask.clone());
            }
            if time >= mkfs[mkfs.len() - 1].time {
                return Some(mkfs[mkfs.len() - 1].mask.clone());
            }
            for i in 0..mkfs.len() - 1 {
                let k1 = &mkfs[i];
                let k2 = &mkfs[i + 1];
                if time >= k1.time && time <= k2.time {
                    let range = (k2.time - k1.time).max(0.0001);
                    let t = ((time - k1.time) / range) as f32;
                    let ease_t = t * t * (3.0 - 2.0 * t);
                    return interpolate_mask_pair(&k1.mask, &k2.mask, ease_t);
                }
            }
        }
    }

    // 2. Fallback to legacy embedded keyframes
    if let Some(kfs) = keyframes {
        let mask_kfs: Vec<&KeyframePoint> = kfs
            .iter()
            .filter(|k| k.mask.is_some() || k.transform.mask.is_some())
            .collect();

        if !mask_kfs.is_empty() {
            let get_mask = |k: &KeyframePoint| -> Option<MaskConfig> {
                k.mask.clone().or_else(|| k.transform.mask.clone())
            };

            if time <= mask_kfs[0].time {
                return get_mask(mask_kfs[0]).or_else(|| base.cloned());
            }
            if time >= mask_kfs[mask_kfs.len() - 1].time {
                return get_mask(mask_kfs[mask_kfs.len() - 1]).or_else(|| base.cloned());
            }
            for i in 0..mask_kfs.len() - 1 {
                let k1 = mask_kfs[i];
                let k2 = mask_kfs[i + 1];
                if time >= k1.time && time <= k2.time {
                    let range = (k2.time - k1.time).max(0.0001);
                    let t = ((time - k1.time) / range) as f32;
                    let ease_t = t * t * (3.0 - 2.0 * t);
                    let m1 = get_mask(k1);
                    let m2 = get_mask(k2);
                    if let (Some(a), Some(b)) = (m1.as_ref(), m2.as_ref()) {
                        return interpolate_mask_pair(a, b, ease_t);
                    } else if m1.is_some() {
                        return m1;
                    } else {
                        return m2;
                    }
                }
            }
        }
    }

    base.cloned()
}

fn interpolate_mask_pair(a: &MaskConfig, b: &MaskConfig, ease_t: f32) -> Option<MaskConfig> {
    let rot_a = a.rotation.unwrap_or(0.0);
    let rot_b = b.rotation.unwrap_or(0.0);
    let mut diff = (rot_b - rot_a) % 360.0;
    if diff > 180.0 {
        diff -= 360.0;
    }
    if diff < -180.0 {
        diff += 360.0;
    }
    let rot_interp = ((rot_a + diff * ease_t as f64) % 360.0 + 360.0) % 360.0;

    let s_a = a.size.unwrap_or(60.0);
    let s_b = b.size.unwrap_or(60.0);
    let w_a = a.width.unwrap_or(s_a);
    let w_b = b.width.unwrap_or(s_b);
    let h_a = a.height.unwrap_or(s_a);
    let h_b = b.height.unwrap_or(s_b);
    let f_a = a.feather.unwrap_or(0.0);
    let f_b = b.feather.unwrap_or(0.0);
    let r_a = a.roundness.unwrap_or(16.0);
    let r_b = b.roundness.unwrap_or(16.0);
    let x_a = a.x.unwrap_or(0.0);
    let x_b = b.x.unwrap_or(0.0);
    let y_a = a.y.unwrap_or(0.0);
    let y_b = b.y.unwrap_or(0.0);

    Some(MaskConfig {
        shape: if ease_t < 0.5 { a.shape.clone() } else { b.shape.clone() },
        size: Some(s_a + (s_b - s_a) * ease_t as f64),
        width: Some(w_a + (w_b - w_a) * ease_t as f64),
        height: Some(h_a + (h_b - h_a) * ease_t as f64),
        feather: Some((f_a + (f_b - f_a) * ease_t as f64).max(0.0)),
        roundness: Some((r_a + (r_b - r_a) * ease_t as f64).max(0.0)),
        inverted: if ease_t < 0.5 { a.inverted } else { b.inverted },
        x: Some(x_a + (x_b - x_a) * ease_t as f64),
        y: Some(y_a + (y_b - y_a) * ease_t as f64),
        rotation: Some(rot_interp),
        keyframes: None,
    })
}

/// Bilinear sampling of a FrameBuffer at normalized or pixel coordinates (u, v)
#[inline(always)]
pub fn sample_bilinear(src: &FrameBuffer, u: f32, v: f32) -> (u8, u8, u8, u8) {
    if u < 0.0 || u >= (src.width as f32 - 1.0) || v < 0.0 || v >= (src.height as f32 - 1.0) {
        if u >= -0.5 && u < src.width as f32 && v >= -0.5 && v < src.height as f32 {
            let x = u.clamp(0.0, src.width as f32 - 1.0) as u32;
            let y = v.clamp(0.0, src.height as f32 - 1.0) as u32;
            return src.get_pixel(x, y);
        }
        return (0, 0, 0, 0);
    }

    let x0 = u.floor() as u32;
    let y0 = v.floor() as u32;
    let x1 = x0 + 1;
    let y1 = y0 + 1;

    let fx = u - x0 as f32;
    let fy = v - y0 as f32;
    let fx1 = 1.0 - fx;
    let fy1 = 1.0 - fy;

    let w00 = fx1 * fy1;
    let w10 = fx * fy1;
    let w01 = fx1 * fy;
    let w11 = fx * fy;

    let p00 = src.get_pixel(x0, y0);
    let p10 = src.get_pixel(x1, y0);
    let p01 = src.get_pixel(x0, y1);
    let p11 = src.get_pixel(x1, y1);

    let r = (p00.0 as f32 * w00 + p10.0 as f32 * w10 + p01.0 as f32 * w01 + p11.0 as f32 * w11) as u8;
    let g = (p00.1 as f32 * w00 + p10.1 as f32 * w10 + p01.1 as f32 * w01 + p11.1 as f32 * w11) as u8;
    let b = (p00.2 as f32 * w00 + p10.2 as f32 * w10 + p01.2 as f32 * w01 + p11.2 as f32 * w11) as u8;
    let a = (p00.3 as f32 * w00 + p10.3 as f32 * w10 + p01.3 as f32 * w01 + p11.3 as f32 * w11) as u8;

    (r, g, b, a)
}

/// Evaluates shape mask alpha [0.0..1.0] at relative clip coordinate (norm_x, norm_y) [-1.0..1.0]
pub fn evaluate_mask(mask: &MaskConfig, norm_x: f32, norm_y: f32) -> f32 {
    let shape = mask.shape.as_str();
    if shape == "none" {
        return 1.0;
    }

    let size = (mask.size.unwrap_or(100.0) as f32 / 100.0).max(0.01);
    let feather = (mask.feather.unwrap_or(0.0) as f32 / 100.0).max(0.001);
    let off_x = mask.x.unwrap_or(0.0) as f32 / 100.0;
    let off_y = mask.y.unwrap_or(0.0) as f32 / 100.0;
    let rot = (mask.rotation.unwrap_or(0.0) as f32).to_radians();

    // Mask local space coordinate
    let dx = norm_x - off_x;
    let dy = norm_y - off_y;
    let cos_r = rot.cos();
    let sin_r = rot.sin();
    let mx = (dx * cos_r + dy * sin_r) / size;
    let my = (-dx * sin_r + dy * cos_r) / size;

    let dist = match shape {
        "circle" => (mx * mx + my * my).sqrt(),
        "rectangle" => mx.abs().max(my.abs()),
        "linear" => mx + 0.5,
        "mirror" => mx.abs(),
        "heart" => {
            // Heart implicit curve approximation
            let hx = mx * 1.2;
            let hy = my * 1.2 - 0.2;
            let a = hx * hx + hy * hy - 0.5;
            (a * a * a - hx * hx * hy * hy * hy).abs().sqrt()
        }
        _ => (mx * mx + my * my).sqrt(),
    };

    let mut alpha = if dist <= 1.0 - feather {
        1.0
    } else if dist >= 1.0 {
        0.0
    } else {
        (1.0 - (dist - (1.0 - feather)) / feather).clamp(0.0, 1.0)
    };

    if mask.inverted.unwrap_or(false) {
        alpha = 1.0 - alpha;
    }

    alpha
}

/// Evaluates chroma key / green screen cutout alpha
pub fn evaluate_cutout(cutout: &CutoutConfig, r: u8, g: u8, b: u8) -> f32 {
    if !cutout.enabled {
        return 1.0;
    }

    let (kr, kg, kb, _) = crate::compositor::parse_hex_color(&cutout.key_color);
    let dr = (r as f32 - kr as f32) / 255.0;
    let dg = (g as f32 - kg as f32) / 255.0;
    let db = (b as f32 - kb as f32) / 255.0;
    let dist = (dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114).sqrt();

    let tolerance = (cutout.intensity as f32 / 100.0) * 0.7;
    let shadow = (cutout.shadow as f32 / 100.0).max(0.02) * 0.3;

    if dist < tolerance {
        0.0
    } else if dist < tolerance + shadow {
        (dist - tolerance) / shadow
    } else {
        1.0
    }
}

#[cfg(feature = "parallel")]
use rayon::prelude::*;

/// Composite a source frame onto a destination canvas using affine transform and shaders
/// Parallelized across multi-core CPU scanlines for maximum throughput
pub fn composite_transformed(
    dst: &mut FrameBuffer,
    src: &FrameBuffer,
    transform: &EvaluatedTransform,
    fit: Option<&str>,
    mask: Option<&MaskConfig>,
    cutout: Option<&CutoutConfig>,
    blend_mode: BlendMode,
) {
    let dst_w = dst.width as f32;
    let dst_h = dst.height as f32;
    let src_w = src.width as f32;
    let src_h = src.height as f32;

    if src_w <= 0.0 || src_h <= 0.0 || transform.opacity <= 0.0 {
        return;
    }

    // Determine fit scale
    let (fit_sx, fit_sy) = match fit {
        Some("cover") => {
            let s = (dst_w / src_w).max(dst_h / src_h);
            (s, s)
        }
        _ => {
            // "contain" default
            let s = (dst_w / src_w).min(dst_h / src_h);
            (s, s)
        }
    };

    let total_sx = fit_sx * transform.scale_x;
    let total_sy = fit_sy * transform.scale_y;

    if total_sx.abs() < 0.001 || total_sy.abs() < 0.001 {
        return;
    }

    let cos_r = transform.rotation_rad.cos();
    let sin_r = transform.rotation_rad.sin();

    // Center of destination canvas plus transform translation
    let center_dx = dst_w * 0.5 + transform.x;
    let center_dy = dst_h * 0.5 + transform.y;
    let center_sx = src_w * 0.5;
    let center_sy = src_h * 0.5;
    let stride = dst.stride;

    let process_row = |dy: usize, row_bytes: &mut [u8]| {
        let py = dy as f32 - center_dy;

        for dx in 0..dst_w as usize {
            let px = dx as f32 - center_dx;

            // Rotate back
            let rx = px * cos_r + py * sin_r;
            let ry = -px * sin_r + py * cos_r;

            // Scale back
            let mut sx = rx / total_sx;
            let mut sy = ry / total_sy;

            if transform.flip_x {
                sx = -sx;
            }
            if transform.flip_y {
                sy = -sy;
            }

            let u = sx + center_sx;
            let v = sy + center_sy;

            if u >= 0.0 && u < src_w && v >= 0.0 && v < src_h {
                let (r, g, b, mut a) = sample_bilinear(src, u, v);
                if a == 0 {
                    continue;
                }

                // Masking
                if let Some(m) = mask {
                    let norm_x = (u - center_sx) / center_sx;
                    let norm_y = (v - center_sy) / center_sy;
                    let mask_alpha = evaluate_mask(m, norm_x, norm_y);
                    a = (a as f32 * mask_alpha) as u8;
                }

                // Chroma Key
                if let Some(c) = cutout {
                    let cutout_alpha = evaluate_cutout(c, r, g, b);
                    a = (a as f32 * cutout_alpha) as u8;
                }

                if a > 0 {
                    let idx = dx * 4;
                    let dst_px: &mut [u8; 4] = (&mut row_bytes[idx..idx + 4]).try_into().unwrap();
                    blend_pixel_over(dst_px, r, g, b, a, transform.opacity, blend_mode);
                }
            }
        }
    };

    #[cfg(feature = "parallel")]
    {
        dst.data.par_chunks_exact_mut(stride).enumerate().for_each(|(dy, row)| {
            process_row(dy, row);
        });
    }

    #[cfg(not(feature = "parallel"))]
    {
        for (dy, row) in dst.data.chunks_exact_mut(stride).enumerate() {
            process_row(dy, row);
        }
    }
}

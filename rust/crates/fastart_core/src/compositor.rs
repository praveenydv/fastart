use crate::types::FrameBuffer;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BlendMode {
    Normal,
    Multiply,
    Screen,
    Overlay,
    Add,
    Darken,
    Lighten,
}

impl BlendMode {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "multiply" => BlendMode::Multiply,
            "screen" => BlendMode::Screen,
            "overlay" => BlendMode::Overlay,
            "add" | "linear_dodge" => BlendMode::Add,
            "darken" => BlendMode::Darken,
            "lighten" => BlendMode::Lighten,
            _ => BlendMode::Normal,
        }
    }
}

/// Blends a source pixel onto a destination pixel using Porter-Duff Over with specified BlendMode.
/// Uses fixed-point integer arithmetic for maximum SIMD auto-vectorization performance.
#[inline(always)]
pub fn blend_pixel_over(
    dst: &mut [u8; 4],
    src_r: u8,
    src_g: u8,
    src_b: u8,
    src_a: u8,
    opacity: f32,
    blend_mode: BlendMode,
) {
    if src_a == 0 || opacity <= 0.0 {
        return;
    }

    let alpha = ((src_a as f32 * opacity).clamp(0.0, 255.0)) as u32;
    if alpha == 0 {
        return;
    }

    if alpha >= 255 && blend_mode == BlendMode::Normal {
        dst[0] = src_r;
        dst[1] = src_g;
        dst[2] = src_b;
        dst[3] = 255;
        return;
    }

    let inv_alpha = 255 - alpha;
    let dst_r = dst[0] as u32;
    let dst_g = dst[1] as u32;
    let dst_b = dst[2] as u32;
    let dst_a = dst[3] as u32;

    let (blended_r, blended_g, blended_b) = match blend_mode {
        BlendMode::Normal => (src_r as u32, src_g as u32, src_b as u32),
        BlendMode::Multiply => ((src_r as u32 * dst_r) / 255, (src_g as u32 * dst_g) / 255, (src_b as u32 * dst_b) / 255),
        BlendMode::Screen => (
            255 - ((255 - src_r as u32) * (255 - dst_r)) / 255,
            255 - ((255 - src_g as u32) * (255 - dst_g)) / 255,
            255 - ((255 - src_b as u32) * (255 - dst_b)) / 255,
        ),
        BlendMode::Overlay => {
            let overlay_ch = |s: u32, d: u32| -> u32 {
                if d < 128 {
                    (2 * s * d) / 255
                } else {
                    255 - (2 * (255 - s) * (255 - d)) / 255
                }
            };
            (
                overlay_ch(src_r as u32, dst_r),
                overlay_ch(src_g as u32, dst_g),
                overlay_ch(src_b as u32, dst_b),
            )
        }
        BlendMode::Add => (
            (src_r as u32 + dst_r).min(255),
            (src_g as u32 + dst_g).min(255),
            (src_b as u32 + dst_b).min(255),
        ),
        BlendMode::Darken => (
            (src_r as u32).min(dst_r),
            (src_g as u32).min(dst_g),
            (src_b as u32).min(dst_b),
        ),
        BlendMode::Lighten => (
            (src_r as u32).max(dst_r),
            (src_g as u32).max(dst_g),
            (src_b as u32).max(dst_b),
        ),
    };

    let out_r = ((blended_r * alpha + dst_r * inv_alpha) / 255) as u8;
    let out_g = ((blended_g * alpha + dst_g * inv_alpha) / 255) as u8;
    let out_b = ((blended_b * alpha + dst_b * inv_alpha) / 255) as u8;
    let out_a = (alpha + (dst_a * inv_alpha) / 255).min(255) as u8;

    dst[0] = out_r;
    dst[1] = out_g;
    dst[2] = out_b;
    dst[3] = out_a;
}

/// Parses standard hex colors (#RGB, #RGBA, #RRGGBB, #RRGGBBAA)
pub fn parse_hex_color(hex: &str) -> (u8, u8, u8, u8) {
    let s = hex.trim().trim_start_matches('#');
    match s.len() {
        3 => {
            let r = u8::from_str_radix(&s[0..1], 16).unwrap_or(0) * 17;
            let g = u8::from_str_radix(&s[1..2], 16).unwrap_or(0) * 17;
            let b = u8::from_str_radix(&s[2..3], 16).unwrap_or(0) * 17;
            (r, g, b, 255)
        }
        4 => {
            let r = u8::from_str_radix(&s[0..1], 16).unwrap_or(0) * 17;
            let g = u8::from_str_radix(&s[1..2], 16).unwrap_or(0) * 17;
            let b = u8::from_str_radix(&s[2..3], 16).unwrap_or(0) * 17;
            let a = u8::from_str_radix(&s[3..4], 16).unwrap_or(15) * 17;
            (r, g, b, a)
        }
        6 => {
            let r = u8::from_str_radix(&s[0..2], 16).unwrap_or(0);
            let g = u8::from_str_radix(&s[2..4], 16).unwrap_or(0);
            let b = u8::from_str_radix(&s[4..6], 16).unwrap_or(0);
            (r, g, b, 255)
        }
        8 => {
            let r = u8::from_str_radix(&s[0..2], 16).unwrap_or(0);
            let g = u8::from_str_radix(&s[2..4], 16).unwrap_or(0);
            let b = u8::from_str_radix(&s[4..6], 16).unwrap_or(0);
            let a = u8::from_str_radix(&s[6..8], 16).unwrap_or(255);
            (r, g, b, a)
        }
        _ => (0, 0, 0, 255),
    }
}

/// Renders a canvas background (color, gradient, or blur background)
pub fn render_canvas_background(fb: &mut FrameBuffer, bg: &str) {
    if bg.starts_with('#') {
        let (r, g, b, a) = parse_hex_color(bg);
        fb.fill(r, g, b, a);
    } else if bg.contains("gradient") || bg == "frost" {
        // High-end dark aesthetic gradient
        let h = fb.height as f32;
        for y in 0..fb.height {
            let t = y as f32 / h.max(1.0);
            let r = (15.0 + t * 10.0) as u8;
            let g = (15.0 + t * 15.0) as u8;
            let b = (25.0 + t * 25.0) as u8;
            let row_offset = (y as usize) * fb.stride;
            for x in 0..fb.width {
                let idx = row_offset + (x as usize) * 4;
                fb.data[idx] = r;
                fb.data[idx + 1] = g;
                fb.data[idx + 2] = b;
                fb.data[idx + 3] = 255;
            }
        }
    } else {
        fb.fill(0, 0, 0, 255);
    }
}

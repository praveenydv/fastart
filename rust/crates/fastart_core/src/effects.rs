use crate::types::FrameBuffer;

#[derive(Debug, Clone)]
pub struct Lut3D {
    pub size: usize,
    pub table: Vec<f32>, // size * size * size * 3 RGB values in [0.0..1.0]
}

impl Lut3D {
    pub fn new(size: usize) -> Self {
        let count = size * size * size * 3;
        Self {
            size,
            table: vec![0.0; count],
        }
    }

    /// Parses a standard .cube format string
    pub fn from_cube(cube_str: &str) -> Option<Self> {
        let mut size = 0usize;
        let mut data = Vec::new();

        for line in cube_str.lines() {
            let l = line.trim();
            if l.is_empty() || l.starts_with('#') {
                continue;
            }
            if l.starts_with("LUT_3D_SIZE") {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() >= 2 {
                    size = parts[1].parse().unwrap_or(0);
                }
            } else {
                let parts: Vec<&str> = l.split_whitespace().collect();
                if parts.len() == 3 {
                    if let (Ok(r), Ok(g), Ok(b)) = (
                        parts[0].parse::<f32>(),
                        parts[1].parse::<f32>(),
                        parts[2].parse::<f32>(),
                    ) {
                        data.push(r);
                        data.push(g);
                        data.push(b);
                    }
                }
            }
        }

        if size > 0 && data.len() == size * size * size * 3 {
            Some(Self { size, table: data })
        } else {
            None
        }
    }

    /// Trilinear lookup of color (r, g, b) in [0..255]
    #[inline(always)]
    pub fn sample(&self, r: u8, g: u8, b: u8) -> (u8, u8, u8) {
        let s = self.size as f32 - 1.0;
        let rf = (r as f32 / 255.0) * s;
        let gf = (g as f32 / 255.0) * s;
        let bf = (b as f32 / 255.0) * s;

        let r0 = rf.floor() as usize;
        let g0 = gf.floor() as usize;
        let b0 = bf.floor() as usize;
        let r1 = (r0 + 1).min(self.size - 1);
        let g1 = (g0 + 1).min(self.size - 1);
        let b1 = (b0 + 1).min(self.size - 1);

        let dr = rf - r0 as f32;
        let dg = gf - g0 as f32;
        let db = bf - b0 as f32;

        let get = |ri: usize, gi: usize, bi: usize| -> (f32, f32, f32) {
            let idx = (bi * self.size * self.size + gi * self.size + ri) * 3;
            (self.table[idx], self.table[idx + 1], self.table[idx + 2])
        };

        let c000 = get(r0, g0, b0);
        let c100 = get(r1, g0, b0);
        let c010 = get(r0, g1, b0);
        let c110 = get(r1, g1, b0);
        let c001 = get(r0, g0, b1);
        let c101 = get(r1, g0, b1);
        let c011 = get(r0, g1, b1);
        let c111 = get(r1, g1, b1);

        let interp = |a: f32, b: f32, t: f32| a + (b - a) * t;

        let c00_r = interp(c000.0, c100.0, dr);
        let c10_r = interp(c010.0, c110.0, dr);
        let c01_r = interp(c001.0, c101.0, dr);
        let c11_r = interp(c011.0, c111.0, dr);
        let c0_r = interp(c00_r, c10_r, dg);
        let c1_r = interp(c01_r, c11_r, dg);
        let out_r = interp(c0_r, c1_r, db);

        let c00_g = interp(c000.1, c100.1, dr);
        let c10_g = interp(c010.1, c110.1, dr);
        let c01_g = interp(c001.1, c101.1, dr);
        let c11_g = interp(c011.1, c111.1, dr);
        let c0_g = interp(c00_g, c10_g, dg);
        let c1_g = interp(c01_g, c11_g, dg);
        let out_g = interp(c0_g, c1_g, db);

        let c00_b = interp(c000.2, c100.2, dr);
        let c10_b = interp(c010.2, c110.2, dr);
        let c01_b = interp(c001.2, c101.2, dr);
        let c11_b = interp(c011.2, c111.2, dr);
        let c0_b = interp(c00_b, c10_b, dg);
        let c1_b = interp(c01_b, c11_b, dg);
        let out_b = interp(c0_b, c1_b, db);

        (
            (out_r.clamp(0.0, 1.0) * 255.0) as u8,
            (out_g.clamp(0.0, 1.0) * 255.0) as u8,
            (out_b.clamp(0.0, 1.0) * 255.0) as u8,
        )
    }
}

#[cfg(feature = "parallel")]
use rayon::prelude::*;

/// Applies 3D LUT to a FrameBuffer with given intensity [0.0..1.0]
/// Highly optimized with multi-core data parallelism
pub fn apply_lut_to_frame(fb: &mut FrameBuffer, lut: &Lut3D, intensity: f32) {
    if intensity <= 0.0 {
        return;
    }
    let inv = 1.0 - intensity.clamp(0.0, 1.0);

    #[cfg(feature = "parallel")]
    {
        fb.data.par_chunks_exact_mut(4).for_each(|chunk| {
            let (lr, lg, lb) = lut.sample(chunk[0], chunk[1], chunk[2]);
            if intensity >= 1.0 {
                chunk[0] = lr;
                chunk[1] = lg;
                chunk[2] = lb;
            } else {
                chunk[0] = (chunk[0] as f32 * inv + lr as f32 * intensity) as u8;
                chunk[1] = (chunk[1] as f32 * inv + lg as f32 * intensity) as u8;
                chunk[2] = (chunk[2] as f32 * inv + lb as f32 * intensity) as u8;
            }
        });
    }

    #[cfg(not(feature = "parallel"))]
    {
        for chunk in fb.data.chunks_exact_mut(4) {
            let (lr, lg, lb) = lut.sample(chunk[0], chunk[1], chunk[2]);
            if intensity >= 1.0 {
                chunk[0] = lr;
                chunk[1] = lg;
                chunk[2] = lb;
            } else {
                chunk[0] = (chunk[0] as f32 * inv + lr as f32 * intensity) as u8;
                chunk[1] = (chunk[1] as f32 * inv + lg as f32 * intensity) as u8;
                chunk[2] = (chunk[2] as f32 * inv + lb as f32 * intensity) as u8;
            }
        }
    }
}

/// Applies color grading: brightness [-1..1], contrast [0..2], saturation [0..2]
pub fn apply_color_adjustments(
    fb: &mut FrameBuffer,
    brightness: f32,
    contrast: f32,
    saturation: f32,
) {
    let b_offset = brightness * 255.0;

    let process_pixel = |chunk: &mut [u8]| {
        let mut r = chunk[0] as f32;
        let mut g = chunk[1] as f32;
        let mut b = chunk[2] as f32;

        // Brightness
        r += b_offset;
        g += b_offset;
        b += b_offset;

        // Contrast
        r = (r - 128.0) * contrast + 128.0;
        g = (g - 128.0) * contrast + 128.0;
        b = (b - 128.0) * contrast + 128.0;

        // Saturation
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + (r - gray) * saturation;
        g = gray + (g - gray) * saturation;
        b = gray + (b - gray) * saturation;

        chunk[0] = r.clamp(0.0, 255.0) as u8;
        chunk[1] = g.clamp(0.0, 255.0) as u8;
        chunk[2] = b.clamp(0.0, 255.0) as u8;
    };

    #[cfg(feature = "parallel")]
    {
        fb.data.par_chunks_exact_mut(4).for_each(process_pixel);
    }

    #[cfg(not(feature = "parallel"))]
    {
        for chunk in fb.data.chunks_exact_mut(4) {
            process_pixel(chunk);
        }
    }
}

/// Applies vignette falloff around the canvas edges
pub fn apply_vignette(fb: &mut FrameBuffer, intensity: f32, radius: f32) {
    if intensity <= 0.0 {
        return;
    }
    let cx = fb.width as f32 * 0.5;
    let cy = fb.height as f32 * 0.5;
    let max_dist = (cx * cx + cy * cy).sqrt();
    let inner = radius * max_dist;

    for y in 0..fb.height {
        let dy = y as f32 - cy;
        let row_offset = (y as usize) * fb.stride;
        for x in 0..fb.width {
            let dx = x as f32 - cx;
            let d = (dx * dx + dy * dy).sqrt();
            if d > inner {
                let falloff = ((d - inner) / (max_dist - inner)).clamp(0.0, 1.0);
                let factor = 1.0 - falloff * intensity.clamp(0.0, 1.0);
                let idx = row_offset + (x as usize) * 4;
                fb.data[idx] = (fb.data[idx] as f32 * factor) as u8;
                fb.data[idx + 1] = (fb.data[idx + 1] as f32 * factor) as u8;
                fb.data[idx + 2] = (fb.data[idx + 2] as f32 * factor) as u8;
            }
        }
    }
}

/// Fast separable horizontal + vertical box blur
pub fn apply_fast_blur(fb: &mut FrameBuffer, radius: u32) {
    if radius == 0 {
        return;
    }
    let w = fb.width as usize;
    let h = fb.height as usize;
    let r = radius as usize;

    let mut temp = fb.data.clone();

    // Horizontal pass
    for y in 0..h {
        let row_start = y * w * 4;
        for x in 0..w {
            let x_start = x.saturating_sub(r);
            let x_end = (x + r).min(w - 1);
            let count = (x_end - x_start + 1) as u32;

            let mut sum_r = 0u32;
            let mut sum_g = 0u32;
            let mut sum_b = 0u32;
            let mut sum_a = 0u32;

            for kx in x_start..=x_end {
                let idx = row_start + kx * 4;
                sum_r += fb.data[idx] as u32;
                sum_g += fb.data[idx + 1] as u32;
                sum_b += fb.data[idx + 2] as u32;
                sum_a += fb.data[idx + 3] as u32;
            }

            let out_idx = row_start + x * 4;
            temp[out_idx] = (sum_r / count) as u8;
            temp[out_idx + 1] = (sum_g / count) as u8;
            temp[out_idx + 2] = (sum_b / count) as u8;
            temp[out_idx + 3] = (sum_a / count) as u8;
        }
    }

    // Vertical pass
    for x in 0..w {
        for y in 0..h {
            let y_start = y.saturating_sub(r);
            let y_end = (y + r).min(h - 1);
            let count = (y_end - y_start + 1) as u32;

            let mut sum_r = 0u32;
            let mut sum_g = 0u32;
            let mut sum_b = 0u32;
            let mut sum_a = 0u32;

            for ky in y_start..=y_end {
                let idx = ky * w * 4 + x * 4;
                sum_r += temp[idx] as u32;
                sum_g += temp[idx + 1] as u32;
                sum_b += temp[idx + 2] as u32;
                sum_a += temp[idx + 3] as u32;
            }

            let out_idx = y * w * 4 + x * 4;
            fb.data[out_idx] = (sum_r / count) as u8;
            fb.data[out_idx + 1] = (sum_g / count) as u8;
            fb.data[out_idx + 2] = (sum_b / count) as u8;
            fb.data[out_idx + 3] = (sum_a / count) as u8;
        }
    }
}

/// Applies in-place color grading directly on linear memory RGBA slice
pub fn apply_color_adjustments_raw(
    pixels: &mut [u8],
    brightness: f32,
    contrast: f32,
    saturation: f32,
) {
    let b_offset = brightness * 255.0;
    for chunk in pixels.chunks_exact_mut(4) {
        let mut r = chunk[0] as f32;
        let mut g = chunk[1] as f32;
        let mut b = chunk[2] as f32;

        // Brightness
        r += b_offset;
        g += b_offset;
        b += b_offset;

        // Contrast
        r = (r - 128.0) * contrast + 128.0;
        g = (g - 128.0) * contrast + 128.0;
        b = (b - 128.0) * contrast + 128.0;

        // Saturation
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + (r - gray) * saturation;
        g = gray + (g - gray) * saturation;
        b = gray + (g - gray) * saturation;

        chunk[0] = r.clamp(0.0, 255.0) as u8;
        chunk[1] = g.clamp(0.0, 255.0) as u8;
        chunk[2] = b.clamp(0.0, 255.0) as u8;
    }
}

/// Applies in-place vignette falloff directly on linear memory RGBA slice
pub fn apply_vignette_raw(
    pixels: &mut [u8],
    width: usize,
    height: usize,
    intensity: f32,
    radius: f32,
) {
    if intensity <= 0.0 || width == 0 || height == 0 {
        return;
    }
    let cx = width as f32 * 0.5;
    let cy = height as f32 * 0.5;
    let max_dist = (cx * cx + cy * cy).sqrt();
    let inner = radius * max_dist;
    let inv_range = 1.0 / (max_dist - inner).max(0.001);
    let clamped_int = intensity.clamp(0.0, 1.0);

    for y in 0..height {
        let dy = y as f32 - cy;
        let row_offset = y * width * 4;
        for x in 0..width {
            let dx = x as f32 - cx;
            let d = (dx * dx + dy * dy).sqrt();
            if d > inner {
                let falloff = ((d - inner) * inv_range).clamp(0.0, 1.0);
                let factor = 1.0 - falloff * clamped_int;
                let idx = row_offset + x * 4;
                pixels[idx] = (pixels[idx] as f32 * factor) as u8;
                pixels[idx + 1] = (pixels[idx + 1] as f32 * factor) as u8;
                pixels[idx + 2] = (pixels[idx + 2] as f32 * factor) as u8;
            }
        }
    }
}

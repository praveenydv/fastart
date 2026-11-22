//! Small dependency-free pixel operations shared by native and WebAssembly cutout.

pub const MODNET_SIZE: usize = 512;

#[inline]
pub fn prepare_modnet_row(
    rgba_pixels: &[u8],
    width: usize,
    height: usize,
    dy: usize,
    red: &mut [f32],
    green: &mut [f32],
    blue: &mut [f32],
) {
    let inv_scale = 1.0f32 / 127.5f32;
    if width == MODNET_SIZE && height == MODNET_SIZE {
        let start = dy * MODNET_SIZE * 4;
        for dx in 0..MODNET_SIZE {
            let index = start + dx * 4;
            red[dx] = (rgba_pixels[index] as f32 - 127.5) * inv_scale;
            green[dx] = (rgba_pixels[index + 1] as f32 - 127.5) * inv_scale;
            blue[dx] = (rgba_pixels[index + 2] as f32 - 127.5) * inv_scale;
        }
        return;
    }

    let scale_x = width as f32 / MODNET_SIZE as f32;
    let scale_y = height as f32 / MODNET_SIZE as f32;
    let sy = (dy as f32 * scale_y).clamp(0.0, (height - 1) as f32);
    let y0 = sy.floor() as usize;
    let y1 = (y0 + 1).min(height - 1);
    let ty = sy - y0 as f32;
    let row0 = y0 * width;
    let row1 = y1 * width;

    for dx in 0..MODNET_SIZE {
        let sx = (dx as f32 * scale_x).clamp(0.0, (width - 1) as f32);
        let x0 = sx.floor() as usize;
        let x1 = (x0 + 1).min(width - 1);
        let tx = sx - x0 as f32;
        let i00 = (row0 + x0) * 4;
        let i10 = (row0 + x1) * 4;
        let i01 = (row1 + x0) * 4;
        let i11 = (row1 + x1) * 4;
        let w00 = (1.0 - tx) * (1.0 - ty);
        let w10 = tx * (1.0 - ty);
        let w01 = (1.0 - tx) * ty;
        let w11 = tx * ty;
        let r = rgba_pixels[i00] as f32 * w00
            + rgba_pixels[i10] as f32 * w10
            + rgba_pixels[i01] as f32 * w01
            + rgba_pixels[i11] as f32 * w11;
        let g = rgba_pixels[i00 + 1] as f32 * w00
            + rgba_pixels[i10 + 1] as f32 * w10
            + rgba_pixels[i01 + 1] as f32 * w01
            + rgba_pixels[i11 + 1] as f32 * w11;
        let b = rgba_pixels[i00 + 2] as f32 * w00
            + rgba_pixels[i10 + 2] as f32 * w10
            + rgba_pixels[i01 + 2] as f32 * w01
            + rgba_pixels[i11 + 2] as f32 * w11;
        red[dx] = (r - 127.5) * inv_scale;
        green[dx] = (g - 127.5) * inv_scale;
        blue[dx] = (b - 127.5) * inv_scale;
    }
}

pub fn modnet_alpha_to_rle(alpha: &[f32], threshold: f32, feather: f32) -> Vec<u8> {
    let mut smoothed = vec![0u8; alpha.len()];
    smooth_modnet_alpha(alpha, &mut smoothed, threshold, feather);

    let mut encoded = Vec::with_capacity(alpha.len() / 8);
    let Some((&first, rest)) = smoothed.split_first() else {
        return encoded;
    };
    let mut current = first;
    let mut count = 1usize;
    for &byte in rest {
        if byte == current && count < 255 {
            count += 1;
        } else {
            encoded.push(count as u8);
            encoded.push(current);
            current = byte;
            count = 1;
        }
    }
    encoded.push(count as u8);
    encoded.push(current);
    encoded
}

/// Converts raw float alpha values into a smoothed, anti-aliased 8-bit alpha mask.
/// Applies a calibrated Hermite S-curve that preserves hair transparency and soft edges,
/// followed by an edge-aware 3x3 anti-aliasing pass on transition contours to eliminate
/// jagged staircases, pinholes, and background noise.
#[inline]
pub fn smooth_modnet_alpha(
    alpha: &[f32],
    output: &mut [u8],
    threshold: f32,
    feather: f32,
) {
    let (t_norm, s_norm) = if threshold <= 0.001 && feather <= 0.001 {
        (0.45f32, 0.25f32)
    } else {
        (threshold.clamp(0.0, 1.0), feather.clamp(0.0, 1.0))
    };

    // Center cutoff threshold in [0.10, 0.65]
    let center = 0.10f32 + t_norm * 0.55f32;
    // Transition spread half-width in [0.015, 0.25]
    let half_w = 0.015f32 + s_norm * 0.235f32;

    let v_min = (center - half_w).max(0.01f32);
    let v_max = (center + half_w).min(0.98f32);
    let span = (v_max - v_min).max(0.02f32);
    let inv_span = 1.0f32 / span;

    let total = alpha.len().min(output.len());
    if total != MODNET_SIZE * MODNET_SIZE {
        for i in 0..total {
            output[i] = alpha_to_byte(alpha[i], v_min, v_max, inv_span);
        }
        return;
    }

    // Step 1: Base Hermite S-curve mapping with smooth rolloff
    for i in 0..total {
        output[i] = alpha_to_byte(alpha[i], v_min, v_max, inv_span);
    }

    // Step 2: Edge-Aware 3x3 Anti-Aliasing on transition boundaries.
    // Smoothing is selectively applied to boundary contour pixels (0 < val < 255)
    // using a normalized 2D Gaussian [1, 2, 1] kernel, making edges silky-smooth without
    // degrading solid interior foreground or background contrast.
    let scratch = output.to_vec();
    for y in 1..MODNET_SIZE - 1 {
        let row = y * MODNET_SIZE;
        let row_prev = (y - 1) * MODNET_SIZE;
        let row_next = (y + 1) * MODNET_SIZE;
        for x in 1..MODNET_SIZE - 1 {
            let idx = row + x;
            let val = scratch[idx];
            if val > 0 && val < 255 {
                let tl = scratch[row_prev + x - 1] as u32;
                let tc = scratch[row_prev + x] as u32;
                let tr = scratch[row_prev + x + 1] as u32;
                let cl = scratch[row + x - 1] as u32;
                let cc = val as u32;
                let cr = scratch[row + x + 1] as u32;
                let bl = scratch[row_next + x - 1] as u32;
                let bc = scratch[row_next + x] as u32;
                let br = scratch[row_next + x + 1] as u32;

                let sum = (tl + tr + bl + br)
                    + ((tc + cl + cr + bc) << 1)
                    + (cc << 2);
                output[idx] = ((sum + 8) >> 4) as u8;
            } else if val == 0 {
                // Heal small isolated 1-pixel background holes in subject
                let neighbors_active = (scratch[row_prev + x] > 200) as u8
                    + (scratch[row_next + x] > 200) as u8
                    + (scratch[row + x - 1] > 200) as u8
                    + (scratch[row + x + 1] > 200) as u8;
                if neighbors_active >= 3 {
                    output[idx] = 200;
                }
            } else if val == 255 {
                // Suppress floating noise speckles in background
                let neighbors_zero = (scratch[row_prev + x] == 0) as u8
                    + (scratch[row_next + x] == 0) as u8
                    + (scratch[row + x - 1] == 0) as u8
                    + (scratch[row + x + 1] == 0) as u8;
                if neighbors_zero >= 3 {
                    output[idx] = 0;
                }
            }
        }
    }
}

/// Unpacks RLE-encoded alpha bytes directly into a 32-bit RGBA mask buffer in a single pass.
/// Each pixel gets R=G=B=A=alpha, eliminating intermediate buffers and removing JS byte loops completely.
pub fn unpack_alpha_rle_rgba(rle: &[u8], out_rgba: &mut [u8]) -> usize {
    if rle.len() < 2 {
        return 0;
    }
    let max_pixels = out_rgba.len() / 4;
    let mut pixel_idx = 0;
    let mut i = 0;
    let out_u32: &mut [u32] = unsafe {
        std::slice::from_raw_parts_mut(out_rgba.as_mut_ptr() as *mut u32, max_pixels)
    };
    while i + 1 < rle.len() && pixel_idx < max_pixels {
        let count = rle[i] as usize;
        let val = rle[i + 1] as u32;
        let val32 = val | (val << 8) | (val << 16) | (val << 24);
        let end = (pixel_idx + count).min(max_pixels);
        out_u32[pixel_idx..end].fill(val32);
        pixel_idx = end;
        i += 2;
    }
    pixel_idx * 4
}

#[inline]
fn alpha_to_byte(
    value: f32,
    v_min: f32,
    v_max: f32,
    inv_span: f32,
) -> u8 {
    if value <= v_min {
        0
    } else if value >= v_max {
        255
    } else {
        let u = (value - v_min) * inv_span;
        ((u * u * (3.0 - 2.0 * u) * 255.0) as i32).clamp(0, 255) as u8
    }
}

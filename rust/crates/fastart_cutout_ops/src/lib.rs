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
    let use_curve = threshold > 0.0 || feather > 0.0;
    let threshold = threshold.clamp(0.0, 1.0);
    let softness = feather.clamp(0.01, 1.0);
    let inv_softness = 1.0 / softness;
    let mut encoded = Vec::with_capacity(alpha.len() / 8);
    let Some((&first, rest)) = alpha.split_first() else {
        return encoded;
    };
    let mut current = alpha_to_byte(first, use_curve, threshold, softness, inv_softness);
    let mut count = 1usize;
    for &value in rest {
        let byte = alpha_to_byte(value, use_curve, threshold, softness, inv_softness);
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

#[inline]
fn alpha_to_byte(
    value: f32,
    use_curve: bool,
    threshold: f32,
    softness: f32,
    inv_softness: f32,
) -> u8 {
    let byte = if use_curve {
        if value >= threshold + softness {
            255
        } else if value <= threshold {
            0
        } else {
            let u = (value - threshold) * inv_softness;
            (u * u * (3.0 - 2.0 * u) * 255.0) as i32
        }
    } else {
        (value * 255.0) as i32
    };
    byte.clamp(0, 255) as u8
}

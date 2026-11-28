use std::alloc::{alloc, dealloc, Layout};
use std::slice;

const MODNET_INPUT_FLOATS: usize = 3 * 512 * 512;
const MODNET_ALPHA_FLOATS: usize = 512 * 512;
const MODNET_RGBA_BYTES: usize = 512 * 512 * 4;

#[no_mangle]
pub extern "C" fn fastart_cutout_alloc(size: usize) -> *mut u8 {
    let Ok(layout) = Layout::from_size_align(size, 16) else {
        return std::ptr::null_mut();
    };
    unsafe { alloc(layout) }
}

#[no_mangle]
pub extern "C" fn fastart_cutout_dealloc(pointer: *mut u8, size: usize) {
    if !pointer.is_null() && size > 0 {
        if let Ok(layout) = Layout::from_size_align(size, 16) {
            unsafe {
                dealloc(pointer, layout);
            }
        }
    }
}

#[no_mangle]
pub extern "C" fn fastart_cutout_prepare_modnet_input(
    rgba_pointer: *const u8,
    width: usize,
    height: usize,
    tensor_pointer: *mut f32,
) -> u32 {
    let Some(rgba_length) = width
        .checked_mul(height)
        .and_then(|pixels| pixels.checked_mul(4))
    else {
        return 0;
    };
    if rgba_pointer.is_null() || tensor_pointer.is_null() || rgba_length != MODNET_RGBA_BYTES {
        return 0;
    }
    let rgba = unsafe { slice::from_raw_parts(rgba_pointer, rgba_length) };
    let tensor = unsafe { slice::from_raw_parts_mut(tensor_pointer, MODNET_INPUT_FLOATS) };
    let (red, rest) = tensor.split_at_mut(MODNET_ALPHA_FLOATS);
    let (green, blue) = rest.split_at_mut(MODNET_ALPHA_FLOATS);
    for row in 0..512 {
        let start = row * 512;
        fastart_cutout_ops::prepare_modnet_row(
            rgba,
            width,
            height,
            row,
            &mut red[start..start + 512],
            &mut green[start..start + 512],
            &mut blue[start..start + 512],
        );
    }
    1
}

#[no_mangle]
pub extern "C" fn fastart_cutout_modnet_alpha_to_rle(
    alpha_pointer: *const f32,
    threshold: f32,
    feather: f32,
    output_pointer: *mut u8,
    output_capacity: usize,
) -> usize {
    fastart_cutout_modnet_alpha_to_rle_cropped(
        alpha_pointer,
        threshold,
        feather,
        0,
        0,
        0,
        0,
        output_pointer,
        output_capacity,
    )
}

#[no_mangle]
pub extern "C" fn fastart_cutout_modnet_alpha_to_rle_cropped(
    alpha_pointer: *const f32,
    threshold: f32,
    feather: f32,
    crop_x: u32,
    crop_y: u32,
    crop_w: u32,
    crop_h: u32,
    output_pointer: *mut u8,
    output_capacity: usize,
) -> usize {
    fastart_cutout_modnet_alpha_to_rle_rgba(
        alpha_pointer,
        std::ptr::null(),
        threshold,
        feather,
        crop_x,
        crop_y,
        crop_w,
        crop_h,
        output_pointer,
        output_capacity,
    )
}

#[no_mangle]
pub extern "C" fn fastart_cutout_modnet_alpha_to_rle_rgba(
    alpha_pointer: *const f32,
    rgba_pointer: *const u8,
    threshold: f32,
    feather: f32,
    crop_x: u32,
    crop_y: u32,
    crop_w: u32,
    crop_h: u32,
    output_pointer: *mut u8,
    output_capacity: usize,
) -> usize {
    if alpha_pointer.is_null() || output_pointer.is_null() || output_capacity == 0 {
        return 0;
    }
    let alpha = unsafe { slice::from_raw_parts(alpha_pointer, MODNET_ALPHA_FLOATS) };
    let rgba = if !rgba_pointer.is_null() {
        Some(unsafe { slice::from_raw_parts(rgba_pointer, MODNET_ALPHA_FLOATS * 4) })
    } else {
        None
    };
    let encoded = fastart_cutout_ops::modnet_alpha_to_rle_rgba(
        alpha,
        rgba,
        threshold,
        feather,
        crop_x as usize,
        crop_y as usize,
        crop_w as usize,
        crop_h as usize,
    );
    if encoded.len() > output_capacity {
        return 0;
    }
    unsafe {
        slice::from_raw_parts_mut(output_pointer, encoded.len()).copy_from_slice(&encoded);
    }
    encoded.len()
}

#[no_mangle]
pub extern "C" fn fastart_cutout_defringe_rgba(
    rgba_pointer: *mut u8,
    width: u32,
    height: u32,
) {
    if rgba_pointer.is_null() || width == 0 || height == 0 {
        return;
    }
    let total_bytes = (width as usize) * (height as usize) * 4;
    let rgba = unsafe { slice::from_raw_parts_mut(rgba_pointer, total_bytes) };
    fastart_cutout_ops::defringe_rgba(rgba, width as usize, height as usize);
}

#[no_mangle]
pub extern "C" fn fastart_cutout_unpack_alpha_rle_rgba(
    rle_pointer: *const u8,
    rle_length: usize,
    output_pointer: *mut u8,
    output_capacity: usize,
) -> usize {
    if rle_pointer.is_null() || output_pointer.is_null() || rle_length == 0 || output_capacity == 0 {
        return 0;
    }
    let rle = unsafe { slice::from_raw_parts(rle_pointer, rle_length) };
    let out_rgba = unsafe { slice::from_raw_parts_mut(output_pointer, output_capacity) };
    fastart_cutout_ops::unpack_alpha_rle_rgba(rle, out_rgba)
}

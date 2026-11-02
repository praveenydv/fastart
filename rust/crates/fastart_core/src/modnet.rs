use std::io::Cursor;
use std::sync::{Arc, OnceLock, RwLock};

use tract_onnx::prelude::*;

#[cfg(target_arch = "wasm32")]
#[no_mangle]
pub unsafe extern "Rust" fn __getrandom_v03_custom(
    dest: *mut u8,
    len: usize,
) -> Result<(), getrandom::Error> {
    if dest.is_null() && len != 0 {
        return Err(getrandom::Error::UNSUPPORTED);
    }
    // Browser Web Crypto supplies entropy without requiring wasm-bindgen glue.
    extern "C" {
        fn fastart_fill_random(dest: *mut u8, len: usize) -> i32;
    }
    if unsafe { fastart_fill_random(dest, len) } == 0 {
        return Err(getrandom::Error::UNSUPPORTED);
    }
    Ok(())
}

use crate::{prepare_modnet_input_tensor, process_modnet_output_tensor};

const MODNET_INPUT_FLOATS: usize = 3 * 512 * 512;
const MODNET_OUTPUT_FLOATS: usize = 512 * 512;

static MODNET_RUNNABLE: OnceLock<RwLock<Option<Arc<TypedRunnableModel>>>> = OnceLock::new();

fn model_slot() -> &'static RwLock<Option<Arc<TypedRunnableModel>>> {
    MODNET_RUNNABLE.get_or_init(|| RwLock::new(None))
}

/// Converts the `file://` URI returned by Expo FileSystem into a native path.
/// Other native callers may already pass a plain filesystem path.
pub fn local_model_path(path: &str) -> Result<String, String> {
    let uri_path = path.strip_prefix("file://").unwrap_or(path);
    let bytes = uri_path.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len() {
                return Err("MODNet file URI contains an incomplete escape".into());
            }
            let high = (bytes[index + 1] as char).to_digit(16);
            let low = (bytes[index + 2] as char).to_digit(16);
            let (Some(high), Some(low)) = (high, low) else {
                return Err("MODNet file URI contains an invalid escape".into());
            };
            decoded.push(((high << 4) | low) as u8);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(decoded).map_err(|_| "MODNet file path is not valid UTF-8".into())
}

/// Loads and optimizes a MODNet ONNX model once for reuse by all frame inference calls.
pub fn initialize_modnet(model_bytes: &[u8]) -> Result<(), String> {
    if model_bytes.is_empty() {
        return Err("MODNet model is empty".into());
    }
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(model_bytes);
    let digest_hex = format!("{digest:x}");
    if digest_hex != "07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9" {
        return Err("MODNet model checksum does not match the pinned model".into());
    }
    let mut cursor = Cursor::new(model_bytes);
    let model = tract_onnx::onnx()
        .model_for_read(&mut cursor)
        .and_then(|model| model.with_input_fact(0, f32::fact([1, 3, 512, 512]).into()))
        .and_then(|model| model.into_optimized())
        .and_then(|model| model.into_runnable())
        .map_err(|error| format!("MODNet ONNX initialization failed: {error}"))?;
    *model_slot()
        .write()
        .map_err(|_| "MODNet model lock is unavailable".to_string())? = Some(model);
    Ok(())
}

/// Runs the cached MODNet model on a normalized NCHW tensor created by the Rust cutout pipeline.
pub fn infer_modnet(input: &[f32], output: &mut [f32]) -> Result<(), String> {
    if input.len() != MODNET_INPUT_FLOATS || output.len() != MODNET_OUTPUT_FLOATS {
        return Err("MODNet input or output tensor has the wrong shape".into());
    }
    let model = model_slot()
        .read()
        .map_err(|_| "MODNet model lock is unavailable".to_string())?
        .clone()
        .ok_or_else(|| "MODNet model is not initialized".to_string())?;
    let tensor = Tensor::from_shape(&[1, 3, 512, 512], input)
        .map_err(|error| format!("MODNet input tensor creation failed: {error}"))?;
    let results = model
        .run(tvec!(tensor.into()))
        .map_err(|error| format!("MODNet inference failed: {error}"))?;
    let alpha = results
        .first()
        .ok_or_else(|| "MODNet returned no output tensor".to_string())?
        .to_plain_array_view::<f32>()
        .map_err(|error| format!("MODNet output tensor has an unexpected type: {error}"))?;
    if alpha.len() != MODNET_OUTPUT_FLOATS {
        return Err(format!("MODNet returned {} alpha values", alpha.len()));
    }
    output.copy_from_slice(
        alpha
            .as_slice()
            .ok_or_else(|| "MODNet output tensor is not contiguous".to_string())?,
    );
    Ok(())
}

/// Runs the shared portrait model and matting post-process on an RGBA frame.
pub fn infer_modnet_rgba(
    rgba: &[u8],
    width: usize,
    height: usize,
    threshold: f32,
    feather: f32,
) -> Result<Vec<u8>, String> {
    let pixels = width
        .checked_mul(height)
        .ok_or("Invalid frame dimensions")?;
    if width == 0 || height == 0 || rgba.len() != pixels.saturating_mul(4) {
        return Err("RGBA frame has the wrong dimensions".into());
    }
    let mut input = vec![0.0; MODNET_INPUT_FLOATS];
    prepare_modnet_input_tensor(rgba, width, height, &mut input);
    let mut alpha = vec![0.0; MODNET_OUTPUT_FLOATS];
    infer_modnet(&input, &mut alpha)?;
    let mut matte_rgba = vec![0; MODNET_OUTPUT_FLOATS * 4];
    process_modnet_output_tensor(&alpha, &mut matte_rgba, threshold, feather);
    let mut output = vec![0; pixels];
    for y in 0..height {
        let source_y = y * 512 / height;
        for x in 0..width {
            let source_x = x * 512 / width;
            output[y * width + x] = matte_rgba[(source_y * 512 + source_x) * 4 + 3];
        }
    }
    Ok(output)
}

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
    modnet_alpha_to_rle_rgba(alpha, None, threshold, feather, 0, 0, 0, 0)
}

pub fn modnet_alpha_to_rle_cropped(
    alpha: &[f32],
    threshold: f32,
    feather: f32,
    crop_x: usize,
    crop_y: usize,
    crop_w: usize,
    crop_h: usize,
) -> Vec<u8> {
    modnet_alpha_to_rle_rgba(alpha, None, threshold, feather, crop_x, crop_y, crop_w, crop_h)
}

pub fn modnet_alpha_to_rle_rgba(
    alpha: &[f32],
    rgba: Option<&[u8]>,
    threshold: f32,
    feather: f32,
    crop_x: usize,
    crop_y: usize,
    crop_w: usize,
    crop_h: usize,
) -> Vec<u8> {
    let mut smoothed = vec![0u8; alpha.len()];
    smooth_modnet_alpha_cropped_rgba(alpha, rgba, &mut smoothed, threshold, feather, crop_x, crop_y, crop_w, crop_h);

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
/// Applies a calibrated quintic smootherstep curve, followed by geodesic region growing from
/// the primary human core to preserve full body continuity (including white pants, shoes, and hands)
/// while completely isolating disconnected background walls, text, and floaters.
/// Bounded to active letterbox/pillarbox region so camera frame boundaries (e.g. legs reaching bottom)
/// retain 100% solid opacity without any erosion or clipping.
#[inline]
pub fn smooth_modnet_alpha(
    alpha: &[f32],
    output: &mut [u8],
    threshold: f32,
    feather: f32,
) {
    smooth_modnet_alpha_cropped_rgba(alpha, None, output, threshold, feather, 0, 0, 0, 0);
}

pub fn smooth_modnet_alpha_cropped(
    alpha: &[f32],
    output: &mut [u8],
    threshold: f32,
    feather: f32,
    crop_x: usize,
    crop_y: usize,
    crop_w: usize,
    crop_h: usize,
) {
    smooth_modnet_alpha_cropped_rgba(alpha, None, output, threshold, feather, crop_x, crop_y, crop_w, crop_h);
}

pub fn smooth_modnet_alpha_cropped_rgba(
    alpha: &[f32],
    _rgba: Option<&[u8]>,
    output: &mut [u8],
    threshold: f32,
    feather: f32,
    crop_x: usize,
    crop_y: usize,
    crop_w: usize,
    crop_h: usize,
) {
    let (t_norm, s_norm) = if threshold <= 0.001 && feather <= 0.001 {
        (0.45f32, 0.25f32)
    } else {
        (threshold.clamp(0.0, 1.0), feather.clamp(0.0, 1.0))
    };

    // v_min in [0.16, 0.40]: Clean outer background rejection so playback & fullscreen edges stay halo-free.
    let v_min = (0.23f32 + (t_norm - 0.45f32) * 0.25f32).clamp(0.16f32, 0.40f32);
    // v_max in [0.55, 0.85]: Solid subject core threshold.
    let v_max = (0.58f32 + t_norm * 0.10f32 + s_norm * 0.08f32).clamp(v_min + 0.25f32, 0.85f32);
    let span = (v_max - v_min).max(0.10f32);
    let inv_span = 1.0f32 / span;

    let total = alpha.len().min(output.len());
    if total != MODNET_SIZE * MODNET_SIZE {
        for i in 0..total {
            output[i] = alpha_to_byte_smoother(alpha[i], v_min, v_max, inv_span);
        }
        return;
    }

    // Determine active video content bounding box (to protect camera edges like bottom legs from erosion)
    let (min_x, max_x, min_y, max_y) = if crop_w > 0 && crop_h > 0 {
        (
            crop_x.min(MODNET_SIZE - 1),
            (crop_x + crop_w).saturating_sub(1).min(MODNET_SIZE - 1),
            crop_y.min(MODNET_SIZE - 1),
            (crop_y + crop_h).saturating_sub(1).min(MODNET_SIZE - 1),
        )
    } else {
        (0, MODNET_SIZE - 1, 0, MODNET_SIZE - 1)
    };

    // Step 1: Find high-confidence Human Core Seeds (raw alpha >= 0.50).
    let mut core_visited = vec![false; total];
    let mut labels = vec![0u32; total];
    let mut current_label = 0u32;
    let mut comp_sizes: Vec<(u32, usize)> = Vec::new();
    let mut queue = Vec::with_capacity(4096);

    for idx in 0..total {
        let cy = idx / MODNET_SIZE;
        let cx = idx % MODNET_SIZE;
        if cy >= min_y && cy <= max_y && cx >= min_x && cx <= max_x && alpha[idx] >= 0.50 && !core_visited[idx] {
            current_label += 1;
            let mut count = 0usize;
            queue.clear();
            queue.push(idx);
            core_visited[idx] = true;
            labels[idx] = current_label;

            let mut q_head = 0;
            while q_head < queue.len() {
                let cur = queue[q_head];
                q_head += 1;
                count += 1;

                let y = cur / MODNET_SIZE;
                let x = cur % MODNET_SIZE;

                if y > min_y {
                    let n = cur - MODNET_SIZE;
                    if alpha[n] >= 0.50 && !core_visited[n] {
                        core_visited[n] = true;
                        labels[n] = current_label;
                        queue.push(n);
                    }
                }
                if y < max_y {
                    let n = cur + MODNET_SIZE;
                    if alpha[n] >= 0.50 && !core_visited[n] {
                        core_visited[n] = true;
                        labels[n] = current_label;
                        queue.push(n);
                    }
                }
                if x > min_x {
                    let n = cur - 1;
                    if alpha[n] >= 0.50 && !core_visited[n] {
                        core_visited[n] = true;
                        labels[n] = current_label;
                        queue.push(n);
                    }
                }
                if x < max_x {
                    let n = cur + 1;
                    if alpha[n] >= 0.50 && !core_visited[n] {
                        core_visited[n] = true;
                        labels[n] = current_label;
                        queue.push(n);
                    }
                }
            }
            comp_sizes.push((current_label, count));
        }
    }

    let has_salient_human = if let Some(&(_max_label, max_size)) = comp_sizes.iter().max_by_key(|(_, size)| *size) {
        max_size >= 120
    } else {
        false
    };

    if !has_salient_human {
        // Fallback for empty frame or synthetic test without salient human body (< 120 pixels)
        for idx in 0..total {
            let cy = idx / MODNET_SIZE;
            let cx = idx % MODNET_SIZE;
            if cy >= min_y && cy <= max_y && cx >= min_x && cx <= max_x {
                let r = alpha[idx];
                if r > v_min {
                    let u = ((r - v_min) * inv_span).clamp(0.0, 1.0);
                    let s = u * u * u * (u * (u * 6.0f32 - 15.0f32) + 10.0f32);
                    output[idx] = ((s * 255.0f32).round() as i32).clamp(0, 255) as u8;
                } else {
                    output[idx] = 0;
                }
            } else {
                output[idx] = 0;
            }
        }
        return;
    }

    // Step 2: Anatomical Head Crown Detection on primary body component.
    let (max_label, max_size) = *comp_sizes.iter().max_by_key(|(_, size)| *size).unwrap();

    let mut body_min_y = MODNET_SIZE;
    let mut body_max_y = 0;
    struct RowSpan {
        span: usize,
    }
    let mut row_spans: Vec<Option<RowSpan>> = (0..MODNET_SIZE).map(|_| None).collect();

    for y in min_y..=max_y {
        let mut row_min_x = MODNET_SIZE;
        let mut row_max_x = 0;
        let mut count = 0;
        let row_start = y * MODNET_SIZE;
        for x in min_x..=max_x {
            if labels[row_start + x] == max_label {
                count += 1;
                if x < row_min_x { row_min_x = x; }
                if x > row_max_x { row_max_x = x; }
            }
        }
        if count > 0 {
            if y < body_min_y { body_min_y = y; }
            if y > body_max_y { body_max_y = y; }
            row_spans[y] = Some(RowSpan {
                span: row_max_x - row_min_x + 1,
            });
        }
    }

    // Detect true human head crown:
    // Human head has span >= 6 that is sustained over 3+ of the next 4 consecutive rows.
    // Narrow vertical antennas/masts/poles have span <= 4.
    let mut crown_y = body_min_y;
    for y in body_min_y..=body_max_y.min(body_min_y + 60) {
        if let Some(ref s) = row_spans[y] {
            if s.span >= 6 {
                let mut sustained = 0;
                for k in 1..=4 {
                    if y + k <= max_y {
                        if let Some(ref sk) = row_spans[y + k] {
                            if sk.span >= 6 {
                                sustained += 1;
                            }
                        }
                    }
                }
                if sustained >= 3 {
                    crown_y = y;
                    break;
                }
            }
        }
    }

    // Step 3: Valid Core Labels.
    // CRITICAL: A secondary component is ONLY kept if its ENTIRE bounding box starts at or below crown_y.
    // This eliminates floating trees/antennas/plants whose tops are above the head even if their
    // bottom pixels dip slightly below (the old compMaxY > crownY check was too permissive).
    let mut valid_core_labels = vec![false; current_label as usize + 1];
    valid_core_labels[max_label as usize] = true;
    let min_keep_size = max_size / 6;

    // Also track the main subject's x-span at crown_y for horizontal overlap check
    let mut main_min_x_at_crown = MODNET_SIZE;
    let mut main_max_x_at_crown = 0;
    for x in min_x..=max_x {
        let idx = crown_y * MODNET_SIZE + x;
        if labels[idx] == max_label {
            if x < main_min_x_at_crown { main_min_x_at_crown = x; }
            if x > main_max_x_at_crown { main_max_x_at_crown = x; }
        }
    }
    // Extend search a few rows below crown to get a stable shoulder width
    let shoulder_scan_end = (crown_y + 20).min(max_y);
    for y in crown_y..=shoulder_scan_end {
        for x in min_x..=max_x {
            let idx = y * MODNET_SIZE + x;
            if labels[idx] == max_label {
                if x < main_min_x_at_crown { main_min_x_at_crown = x; }
                if x > main_max_x_at_crown { main_max_x_at_crown = x; }
            }
        }
    }

    for &(label, size) in &comp_sizes {
        if label == max_label { continue; }
        if size >= min_keep_size {
            let mut comp_min_y = MODNET_SIZE;
            let mut comp_max_y = 0;
            let mut comp_min_x = MODNET_SIZE;
            let mut comp_max_x = 0;
            for i in 0..total {
                if labels[i] == label {
                    let cy = i / MODNET_SIZE;
                    let cx = i % MODNET_SIZE;
                    if cy < comp_min_y { comp_min_y = cy; }
                    if cy > comp_max_y { comp_max_y = cy; }
                    if cx < comp_min_x { comp_min_x = cx; }
                    if cx > comp_max_x { comp_max_x = cx; }
                }
            }
            // Requirement 1: component must START at or below crown_y (not a floating island above head)
            let starts_below_crown = comp_min_y >= crown_y;
            // Requirement 2: component must have horizontal overlap with the main subject's shoulder width
            let overlap_x = comp_min_x <= main_max_x_at_crown && comp_max_x >= main_min_x_at_crown;
            if starts_below_crown && overlap_x {
                valid_core_labels[label as usize] = true;
            }
        }
    }

    // Step 4: Geodesic Region Growing from the human core.
    let mut is_human = vec![false; total];
    queue.clear();

    for idx in 0..total {
        let l = labels[idx] as usize;
        if l != 0 && valid_core_labels[l] {
            let cy = idx / MODNET_SIZE;
            // Prune narrow antenna needle pixels above crown_y
            if cy >= crown_y {
                is_human[idx] = true;
                queue.push(idx);
            }
        }
    }

    let mut q_head = 0;
    while q_head < queue.len() {
        let cur = queue[q_head];
        q_head += 1;

        let cy = (cur / MODNET_SIZE) as i32;
        let cx = (cur % MODNET_SIZE) as i32;

        for dy in -1..=1 {
            for dx in -1..=1 {
                if dx == 0 && dy == 0 { continue; }
                let ny = cy + dy;
                let nx = cx + dx;
                // Strictly prevent growing above crown_y into sky / antenna lattice!
                if ny >= crown_y as i32 && ny <= max_y as i32 && nx >= min_x as i32 && nx <= max_x as i32 {
                    let n_idx = (ny as usize) * MODNET_SIZE + (nx as usize);
                    if !is_human[n_idx] && alpha[n_idx] >= v_min {
                        is_human[n_idx] = true;
                        queue.push(n_idx);
                    }
                }
            }
        }
    }

    // Preserve natural rounded crown apex 1-2 pixels above crown_y if directly supported below
    for y in min_y.max(crown_y.saturating_sub(2))..crown_y {
        for x in min_x..=max_x {
            let idx = y * MODNET_SIZE + x;
            if alpha[idx] >= 0.50 && is_human[idx + MODNET_SIZE] {
                is_human[idx] = true;
            }
        }
    }

    // Step 5: Two-Pass Euclidean Distance Transform bounded strictly to the active video frame.
    // Active frame boundaries (y == min_y, y == max_y, x == min_x, x == max_x) bordering human
    // are treated as off-camera subject extensions, preventing bottom pants/legs from being eroded!
    let mut dist = vec![0.0f32; total];
    const INF: f32 = 1e6;
    for idx in 0..total {
        dist[idx] = if is_human[idx] { INF } else { 0.0 };
    }

    // Forward pass (top-left to bottom-right within active bounds)
    for y in min_y..=max_y {
        let row = y * MODNET_SIZE;
        let row_prev = if y > min_y { Some((y - 1) * MODNET_SIZE) } else { None };
        for x in min_x..=max_x {
            let idx = row + x;
            if dist[idx] > 0.0 {
                let mut m = dist[idx];
                if x > min_x {
                    let d = dist[idx - 1] + 1.0;
                    if d < m { m = d; }
                }
                if let Some(rp) = row_prev {
                    let d = dist[rp + x] + 1.0;
                    if d < m { m = d; }
                    if x > min_x {
                        let d = dist[rp + x - 1] + 1.414;
                        if d < m { m = d; }
                    }
                    if x < max_x {
                        let d = dist[rp + x + 1] + 1.414;
                        if d < m { m = d; }
                    }
                }
                dist[idx] = m;
            }
        }
    }

    // Backward pass (bottom-right to top-left within active bounds)
    for y in (min_y..=max_y).rev() {
        let row = y * MODNET_SIZE;
        let row_next = if y < max_y { Some((y + 1) * MODNET_SIZE) } else { None };
        for x in (min_x..=max_x).rev() {
            let idx = row + x;
            if dist[idx] > 0.0 {
                let mut m = dist[idx];
                if x < max_x {
                    let d = dist[idx + 1] + 1.0;
                    if d < m { m = d; }
                }
                if let Some(rn) = row_next {
                    let d = dist[rn + x] + 1.0;
                    if d < m { m = d; }
                    if x < max_x {
                        let d = dist[rn + x + 1] + 1.414;
                        if d < m { m = d; }
                    }
                    if x > min_x {
                        let d = dist[rn + x - 1] + 1.414;
                        if d < m { m = d; }
                    }
                }
                dist[idx] = m;
            }
        }
    }

    // Step 6: Level-Set Gaussian Curvature Smoothing for Sharp & Smooth Curves
    let mut phi = vec![0.0f32; total];
    for y in min_y..=max_y {
        let row = y * MODNET_SIZE;
        for x in min_x..=max_x {
            let idx = row + x;
            if is_human[idx] {
                let d = dist[idx];
                let r = alpha[idx];
                if d >= 2.5f32 {
                    phi[idx] = r.max(0.85f32);
                } else if d >= 1.0f32 {
                    let w = (d - 1.0f32) / 1.5f32;
                    phi[idx] = r.max(r * (1.0f32 - w) + 0.85f32 * w);
                } else {
                    phi[idx] = r;
                }
            }
        }
    }

    // Separable 5-tap Gaussian Blur to eliminate raster discretization ripples
    let kernel = [0.06136f32, 0.24477f32, 0.38774f32, 0.24477f32, 0.06136f32];
    let mut temp = vec![0.0f32; total];
    let mut smoothed = vec![0.0f32; total];

    // Horizontal pass
    for y in min_y..=max_y {
        let row = y * MODNET_SIZE;
        for x in min_x..=max_x {
            let mut sum = 0.0f32;
            for k in -2..=2 {
                let nx = (x as isize + k).clamp(min_x as isize, max_x as isize) as usize;
                sum += phi[row + nx] * kernel[(k + 2) as usize];
            }
            temp[row + x] = sum;
        }
    }

    // Vertical pass
    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let mut sum = 0.0f32;
            for k in -2..=2 {
                let ny = (y as isize + k).clamp(min_y as isize, max_y as isize) as usize;
                sum += temp[ny * MODNET_SIZE + x] * kernel[(k + 2) as usize];
            }
            smoothed[y * MODNET_SIZE + x] = sum;
        }
    }

    // Sharp & Smooth Curve Sigmoid Mapping — cutoff=0.58 (min_thresh=0.50) eliminates white/yellow
    // sky/background edge lines during 60fps playback without needing guided filter readback.
    let cutoff = (0.58f32 + (t_norm - 0.45f32) * 0.20f32).clamp(0.45f32, 0.70f32);
    let half_w = (0.08f32 + (s_norm - 0.25f32) * 0.06f32).clamp(0.05f32, 0.14f32);
    let min_thresh = cutoff - half_w;
    let max_thresh = cutoff + half_w;
    let inv_w = 1.0f32 / (2.0f32 * half_w);

    for y in 0..MODNET_SIZE {
        let row = y * MODNET_SIZE;
        for x in 0..MODNET_SIZE {
            let idx = row + x;
            if y < min_y || y > max_y || x < min_x || x > max_x || !is_human[idx] {
                output[idx] = 0;
                continue;
            }

            let r = alpha[idx];
            // Enforce 100% solid opacity on bottom camera frame boundary where subject reaches bottom
            if y >= max_y.saturating_sub(2) && r >= 0.15f32 {
                output[idx] = 255;
                continue;
            }

            let d = dist[idx];
            let val = smoothed[idx];
            let opacity = if val <= min_thresh {
                0u8
            } else if val >= max_thresh {
                255u8
            } else {
                let u = (val - min_thresh) * inv_w;
                let s = u * u * u * (u * (u * 6.0f32 - 15.0f32) + 10.0f32);
                (s * 255.0f32).round().clamp(0.0, 255.0) as u8
            };

            // Boundary transition anti-aliasing (strictly d < 1.5)
            if d < 1.5f32 && opacity > 0 {
                let boundary_weight = (d / 1.45f32).clamp(0.0, 1.0);
                let val = (opacity as f32 * boundary_weight).round() as i32;
                output[idx] = val.clamp(1, 254) as u8;
            } else {
                output[idx] = opacity;
            }
        }
    }

}

/// Decontaminates edge transition pixels by suppressing background color bleed/halos.
/// For boundary pixels (4 <= alpha <= 250), searches nearby solid interior foreground pixels
/// and blends the edge color towards the true foreground color. Zeroes out faint noise (alpha < 4).
pub fn defringe_rgba(rgba: &mut [u8], width: usize, height: usize) {
    let total = width * height;
    if rgba.len() < total * 4 || width < 4 || height < 4 {
        return;
    }

    let mut has_transition = false;
    for i in 0..total {
        let a = rgba[i * 4 + 3];
        if a >= 4 && a <= 250 {
            has_transition = true;
            break;
        }
    }
    if !has_transition {
        for i in 0..total {
            if rgba[i * 4 + 3] < 4 {
                rgba[i * 4 + 3] = 0;
            }
        }
        return;
    }

    // Adaptive search radius based on render resolution (e.g. 5px at 1080p, 3px at 480p)
    let max_dim = width.max(height);
    let r = ((max_dim as f32 / 300.0).round() as usize).clamp(3, 7);

    for y in 0..height {
        let row_idx = y * width;
        let y_min = y.saturating_sub(r);
        let y_max = (y + r).min(height - 1);

        for x in 0..width {
            let idx = (row_idx + x) * 4;
            let a = rgba[idx + 3];

            if a < 4 {
                rgba[idx + 3] = 0;
                continue;
            }
            if a > 250 {
                continue;
            }

            let x_min = x.saturating_sub(r);
            let x_max = (x + r).min(width - 1);

            let mut fg_r = 0.0f32;
            let mut fg_g = 0.0f32;
            let mut fg_b = 0.0f32;
            let mut fg_weight = 0.0f32;

            for ny in y_min..=y_max {
                let n_row = ny * width;
                let dy = (ny as isize - y as isize) as f32;
                for nx in x_min..=x_max {
                    let n_idx = (n_row + nx) * 4;
                    let na = rgba[n_idx + 3];
                    if na >= 235 {
                        let dx = (nx as isize - x as isize) as f32;
                        let dist_sq = dx * dx + dy * dy;
                        let w = 1.0f32 / (1.0f32 + dist_sq);
                        fg_r += (rgba[n_idx] as f32) * w;
                        fg_g += (rgba[n_idx + 1] as f32) * w;
                        fg_b += (rgba[n_idx + 2] as f32) * w;
                        fg_weight += w;
                    }
                }
            }

            if fg_weight > 0.0 {
                let avg_r = (fg_r / fg_weight).clamp(0.0, 255.0);
                let avg_g = (fg_g / fg_weight).clamp(0.0, 255.0);
                let avg_b = (fg_b / fg_weight).clamp(0.0, 255.0);

                let cur_r = rgba[idx] as f32;
                let cur_g = rgba[idx + 1] as f32;
                let cur_b = rgba[idx + 2] as f32;

                // Edge decontamination weight: stronger blending on outer semi-transparent pixels
                let alpha_norm = a as f32 / 255.0f32;
                let blend_w = (1.0f32 - alpha_norm).powf(0.75f32) * 0.95f32;
                let inv_blend = 1.0f32 - blend_w;

                rgba[idx] = (cur_r * inv_blend + avg_r * blend_w).round().clamp(0.0, 255.0) as u8;
                rgba[idx + 1] = (cur_g * inv_blend + avg_g * blend_w).round().clamp(0.0, 255.0) as u8;
                rgba[idx + 2] = (cur_b * inv_blend + avg_b * blend_w).round().clamp(0.0, 255.0) as u8;
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
fn alpha_to_byte_smoother(
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
        // Ken Perlin's quintic smootherstep: 6u^5 - 15u^4 + 10u^3
        let u = (value - v_min) * inv_span;
        let s = u * u * u * (u * (u * 6.0f32 - 15.0f32) + 10.0f32);
        ((s * 255.0f32) as i32).clamp(0, 255) as u8
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_background_rejection_and_human_isolation() {
        let total = MODNET_SIZE * MODNET_SIZE;
        let mut alpha = vec![0.0f32; total];

        // 1. Draw large human body in center (y: 100..350, x: 200..320)
        for y in 100..350 {
            for x in 200..320 {
                alpha[y * MODNET_SIZE + x] = 0.95;
            }
        }

        // Add white pants extending down to bottom (y: 350..500, x: 210..310) with moderate alpha ~0.28
        for y in 350..500 {
            for x in 210..310 {
                alpha[y * MODNET_SIZE + x] = 0.28;
            }
        }

        // 2. Add distant background object / white wall patch on top-left (y: 10..40, x: 10..40)
        for y in 10..40 {
            for x in 10..40 {
                alpha[y * MODNET_SIZE + x] = 0.85;
            }
        }

        // 3. Add faint billboard text noise (alpha ~0.38)
        for y in 60..75 {
            for x in 100..180 {
                alpha[y * MODNET_SIZE + x] = 0.38;
            }
        }

        let mut output = vec![0u8; total];
        smooth_modnet_alpha(&alpha, &mut output, 0.45, 0.25);

        // Center of human body must be solid foreground
        let center_idx = 250 * MODNET_SIZE + 260;
        assert_eq!(output[center_idx], 255);

        // Connected white pants extending down must be preserved and solid (>= 240)
        let pants_idx = 450 * MODNET_SIZE + 260;
        assert!(output[pants_idx] >= 240, "White pants connected to body must be preserved");

        // Distant background patch (y: 10..40, x: 10..40) must be COMPLETELY PURGED (0)
        for y in 10..40 {
            for x in 10..40 {
                assert_eq!(output[y * MODNET_SIZE + x], 0, "Distant background patch must be 0");
            }
        }

        // Faint billboard text must be COMPLETELY PURGED (0)
        for y in 60..75 {
            for x in 100..180 {
                assert_eq!(output[y * MODNET_SIZE + x], 0, "Billboard text must be 0");
            }
        }
    }

    #[test]
    fn test_edge_anti_aliased_subpixel_smoothness() {
        let total = MODNET_SIZE * MODNET_SIZE;
        let mut alpha = vec![0.0f32; total];

        // Draw human subject from x: 200..300, y: 150..350
        for y in 150..350 {
            for x in 200..300 {
                alpha[y * MODNET_SIZE + x] = 0.98;
            }
        }

        let mut output = vec![0u8; total];
        smooth_modnet_alpha(&alpha, &mut output, 0.45, 0.25);

        let y = 250;
        let row = y * MODNET_SIZE;

        // Background outside subject (x=199) is 0
        assert_eq!(output[row + 199], 0);

        // Transition zone at boundary (x=200) has smooth subpixel anti-aliasing
        let edge_val = output[row + 200];
        let interior_val = output[row + 201];
        let deep_interior_val = output[row + 210];

        assert!(edge_val > 0 && edge_val < 255, "Edge pixel must be anti-aliased: {}", edge_val);
        assert_eq!(interior_val, 255, "Interior pixel (x=201) must be 100% solid: {}", interior_val);
        assert_eq!(deep_interior_val, 255, "Deep interior must be solid 255: {}", deep_interior_val);
    }

    #[test]
    fn test_letterbox_bottom_boundary_solidity() {
        let total = MODNET_SIZE * MODNET_SIZE;
        let mut alpha = vec![0.0f32; total];

        // 16:9 letterbox in 512x512: dy = 112, dh = 288 -> y in 112..=399
        // Draw person from y = 150 down to row 399 (touching bottom camera edge)
        for y in 150..=399 {
            for x in 220..300 {
                alpha[y * MODNET_SIZE + x] = 0.95;
            }
        }

        let mut output = vec![0u8; total];
        smooth_modnet_alpha_cropped(&alpha, &mut output, 0.45, 0.25, 0, 112, 512, 288);

        // Row 399 (the bottom edge of the video frame) MUST BE 100% SOLID (255) across the legs!
        for x in 230..290 {
            assert_eq!(output[399 * MODNET_SIZE + x], 255, "Legs reaching bottom camera boundary must remain 255 solid");
        }

        // Row 400 (outside the video frame, padding) MUST BE 0
        for x in 0..MODNET_SIZE {
            assert_eq!(output[400 * MODNET_SIZE + x], 0, "Padding row 400 must be 0");
        }
    }

    #[test]
    fn test_defringe_edge_halo_suppression() {
        let width = 10;
        let height = 10;
        let mut rgba = vec![0u8; width * height * 4];

        // Set interior pixel (x=5, y=5) to solid denim jacket: R=45, G=65, B=90, A=255
        let interior_idx = (5 * width + 5) * 4;
        rgba[interior_idx] = 45;
        rgba[interior_idx + 1] = 65;
        rgba[interior_idx + 2] = 90;
        rgba[interior_idx + 3] = 255;

        // Set boundary pixel (x=4, y=5) with white background contamination: R=180, G=190, B=205, A=100
        let edge_idx = (5 * width + 4) * 4;
        rgba[edge_idx] = 180;
        rgba[edge_idx + 1] = 190;
        rgba[edge_idx + 2] = 205;
        rgba[edge_idx + 3] = 100;

        defringe_rgba(&mut rgba, width, height);

        // Edge pixel color must be pulled towards interior denim jacket (significantly lower than 180, 190, 205)
        assert!(rgba[edge_idx] < 120, "Decontaminated red must be pulled towards denim: {}", rgba[edge_idx]);
        assert!(rgba[edge_idx + 1] < 135, "Decontaminated green must be pulled towards denim: {}", rgba[edge_idx + 1]);
        assert!(rgba[edge_idx + 2] < 155, "Decontaminated blue must be pulled towards denim: {}", rgba[edge_idx + 2]);
    }

    #[test]
    fn test_cropped_rgba_preserves_halo_free_cutoff() {
        let total = MODNET_SIZE * MODNET_SIZE;
        let mut alpha = vec![0.0f32; total];
        let mut rgba = vec![255u8; total * 4];

        // Dark clothing subject in center
        for y in 150..350 {
            for x in 200..300 {
                let idx = y * MODNET_SIZE + x;
                alpha[idx] = 0.98;
                rgba[idx * 4] = 30;
                rgba[idx * 4 + 1] = 40;
                rgba[idx * 4 + 2] = 55;
            }
        }
        // Bright white sky bleed skirt outside boundary (raw alpha = 0.16)
        for y in 150..350 {
            for x in 196..200 {
                alpha[y * MODNET_SIZE + x] = 0.16;
            }
        }

        let mut out_plain = vec![0u8; total];
        let mut out_rgba = vec![0u8; total];
        smooth_modnet_alpha_cropped(&alpha, &mut out_plain, 0.45, 0.25, 0, 0, MODNET_SIZE, MODNET_SIZE);
        smooth_modnet_alpha_cropped_rgba(&alpha, Some(&rgba), &mut out_rgba, 0.45, 0.25, 0, 0, MODNET_SIZE, MODNET_SIZE);

        // Must match preview output identically and keep outer white-sky pixels completely transparent
        assert_eq!(out_rgba, out_plain);
        assert_eq!(out_rgba[250 * MODNET_SIZE + 196], 0);
        assert_eq!(out_rgba[250 * MODNET_SIZE + 250], 255);
    }
}

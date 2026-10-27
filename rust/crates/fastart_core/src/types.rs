use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FastArtProject {
    pub id: String,
    pub title: Option<String>,
    #[serde(rename = "createdAt", default)]
    pub created_at: Option<u64>,
    #[serde(rename = "updatedAt", default)]
    pub updated_at: Option<u64>,
    #[serde(rename = "aspectRatio", default = "default_aspect_ratio")]
    pub aspect_ratio: String,
    #[serde(default = "default_resolution")]
    pub resolution: String,
    #[serde(default = "default_fps")]
    pub fps: u32,
    #[serde(rename = "currentTime", default)]
    pub current_time: f64,
    #[serde(rename = "canvasBackground", default = "default_canvas_bg")]
    pub canvas_background: String,
    #[serde(rename = "beatMarkers", default)]
    pub beat_markers: Option<Vec<f64>>,
    #[serde(rename = "aiDenoise", default)]
    pub ai_denoise: Option<bool>,
    pub tracks: ProjectTracks,
}

fn default_aspect_ratio() -> String {
    "9:16".to_string()
}
fn default_resolution() -> String {
    "1080p".to_string()
}
fn default_fps() -> u32 {
    30
}
fn default_canvas_bg() -> String {
    "#000000".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeedCurvePoint {
    pub t: f64,
    pub s: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProjectTracks {
    #[serde(default)]
    pub video: Vec<VideoClip>,
    #[serde(default)]
    pub audio: Vec<AudioClip>,
    #[serde(default)]
    pub text: Vec<TextClip>,
    #[serde(default)]
    pub captions: Option<Vec<CaptionClip>>,
    #[serde(default)]
    pub stickers: Vec<StickerClip>,
    #[serde(default)]
    pub effects: Vec<EffectClip>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoClip {
    pub id: String,
    pub title: Option<String>,
    #[serde(rename = "type", default = "default_video_type")]
    pub clip_type: String, // "video" | "photo"
    pub url: String,
    pub thumbnail: Option<String>,
    pub duration: f64,
    #[serde(rename = "startTime")]
    pub start_time: f64,
    #[serde(rename = "trimIn", default)]
    pub trim_in: Option<f64>,
    #[serde(rename = "trimOut", default)]
    pub trim_out: Option<f64>,
    #[serde(rename = "mediaDuration", default)]
    pub media_duration: Option<f64>,
    #[serde(default = "default_one_f64")]
    pub speed: f64,
    #[serde(default = "default_one_f64")]
    pub volume: f64,
    #[serde(default = "default_one_f64")]
    pub opacity: f64,
    #[serde(rename = "hasAudio", default)]
    pub has_audio: Option<bool>,
    #[serde(default)]
    pub muted: Option<bool>,
    #[serde(rename = "fadeIn", default)]
    pub fade_in: Option<f64>,
    #[serde(rename = "fadeOut", default)]
    pub fade_out: Option<f64>,
    pub filter: Option<String>,
    pub effect: Option<String>,
    #[serde(rename = "effectIntensity", default = "default_one_f64")]
    pub effect_intensity: f64,
    pub transform: Option<ClipTransform>,
    pub fit: Option<String>, // "contain" | "cover"
    pub mask: Option<MaskConfig>,
    pub cutout: Option<CutoutConfig>,
    pub keyframes: Option<Vec<KeyframePoint>>,
    #[serde(rename = "trackIndex", default)]
    pub track_index: Option<i32>,
    #[serde(default)]
    pub layer: Option<i32>,
}

fn default_video_type() -> String {
    "video".to_string()
}
fn default_one_f64() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioClip {
    pub id: String,
    pub title: Option<String>,
    pub duration: f64,
    #[serde(rename = "startTime")]
    pub start_time: f64,
    #[serde(rename = "trimIn", default)]
    pub trim_in: Option<f64>,
    #[serde(rename = "trimOut", default)]
    pub trim_out: Option<f64>,
    #[serde(default = "default_one_f64")]
    pub speed: f64,
    #[serde(default = "default_one_f64")]
    pub volume: f64,
    #[serde(rename = "fadeIn", default)]
    pub fade_in: Option<f64>,
    #[serde(rename = "fadeOut", default)]
    pub fade_out: Option<f64>,
    pub url: String,
    #[serde(rename = "trackIndex", default)]
    pub track_index: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextClip {
    pub id: String,
    pub text: String,
    #[serde(rename = "startTime")]
    pub start_time: f64,
    pub duration: f64,
    pub position: Option<Position2D>,
    #[serde(default = "default_one_f64")]
    pub scale: f64,
    #[serde(default)]
    pub rotation: f64,
    pub animation: Option<String>,
    pub style: Option<TextStyle>,
    pub keyframes: Option<Vec<KeyframePoint>>,
    #[serde(rename = "trackIndex", default)]
    pub track_index: Option<i32>,
    #[serde(default)]
    pub layer: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptionClip {
    pub id: String,
    pub text: String,
    #[serde(rename = "startTime")]
    pub start_time: f64,
    pub duration: f64,
    pub position: Option<Position2D>,
    #[serde(default = "default_one_f64")]
    pub scale: f64,
    #[serde(default)]
    pub rotation: f64,
    pub animation: Option<String>,
    pub style: Option<TextStyle>,
    #[serde(rename = "presetId", default)]
    pub preset_id: Option<String>,
    #[serde(default)]
    pub words: Option<Vec<CaptionWord>>,
    #[serde(rename = "trackIndex", default)]
    pub track_index: Option<i32>,
    #[serde(default)]
    pub layer: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptionWord {
    pub word: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StickerClip {
    pub id: String,
    #[serde(rename = "char", default)]
    pub character: String,
    #[serde(rename = "startTime")]
    pub start_time: f64,
    pub duration: f64,
    pub position: Option<Position2D>,
    #[serde(default = "default_one_f64")]
    pub scale: f64,
    #[serde(default)]
    pub rotation: f64,
    pub animation: Option<String>,
    #[serde(rename = "trackIndex", default)]
    pub track_index: Option<i32>,
    #[serde(default)]
    pub layer: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectClip {
    pub id: String,
    #[serde(rename = "type")]
    pub effect_type: String,
    pub name: String,
    #[serde(rename = "startTime")]
    pub start_time: f64,
    pub duration: f64,
    #[serde(default = "default_one_f64")]
    pub intensity: f64,
    #[serde(rename = "trackIndex", default)]
    pub track_index: Option<i32>,
    #[serde(default)]
    pub layer: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position2D {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TextStyle {
    pub color: Option<String>,
    #[serde(rename = "fontSize", default)]
    pub font_size: Option<f64>,
    #[serde(rename = "backgroundColor", default)]
    pub background_color: Option<String>,
    #[serde(rename = "borderColor", default)]
    pub border_color: Option<String>,
    #[serde(rename = "borderWidth", default)]
    pub border_width: Option<f64>,
    #[serde(rename = "strokeColor", default)]
    pub stroke_color: Option<String>,
    #[serde(rename = "strokeWidth", default)]
    pub stroke_width: Option<f64>,
    #[serde(rename = "highlightColor", default)]
    pub highlight_color: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ClipTransform {
    pub scale: Option<f64>,
    #[serde(rename = "scaleX")]
    pub scale_x: Option<f64>,
    #[serde(rename = "scaleY")]
    pub scale_y: Option<f64>,
    pub rotation: Option<f64>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    #[serde(rename = "flipX")]
    pub flip_x: Option<bool>,
    #[serde(rename = "flipY")]
    pub flip_y: Option<bool>,
    pub opacity: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaskConfig {
    pub shape: String, // "none" | "linear" | "mirror" | "circle" | "rectangle" | "heart" | "star"
    pub size: Option<f64>,
    pub feather: Option<f64>,
    pub roundness: Option<f64>,
    pub inverted: Option<bool>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub rotation: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CutoutConfig {
    pub enabled: bool,
    pub mode: String, // "chroma" | "auto"
    #[serde(rename = "keyColor")]
    pub key_color: String,
    pub intensity: f64,
    pub shadow: f64,
    #[serde(rename = "strokeColor")]
    pub stroke_color: Option<String>,
    #[serde(rename = "strokeWidth")]
    pub stroke_width: Option<f64>,
    #[serde(rename = "bgColor")]
    pub bg_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyframePoint {
    pub time: f64,
    pub transform: ClipTransform,
    #[serde(default = "default_one_f64")]
    pub opacity: f64,
}

// ---------------------------------------------------------------------------
// Native In-Memory Pixel FrameBuffer (RGBA 32-bit)
// ---------------------------------------------------------------------------
#[derive(Debug, Clone)]
pub struct FrameBuffer {
    pub width: u32,
    pub height: u32,
    pub stride: usize,
    pub data: Vec<u8>,
}

impl FrameBuffer {
    pub fn new(width: u32, height: u32) -> Self {
        let size = (width as usize) * (height as usize) * 4;
        Self {
            width,
            height,
            stride: (width as usize) * 4,
            data: vec![0u8; size],
        }
    }

    pub fn with_color(width: u32, height: u32, r: u8, g: u8, b: u8, a: u8) -> Self {
        let mut fb = Self::new(width, height);
        fb.fill(r, g, b, a);
        fb
    }

    #[inline(always)]
    pub fn get_pixel(&self, x: u32, y: u32) -> (u8, u8, u8, u8) {
        if x >= self.width || y >= self.height {
            return (0, 0, 0, 0);
        }
        let idx = (y as usize) * self.stride + (x as usize) * 4;
        (
            self.data[idx],
            self.data[idx + 1],
            self.data[idx + 2],
            self.data[idx + 3],
        )
    }

    #[inline(always)]
    pub fn set_pixel(&mut self, x: u32, y: u32, r: u8, g: u8, b: u8, a: u8) {
        if x >= self.width || y >= self.height {
            return;
        }
        let idx = (y as usize) * self.stride + (x as usize) * 4;
        self.data[idx] = r;
        self.data[idx + 1] = g;
        self.data[idx + 2] = b;
        self.data[idx + 3] = a;
    }

    pub fn fill(&mut self, r: u8, g: u8, b: u8, a: u8) {
        let px = [r, g, b, a];
        for chunk in self.data.chunks_exact_mut(4) {
            chunk.copy_from_slice(&px);
        }
    }
}

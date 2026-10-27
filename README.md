# FastArt 🎬⚡

> **FastArt** is a professional-grade, cross-platform video and audio editing studio built with a decoupled architecture: an ultra-responsive, mobile-first **Expo / React Native UI** backed by an embedded, multi-core hardware-accelerated **Rust Core Engine** for **Android**, **iOS**, and **Web**.

---

## 🌟 Key Highlights

* **Cross-Platform High-Performance**: 100% feature parity on Web, Android, and iOS.
* **Embedded Native Rust Core (`fastart_core`)**:
  * Multi-core CPU scanline parallelism with **Rayon** (utilizes all CPU cores).
  * Fixed-point SIMD-friendly Porter-Duff Over alpha compositing and 7 blend modes (`Normal`, `Multiply`, `Screen`, `Overlay`, `Add`, `Darken`, `Lighten`).
  * 3D LUT `.cube` trilinear color grading and GPU-grade shader filters.
  * Fast Fourier Transform (FFT) spectral flux beat and tempo detection.
  * Sub-millisecond timeline waveform peak generation.
  * Instant PNG poster-frame snapshots and quantized animated GIF compression.
  * 60fps motion tracking physics (`follow_center`, `cinematic_drift`, `dynamic_zoom`, `orbit_float`).
* **Decoupled Architecture**: All heavy mathematical, signal-processing, and frame-rendering workloads execute in native Rust machine code (or WebAssembly on web), keeping the Expo UI running smoothly at 60fps with zero UI-thread stalls.

---

## 🏗️ Architecture

```
                      ┌─────────────────────────┐
                      │   Expo / React Native   │
                      │  (Timeline & Studio UI) │
                      └────────────┬────────────┘
                                   │
                     rustCoreBridge.ts (Auto-Detect)
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
   [Android Native]          [iOS Native]             [Web WebAssembly]
  FastArtRustBridge.kt      FastArtRust.mm           fastart_wasm.wasm
  (libfastart_jni.so)       (libfastart_ios.a)       (WebAssembly.instantiate)
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   ▼
                       ┌───────────────────────┐
                       │     fastart_core      │
                       │  - Rayon Parallelism  │
                       │  - 3D LUT Shaders     │
                       │  - FFT Beat Detector  │
                       │  - Waveform Peaks     │
                       │  - Motion Tracking    │
                       │  - PNG / GIF Codecs   │
                       └───────────────────────┘
```

---

## 📋 Prerequisites

Before running the project, make sure you have installed:

1. **Node.js** (v18+ or v20+) and **Yarn** or **npm**.
2. **Rust & Cargo** (v1.80+):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
3. **WebAssembly Target** (required for Web):
   ```bash
   rustup target add wasm32-unknown-unknown
   ```
4. **Android SDK / NDK** (for Android native builds):
   * Android Studio with Android SDK Platform 34+ and NDK installed.
5. **Xcode & CocoaPods** (for iOS builds, macOS only):
   * Xcode 15+ and Command Line Tools.

---

## ⚡ Standard Expo Local Module Architecture (Git & CNG Friendly)

`/android` and `/ios` directories are generated on demand via Expo Continuous Native Generation (CNG) and are ignored by git.
All native source files, bridges, and native configurations live cleanly inside the tracked application root:
* **Expo Local Module**: `modules/fastart-rust/`
  - `expo-module.config.json`: Automatically discovered and linked by Expo Autolinking on both Android and iOS.
  - `android/`: Kotlin module registered with `expo-modules-core`.
  - `ios/`: Swift module and `FastArtRust.podspec` registered with `ExpoModulesCore`.
* **Rust Compute Workspace**: `rust/`
  - `fastart_core`: Pure multi-core SIMD compute engine.
  - `fastart_jni`: JNI bridge for Android.
  - `fastart_ios`: C-FFI static library for iOS.
  - `fastart_wasm`: WebAssembly module for Web.

Anyone cloning this repository fresh can simply run:
```bash
npm install
npm run android   # or npm run ios / npm run web
```
Expo will generate `android`/`ios` with CNG, autolink `fastart-rust` natively, and run the app with 100% Rust acceleration.

---

## 🚀 Running the App

All platform commands are configured in `package.json` with integrated Rust build steps.

### 🌐 1. Run on Web (Browser)

Compiles the Rust WebAssembly module to `assets/wasm/fastart_wasm.wasm` and launches the Expo Web development server:

```bash
# Using npm
npm run web

# Using yarn
yarn web
```

* Open your browser at: `http://localhost:8081`

---

### 🤖 2. Run on Android (Device / Emulator)

Builds the native Rust JNI bridge and runs the Android application:

```bash
# Using npm
npm run android

# Using yarn
yarn android
```

---

### 🍏 3. Run on iOS (Simulator / Physical Device)

Builds the native Rust iOS C-FFI static library and launches the iOS app:

```bash
# Using npm
npm run ios

# Using yarn
yarn ios
```

---

### 🦀 4. Rust Workspace & Testing Commands

You can build, inspect, and test the Rust crates independently:

```bash
# Run unit tests across all Rust crates (fastart_core, fastart_jni, fastart_ios, fastart_wasm)
npm run test:rust

# Build the release Rust workspace
npm run build:rust

# Recompile the WebAssembly release binary
npm run build:wasm

# Run TypeScript typechecker
npm run typecheck

# Run linter
npm run lint
```

---

### 📦 5. Production Builds

All production builds automatically compile and bundle the Rust core engine:

```bash
# Compile and deploy all Rust artifacts (WASM, Android jniLibs, iOS Pod)
npm run build:all

# Production Android APK / Release
npm run build:prod:android

# Production iOS Release
npm run build:prod:ios

# Production Web Export
npm run build:prod:web
```

---

## 🎨 How to Use FastArt

### 1. Adding & Managing Media
* **Import Media**: Click the `+` or `Add Media` button to select videos, photos, or audio tracks from your device or sample library.
* **Canvas Aspect Ratio**: Open the **Ratio** modal to switch between TikTok/Reels (`9:16`), YouTube (`16:9`), Square (`1:1`), Portrait (`4:5`), or Cinematic (`2.35:1`).

### 2. Multi-Track Timeline
* **Drag-and-Drop Clips**: Drag clips horizontally along the time axis to reposition.
* **Magnetic Snapping**: Clips automatically align to playhead boundaries and adjacent clip cuts.
* **Track Insertion**: Drag clips above, between, or below existing tracks to dynamically create new track layers.
* **Trimming**: Tap any clip to expose left/right trim handles for trimming start and end times.
* **Split**: Place the playhead at the desired time and tap **Split** to divide a clip into two independent segments.

### 3. Audio & Beat Synchronization
* **Automatic Beat Detection**: Tap **Detect Beats** to run Rust's spectral flux analysis. Beat markers appear directly on the timeline ruler.
* **Waveform Visualization**: Real PCM waveforms are extracted and cached in $< 1\text{ ms}$ for sample-accurate dialogue alignment.
* **Volume, Fades & Denoise**: Set custom volume gain, smooth linear/exponential fade-in and fade-out curves, and activate AI noise suppression.

### 4. Text, Captions & Animated Stickers
* **Viral Auto-Captions**: Choose from 6 viral styles (MrBeast, Hormozi Punch, Karaoke Glow, Cyberpunk Neon, Minimal Box, Cinema Subtitle).
* **Typography**: Choose from 50+ curated Google Fonts or upload custom `.ttf` / `.otf` font files.
* **Motion Tracking**: Attach text or stickers to follow camera movements using Rust-powered trajectory algorithms.

### 5. Color Grading & Effects
* **3D LUT Filters**: Apply professional `.cube` LUT color presets with trilinear interpolation.
* **Shaders & Vignette**: Add adjustable vignette falloff, soft Gaussian blur, chromatic aberration, or glitch effects.
* **Chroma Key (Cutout)**: Select green or blue screen colors with tolerance sliders for clean background removal.

### 6. Exporting
* Tap **Export** in the top navigation bar.
* Select your target resolution (`720p`, `1080p`, `2K/4K`) and frame rate (`24`, `30`, `60` fps).
* Choose your format:
  * **MP4**: Full multi-track video with synchronized audio.
  * **GIF**: High-speed quantized animated sticker/GIF.
  * **PNG Snapshot**: Instant high-resolution poster frame rendered directly in native Rust.
  * **WAV**: Studio-grade mixed master audio track.

---

## 📂 Project Structure

```
FastArt/
├── assets/
│   └── wasm/
│       └── fastart_wasm.wasm      # Compiled Rust WebAssembly binary (Web)
├── android/                       # Native Android Project
│   └── app/src/main/java/com/fastart/
│       ├── FastArtRustBridge.kt   # JNI Bridge loader
│       ├── FastArtRustModule.kt   # React Native NativeModule
│       └── FastArtPackage.kt      # React Native Package
├── modules/
│   └── fastart-rust/              # Native iOS Module
│       ├── FastArtRust.podspec    # CocoaPods spec
│       └── ios/
│           ├── FastArtRust.h      # RCTBridgeModule header
│           └── FastArtRust.mm     # Objective-C++ GCD bridge
├── rust/                          # Rust Cargo Workspace
│   ├── Cargo.toml
│   └── crates/
│       ├── fastart_core/          # Core compute engine (Rayon, SIMD, DSP)
│       ├── fastart_jni/           # Android JNI bindings
│       ├── fastart_ios/           # iOS C-FFI static library bindings
│       └── fastart_wasm/          # WebAssembly linear memory exports
├── src/
│   ├── components/                # React Native UI (Timeline, Player, Modals)
│   ├── hooks/                     # Custom hooks for gestures & transforms
│   ├── services/
│   │   └── rustCoreBridge.ts      # Unified TypeScript Native/WASM bridge
│   ├── types/
│   │   └── project.ts             # FastArtProject models and schemas
│   └── utils/
│       ├── audioBeatDetector.ts   # Beat detection routing to Rust
│       └── renderer/
│           └── mobileExporter.ts  # Video/PNG export engine
├── package.json
└── metro.config.js                # Metro bundler config with .wasm support
```

---

## 📄 License

This project is licensed under the [MIT License](file:///Users/praveenyadav/Desktop/My%20Projects/FastArt/LICENSE).

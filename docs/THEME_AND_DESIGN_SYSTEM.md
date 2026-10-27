# FastArt Production Design System & Architectural Patterns

> **Master Specification**: This document establishes the standard design system, color tokens, constants, component architecture, and engineering patterns required to make FastArt **scalable, production-ready, performant, and easily maintainable** across Web, macOS/Desktop, iOS, and Android.

---

## 1. Centralized Tokens & Single Source of Truth

To ensure visual consistency and effortless maintainability, **never hardcode raw hex codes or magic numbers** in component styles. All styling must consume tokens exported from [`src/constants/designConstants.ts`](file:///Users/praveenyadav/Desktop/My%20Projects/FastArt/src/constants/designConstants.ts) and [`src/constants/theme.ts`](file:///Users/praveenyadav/Desktop/My%20Projects/FastArt/src/constants/theme.ts).

### 1.1 The Monochromatic Surface Hierarchy

FastArt uses a pure, distraction-free **Obsidian Dark Monotone** palette where the user's video content is always the hero:

```
+---------------------------------------------------------------------------------+
| Level 0: Pure Deep Black        #08090E  (App root, player canvas, timeline base)|
|   +---------------------------------------------------------------------------+ |
|   | Level 1: Inset / Surface 1   #0F131D  (Inputs, pills, timecode, search)    | |
|   |   +---------------------------------------------------------------------+ | |
|   |   | Level 2: Surface / Cards     #131826  (Timeline clips, modal sheets)| | |
|   |   |   +---------------------------------------------------------------+ | | |
|   |   |   | Level 3: Elevated Popovers   #1B2234  (Dropdowns, context menus) | | | |
|   |   |   +---------------------------------------------------------------+ | | |
|   |   +---------------------------------------------------------------------+ | |
|   +---------------------------------------------------------------------------+ |
+---------------------------------------------------------------------------------+
```

| Token | Hex Value | Purpose & Usage Rule |
| :--- | :--- | :--- |
| **`THEME_COLORS.background`** | `#08090E` | Root canvas background, player framing, navbar and toolbar backdrops. |
| **`THEME_COLORS.surface`** | `#0F131D` | Inset panels, text inputs, search fields, timecode pill container, header card buttons. |
| **`THEME_COLORS.cardBackground`** | `#131826` | Unified timeline clips, modal bottom sheets, project cards, preset option cards. |
| **`THEME_COLORS.cardElevated`** | `#1B2234` | Context menus, dropdown menus, floating modals, notification items. |
| **`THEME_COLORS.cardHover`** | `#232B42` | Desktop hover feedback, active press feedback. |
| **`THEME_COLORS.border`** | `#1F2637` | **Standard 1px border** across all cards, dividers, header separators, and inputs. |
| **`THEME_COLORS.borderSubtle`** | `rgba(255, 255, 255, 0.08)` | Thin inner line for clips and cards. |
| **`THEME_COLORS.borderGlow`** | `rgba(255, 255, 255, 0.25)` | Focus ring and hover glow on selected studio elements (White Glow). |

### 1.2 The Pure Black & White Monotone Palette (Zero Bright Cyan)

FastArt enforces a strict **Near White and Black Monotone Action Convention** (eliminating bright colors and bright cyan for an ultra-clean, studio-grade aesthetic):

| Action Category | Background | Foreground | Border | Standard Component Examples |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Hero CTA** | `#FFFFFF` (Solid White) | `#000000` (Bold) | None | `Export` (Header), `+ New Project` (Homepage), Center `Play/Pause` Button. |
| **Secondary Button** | `#0F131D` or `#131826` | `#FFFFFF` / `#94A3B8` | `#1F2637` | Undo/Redo, Format Pills, Steppers, Back Navigation Chevrons. |
| **Precision Accent** | `rgba(255, 255, 255, 0.12)` (Platinum Glow) | `#FFFFFF` / `#E2E8F0` (Crisp White) | `rgba(255, 255, 255, 0.35)` | Active tab indicator, timeline playhead scrub, keyframe diamond markers, active bounding box. |
| **Destructive / Delete** | `#131826` | `#EF4444` | `#1F2637` | Clip deletion, project removal confirmation. |
| **Success Utility** | `rgba(16, 185, 129, 0.12)` | `#10B981` | `rgba(16, 185, 129, 0.25)` | Export complete checkmark, download confirmation. |

---

## 2. Standardized Layout Dimensions & Constants

Every layout dimension is formalized in [`DESIGN_CONSTANTS.DIMENSIONS`](file:///Users/praveenyadav/Desktop/My%20Projects/FastArt/src/constants/designConstants.ts) to guarantee zero layout shifts and seamless cross-platform responsiveness:

```typescript
export const DESIGN_CONSTANTS = {
  DIMENSIONS: {
    // Header & Navigation
    headerHeight: 48,
    navButtonSize: 32,

    // Video Player & Controls
    playerControlBarHeight: 38,
    playerControlBarCompactHeight: 36,
    playButtonSize: 32,
    stepButtonSize: 28,
    utilityButtonSize: 28,

    // Timeline
    timelineHeaderHeight: 32,
    trackRowHeight: 44,
    timelineZoomMin: 20,
    timelineZoomMax: 1000,
    timelineZoomDefault: 60,

    // Bottom Docks & Sidebars
    mobileDockHeight: 52,
    mobileToolBtnWidth: 46,
    mobileToolBtnHeight: 44,
    desktopSidebarWidth: 62,
    desktopToolBtnWidth: 52,
    desktopToolBtnHeight: 44,

    // Tool Sheets & Modals
    mobileInlineSheetHeight: 300,
    modalMaxHeightMobile: "82%",
    modalMaxHeightDesktop: "76%",

    // Touch Targets & Swatches
    touchTargetMin: 44,
    touchTargetMicro: 28,
    colorSwatchSize: 28,
    colorSwatchRadius: 14,
    colorSwatchMargin: 8,
  },
  // ...
};
```

---

## 3. Typography Scale & Anti-Jitter Standards

```typescript
export const TYPOGRAPHY = {
  sizes: {
    micro: 9.5,    // Bottom dock labels, desktop sidebar labels, status badges
    subtext: 10,   // Timestamps, hint copy, aspect ratio details
    label: 11,     // Tab bar buttons, timecode numbers, section headers
    body: 12,      // Subtitles, card secondary descriptions
    input: 12.5,   // Text inputs, search fields, button copy
    title: 13.5,   // Modal titles, project card names, panel headers
    heading: 15,   // Screen headers, section main titles
    display: 24,   // FastArt logo, hero titles
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
  },
};
```

### 3.1 Tabular Numerals (Anti-Jitter Rule)
During video playback (30fps / 60fps), timecodes, percentages, and frame numbers change continuously. All numeric displays must specify:
```typescript
fontVariant: ["tabular-nums"]
```
This forces monospace numeral glyphs, preventing annoying horizontal layout jitter during real-time playback.

### 3.2 Single-Word Tool Labels
To avoid two-line awkward wraps on small phone screens, all toolbar tools strictly use a single descriptive word:
- `Split`, `Speed`, `Text`, `Filter`, `Crop`, `Audio`, `Delete`, `Layer`, `Sticker`, `Effect`.

---

## 4. Production Architectural Patterns

### 4.1 Modular Directory Structure (Separation of Concerns)
Large components must be broken down by domain. Avoid monolithic files (>800 lines). Every complex feature follows this four-file pattern:

```
src/components/Panels/FeatureName/
├── FeatureModal.tsx         # Pure container & orchestration component
├── FeatureModalStyles.ts   # StyleSheet definitions consuming THEME_COLORS
├── FeatureConstants.ts     # Options, presets, and configuration arrays
└── components/             # Granular sub-tabs & sub-views
    ├── FeatureTabA.tsx
    └── FeatureTabB.tsx
```

### 4.2 Decoupled High-Frequency Scrubbing (RAF Pattern)
When dragging timeline playheads, transform handles, or volume/speed sliders:
- **Never trigger React state updates on every pointer move event.**
- Store the latest pointer position in a mutable `useRef` (e.g. `pendingTimeRef.current`).
- Request a single animation frame via `requestAnimationFrame` to flush the update to native components.
- Fire the final project state mutation only on pointer release (`onTouchEnd` / `onMouseUp`).

### 4.3 Responsive Viewport Strategy

| Screen Width | Viewport Tier | Layout Architecture |
| :--- | :--- | :--- |
| **`< 768px`** | **Mobile** | Single-column vertical stack. Main canvas on top; 300px inline tool sheet below; 52px horizontal dock at bottom. |
| **`768px – 1180px`** | **Tablet / Laptop** | Two-column layout. 62px studio dock on left; center video player; multi-track timeline below. |
| **`>= 1180px`** | **Desktop Studio** | Three-column NLE workspace. 62px studio dock; center canvas; right media/inspector panel; full timeline. |

### 4.4 Clean Video Canvas Rule (Zero Clutter)
- The video preview canvas must remain **100% unobstructed**.
- **Bounding Box Overlay**: Hairline 1px solid white (`#FFFFFF`) or platinum (`#E2E8F0`) outline with minimal 8–10px corner bracket dots and a subtle top rotation handle.
- **Strictly No Floating Action Bars**: Do not place chunky floating bars (`Crop`, `Mask`, `Delete`, `Done`) over the active video frame. All operations must be initiated from the bottom tool sheet, docked toolbar, or desktop inspector.

### 4.5 Touch Ergonomics & Accessibility (WCAG 2.1 AA)
- **Minimum Mobile Touch Target**: `44×44px` (or `46×44px` with hit slop padding).
- **Hit Slop on Micro-Buttons**: All buttons with visual dimensions `< 36px` must supply:
  ```typescript
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
  ```
- **Accessibility Labels**: Every icon-only button must include a concise, descriptive `accessibilityLabel` (e.g., `accessibilityLabel="Undo last change"`).

### 4.6 Undo/Redo History & State Immutability Architecture
- **Command / Snapshot Pattern**: Store user modifications as immutable snapshots in an undo/redo stack (`undoStack: Project[]`, `redoStack: Project[]`).
- **History Stack Cap**: Bound the history stack to a maximum of 50 states (FIFO eviction) to prevent runaway heap allocations.
- **Structural Sharing**: Never mutate project or clip objects in place. Always return new references using immutable spreads (`{ ...clip, transform: { ...clip.transform, scale } }`) or Immer to ensure memoized components detect changes correctly.
- **Grouped Actions**: Continuous gestures (such as dragging a clip or dragging a slider) must record only one history entry on drag completion (`onTouchEnd` / `onMouseUp`), rather than pushing 60 distinct states per second.

### 4.7 Memory & Native Resource Lifecycle Management
For a high-performance video editor running on both low-spec mobile devices (Android 4GB RAM) and high-DPI desktop displays:
- **Decoder & Texture Teardown**: Whenever switching projects, closing modals, or unmounting preview canvases, explicitly release video decoders, WebGL/Skia contexts, AudioContext nodes, and Rust native pointers.
- **LRU Cache for Waveforms & Video Thumbnails**: Timeline waveforms and video frame filmstrips must be retained in an in-memory LRU cache with an upper memory threshold (e.g., 50MB mobile, 150MB desktop). Unused clip thumbnails must be evicted to prevent Out-Of-Memory (OOM) crashes.
- **Blob & Object URL Revocation**: Every `URL.createObjectURL(blob)` created during export or preview must have a paired `URL.revokeObjectURL(url)` call inside a cleanup `useEffect` return handler.

### 4.8 Robust Cross-Platform Abstraction (Web, iOS, Android, Desktop)
- **Safe Area Insets**: Always apply `useSafeAreaInsets()` to mobile header and dock containers (`paddingTop: insets.top`, `paddingBottom: Math.max(insets.bottom, 8)`). Desktop/Web runs with zero or fixed 8px padding.
- **Pointer & Input Normalization**: Treat Touch and Mouse events symmetrically. Support desktop mouse wheel scrolling for horizontal timeline panning (`shiftKey + deltaY` or `deltaX`) and `ctrlKey / cmdKey + deltaY` for timeline zooming.
- **Platform Branching**: Isolate platform-specific logic behind clean adapter functions (e.g. `mobileExporter.ts` vs `webExporter.ts` vs `rustBridge.ts`) rather than littering component JSX with multiple `Platform.OS === 'web'` checks.

### 4.9 Fault Tolerance, Error Boundaries & Autosave Strategy
- **Granular React Error Boundaries**: The video canvas preview, timeline track renderer, and tool modal sheets must each be wrapped in independent `ErrorBoundary` components. If a corrupt video codec or invalid GLSL shader fails in the player, the timeline and save tools remain functional so the user never loses their project.
- **Debounced Autosave**: Changes to the project schema must trigger an asynchronous debounced autosave (1,000ms delay) to persistent storage (`AsyncStorage` / `IndexedDB`).
- **Crash Recovery State**: Save an active `session_backup` key before rendering export pipelines. On cold app reboot, offer the user one-tap recovery if an unsaved session was interrupted.

### 4.10 Code Quality & Production Scaling Standards
- **Maximum File Length**: Component files must not exceed 400–500 lines. Break large modals into modular subcomponents (e.g., `Header`, `Presets`, `Sliders`, `Footer`).
- **Zero Magic Numbers**: Every padding, margin, width, height, and border radius must come from `DESIGN_CONSTANTS.DIMENSIONS` or `DESIGN_CONSTANTS.SPACING`.
- **Zero Raw Hex Colors**: All colors must strictly be imported from `THEME_COLORS`.
- **TypeScript Strictness**: Strictly avoid `any` types. Provide exhaustive type definitions for all clips, effects, transitions, keyframes, and export settings in `src/types/project.ts`.
- **Pure Functions for Math & Transforms**: Aspect ratio fitting, matrix calculations, timecode formatting, and easing functions must live in pure, unit-testable utility modules in `src/utils/`.

### 4.11 UI/UX Production Design Patterns
- **Progressive Disclosure Pattern**: Keep default panel views simple and intuitive (essential sliders, primary presets). Nest advanced controls (bezier velocity curves, 3D LUT calibrations, custom chroma keys, keyframe timing) within collapsible drawers or second-level tabs to prevent cognitive overload.
- **Magnetic Snapping Pattern**: In multi-track timelines, clip edges, keyframe markers, and the active playhead must snap magnetically when within an 8px visual threshold. Trigger a light haptic tick (`Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`) when snapping occurs.
- **Optimistic UI & Non-Blocking Feedback**: Operations like applying a filter, splitting a clip, or renaming a track must reflect immediately in the UI state without waiting for native video decoders.
- **Empty States with Direct CTAs**: Every blank view (empty timeline, no media imported, zero text overlays) must display a clean, centered graphic, a muted explanation, and a single, primary white action button (e.g. `Import Video` or `Add Title`).
- **Tactile Micro-Feedback**: Use consistent auditory and tactile cues for key editing milestones: light haptic on track boundary snap, `click` sound on tool selection, and `pop` on clip placement.

### 4.12 Media Pipeline & Composable Filter Architecture (Pipeline Pattern)
To handle complex multi-effect chains (LUTs + Speed Curves + Chroma Key + Blur + Transform + Mask):
- Structure frame rendering as a linear composable pipeline:
  ```
  [Source Video Frame] 
    └──> [Transform Matrix (Scale, Pos, Rot, Crop)]
          └──> [GLSL Shader / LUT 3D Interpolation]
                └──> [Mask Overlay / Alpha Channel Cutout]
                      └──> [Transition Blend with Adjacent Track]
                            └──> [Output Canvas / Encoder Sink]
  ```
- Each stage in the pipeline must operate as a pure shader or transformation stage without side effects, allowing individual effects to be toggled, reordered, or benchmarked independently.

### 4.13 Off-Thread Native & Web Worker Execution
Heavy media computations must never execute on the main UI/JavaScript thread:
- **Audio Waveform Generation & Peak Extraction**: Compute audio peak histograms via background Web Workers (`web`) or background threads in the Rust native module (`android`/`ios`).
- **Video Decoding & Frame Scrubbing**: Offload frame extraction to native decoders (Android MediaCodec / iOS AVFoundation / Web VideoDecoder API). Send extracted frame buffers via shared memory or transferrable buffers.
- **Background Export Pipeline**: Rendering 1080p/4K MP4 exports must run in a dedicated background service/worker with progress events emitted across the bridge. The UI thread must remain fully interactive at 60fps during export.

### 4.14 Factory Pattern & Clip Lifecycle Invariants
Direct object creation across components causes missing properties and runtime crashes. All clips must be instantiated via centralized factory functions:
- `createVideoClip(uri, duration, trackIndex)`
- `createAudioClip(uri, duration, trackIndex)`
- `createTextClip(text, startTime, duration, trackIndex)`
- `createEffectClip(effectType, startTime, duration, trackIndex)`
Every factory validates schema invariants: non-negative start times, non-zero durations, unique IDs (`uuidv4()`), valid default transforms, and normalized opacity/volume values.

### 4.15 Unified Clock Engine & Observer Pattern (Sample-Accurate Playback)
To prevent audio/video desynchronization across multiple tracks:
- FastArt uses a single, master time source: **`PlaybackClockEngine`**.
- Visual components (timeline playhead, ruler indicator, player video element, audio synthesizer) register as observers to the clock.
- When scrubbing, the master clock pauses, sets `targetTime`, and flushes frame requests to observers via `requestAnimationFrame`. Audio nodes immediately mute during continuous scrubs and unmute upon release.

### 4.16 Feature Flagging & Extensibility Architecture
- Isolate experimental or resource-intensive features (e.g., AI auto-cutout, 4K 60fps rendering, Rust GPU hardware acceleration) behind a centralized feature flag service:
  ```typescript
  if (FeatureManager.isEnabled("RUST_HARDWARE_ACCELERATION")) {
    // Invoke Native Rust pipeline
  } else {
    // Fallback to JS/Skia pipeline
  }
  ```
- This prevents regressions on lower-tier hardware and allows graceful degradation across platforms.

---

## 5. Developer Checklist for Production Releases

Before merging any new screen, modal, or component, verify:

- [ ] Does it import colors exclusively from `THEME_COLORS` rather than using raw hex codes?
- [ ] Are all dimensions derived from `DESIGN_CONSTANTS.DIMENSIONS`?
- [ ] Does the primary hero action use Solid White (`#FFFFFF` on `#000000`)?
- [ ] Is the entire UI strictly Near White & Black monotone (zero bright electric cyan `#00F2FE`)?
- [ ] Is the video canvas preview 100% clean with zero floating action bars?
- [ ] Are all numeric counters and timecodes formatted with `fontVariant: ["tabular-nums"]`?
- [ ] Are tool labels single-word and concise (`Split`, `Speed`, `Text`, `Filter`, `Audio`, `Delete`)?
- [ ] Does it properly clean up memory, object URLs, and timers in `useEffect` return functions?
- [ ] Does it offload heavy audio/video processing to background workers or native Rust threads?
- [ ] Are clips created through centralized factory utilities to enforce schema integrity?
- [ ] Does the component pass `npx tsc --noEmit` with zero type errors?
- [ ] Has it been tested at both mobile (`390×844` / `500×670`) and desktop (`1470×836`) viewports?



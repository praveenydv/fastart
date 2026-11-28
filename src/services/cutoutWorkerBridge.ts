import { resolveAssetUrl } from "../utils/router";

/** Runs MODNet off the browser UI thread with hardware and optimized WASM backends. */
type CutoutWorkerSlot = { worker: Worker; active: number };
type CutoutWorkerResult = { rawAlpha?: Float32Array | null; rle?: Uint8Array | null };

class CutoutWorkerBridge {
  private workers: CutoutWorkerSlot[] = [];
  private initPromise: Promise<boolean> | null = null;
  private ready = false;
  private nextId = 0;
  private pending = new Map<number, {
    resolve: (value: CutoutWorkerResult | null) => void;
    timer: ReturnType<typeof setTimeout>;
    slot: CutoutWorkerSlot;
  }>();

  public isSupported(): boolean {
    return typeof window !== "undefined" && typeof Worker !== "undefined" && typeof Blob !== "undefined";
  }

  public isReady(): boolean { return this.ready; }

  /** Each neural worker runs exactly 1 frame inference at a time (zero session collision). */
  public getConcurrency(): number {
    return this.ready ? Math.max(1, this.workers.length) : 1;
  }

  private desiredWorkerCount(): number {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { deviceMemory?: number }) : null;
    const cores = nav?.hardwareConcurrency ?? 4;
    return cores >= 4 ? 2 : 1;
  }

  private createWorker(): CutoutWorkerSlot | null {
    if (!this.isSupported()) return null;
    const cutoutWasmUrl = resolveAssetUrl('/wasm/fastart_cutout_wasm.wasm?v=31');
    const modnetModelUrl = resolveAssetUrl('/models/modnet.onnx?v=20');
    const ortScriptUrl = resolveAssetUrl('/onnxruntime/ort.all.min.js');
    const ortWasmPaths = resolveAssetUrl('/onnxruntime/');
    const workerCode = `
      self.onerror = function(msg, src, line, col, err) {
        console.warn('[CutoutWorker] Uncaught error:', msg, err);
        return true;
      };
      self.onunhandledrejection = function(e) {
        console.warn('[CutoutWorker] Unhandled promise rejection:', e && e.reason);
        if (e && e.preventDefault) e.preventDefault();
      };
      const cutoutWasmUrl = ${JSON.stringify(cutoutWasmUrl)};
      const modnetModelUrl = ${JSON.stringify(modnetModelUrl)};
      const ortScriptUrl = ${JSON.stringify(ortScriptUrl)};
      const ortWasmPaths = ${JSON.stringify(ortWasmPaths)};
      let wasm = null;
      let wasmInstance = null;
      let cutoutWasm = null;
      let cutoutWasmInstance = null;
      let ortSession = null;
      let backend = null;
      let ready = false;
      let initializePromise = null;
      let persistentRgbaPtr = 0;
      let persistentInputPtr = 0;
      let persistentAlphaPtr = 0;
      let persistentRlePtr = 0;
      const INPUT = 3 * 512 * 512, OUTPUT = 512 * 512;
      const RGBA_BYTES = 4 * OUTPUT, RLE_CAPACITY = 2 * OUTPUT;
      async function initializeCutoutCore() {
        if (cutoutWasm) return true;
        try {
          const response = await fetch(cutoutWasmUrl);
          if (!response.ok) throw new Error('Rust cutout WASM request failed (' + response.status + ')');
          const result = await WebAssembly.instantiate(await response.arrayBuffer(), {
            env: { fastart_fill_random: (ptr, len) => {
              const cryptoApi = self.crypto;
              if (!cryptoApi || !cutoutWasmInstance) return 0;
              const bytes = new Uint8Array(cutoutWasmInstance.exports.memory.buffer, ptr, len);
              for (let offset = 0; offset < len; offset += 65536) cryptoApi.getRandomValues(bytes.subarray(offset, Math.min(len, offset + 65536)));
              return 1;
            } },
            wasi_snapshot_preview1: {}
          });
          cutoutWasmInstance = result.instance;
          cutoutWasm = cutoutWasmInstance.exports;
          if (!persistentRgbaPtr) {
            persistentRgbaPtr = cutoutWasm.fastart_cutout_alloc(RGBA_BYTES);
            persistentInputPtr = cutoutWasm.fastart_cutout_alloc(INPUT * 4);
            persistentAlphaPtr = cutoutWasm.fastart_cutout_alloc(OUTPUT * 4);
            persistentRlePtr = cutoutWasm.fastart_cutout_alloc(RLE_CAPACITY);
          }
          return true;
        } catch (wasmErr) {
          console.warn('[CutoutWorker] Cutout WASM initialization note:', wasmErr);
          return false;
        }
      }
      async function initializeOnnxRuntime() {
        if (typeof importScripts !== 'function') return false;
        try {
          const modelResponse = await fetch(modnetModelUrl);
          if (!modelResponse.ok) throw new Error('Studio MODNet model request failed (' + modelResponse.status + ')');
          const modelBytes = new Uint8Array(await modelResponse.arrayBuffer());

          importScripts(ortScriptUrl);
          if (typeof ort !== 'undefined' && !self.ort) {
            self.ort = ort;
          }
          if (!self.ort) throw new Error('ONNX Runtime Web bundle failed to export');

          self.ort.env.logLevel = 'error';
          self.ort.env.wasm.wasmPaths = ortWasmPaths;
          self.ort.env.wasm.proxy = false;
          self.ort.env.wasm.simd = true;
          if (self.crossOriginIsolated) {
            const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
            self.ort.env.wasm.numThreads = Math.min(4, Math.max(2, Math.floor(cores / 2)));
          } else {
            self.ort.env.wasm.numThreads = 1;
          }

          let session = null;
          if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
            try {
              session = await self.ort.InferenceSession.create(modelBytes, {
                executionProviders: [{ name: 'webgpu', powerPreference: 'high-performance' }, 'wasm'],
                graphOptimizationLevel: 'all'
              });
              backend = 'webgpu';
            } catch (gpuErr) {
              session = null;
            }
          }

          if (!session) {
            try {
              session = await self.ort.InferenceSession.create(modelBytes, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all'
              });
              backend = 'wasm';
            } catch (sessionErr) {
              console.warn('[CutoutWorker] WASM session creation error:', sessionErr);
              session = null;
            }
          }

          ortSession = session;
          ready = Boolean(session);
          if (ready) {
            console.info('[CutoutWorker] Studio MODNet ready:', (backend || 'wasm').toUpperCase(), '(512x512 Portrait Matting)');
          }
          return ready;
        } catch (error) {
          console.warn('[CutoutWorker] ONNX Runtime initialization failed:', String(error));
          ortSession = null;
          return false;
        }
      }
      async function initialize() {
        if (ready) return true;
        if (!initializePromise) {
          initializePromise = (async () => {
            await initializeCutoutCore();
            if (!(await initializeOnnxRuntime())) throw new Error('AI Cutout ONNX Runtime failed to initialize');
            return true;
          })();
        }
        try {
          return await initializePromise;
        } finally {
          if (!ready) initializePromise = null;
        }
      }
      let currentTask = Promise.resolve();
      self.onmessage = ({data}) => {
        currentTask = currentTask.then(async () => {
          const {id, type, floatData, rgbaData, threshold, feather, includeRawAlpha, crop} = data;
          try {
            if (type === 'init') { const success = await initialize(); self.postMessage({id, success, backend, rawAlpha: success ? new Float32Array(0) : null}); return; }
            if (type === 'infer-frame') {
              if (!rgbaData || rgbaData.length !== RGBA_BYTES) throw new Error('Invalid RGBA frame');
              if (!await initialize()) throw new Error('Rust cutout worker is unavailable');
              
              let rle = null;
              let rawAlphaOutput = null;
              if (cutoutWasm && persistentRgbaPtr && persistentInputPtr && persistentAlphaPtr && persistentRlePtr) {
                new Uint8Array(cutoutWasm.memory.buffer, persistentRgbaPtr, RGBA_BYTES).set(rgbaData);
                cutoutWasm.fastart_cutout_prepare_modnet_input(persistentRgbaPtr, 512, 512, persistentInputPtr);
                const tensor = new Float32Array(cutoutWasm.memory.buffer, persistentInputPtr, INPUT);
                const input = new self.ort.Tensor('float32', tensor, [1, 3, 512, 512]);
                const inputName = ortSession.inputNames[0] || 'input';
                const outputName = ortSession.outputNames[0] || 'output';
                const result = await ortSession.run({ [inputName]: input });
                const output = result[outputName] || Object.values(result)[0];
                new Float32Array(cutoutWasm.memory.buffer, persistentAlphaPtr, OUTPUT).set(output.data);

                const alphaView = new Float32Array(cutoutWasm.memory.buffer, persistentAlphaPtr, OUTPUT);
                const cropX = crop ? (crop.dx | 0) : 0;
                const cropY = crop ? (crop.dy | 0) : 0;
                const cropW = crop ? (crop.dw | 0) : 0;
                const cropH = crop ? (crop.dh | 0) : 0;
                const rleLength = cutoutWasm.fastart_cutout_modnet_alpha_to_rle_rgba
                  ? cutoutWasm.fastart_cutout_modnet_alpha_to_rle_rgba(persistentAlphaPtr, persistentRgbaPtr, threshold, feather, cropX, cropY, cropW, cropH, persistentRlePtr, RLE_CAPACITY)
                  : cutoutWasm.fastart_cutout_modnet_alpha_to_rle_cropped
                  ? cutoutWasm.fastart_cutout_modnet_alpha_to_rle_cropped(persistentAlphaPtr, threshold, feather, cropX, cropY, cropW, cropH, persistentRlePtr, RLE_CAPACITY)
                  : cutoutWasm.fastart_cutout_modnet_alpha_to_rle(persistentAlphaPtr, threshold, feather, persistentRlePtr, RLE_CAPACITY);
                if (!rleLength) throw new Error('Rust MODNet RLE encoding failed');
                rle = new Uint8Array(new Uint8Array(cutoutWasm.memory.buffer, persistentRlePtr, rleLength));
                rawAlphaOutput = includeRawAlpha ? new Float32Array(alphaView) : null;
              } else {
                const inputTensor = new Float32Array(INPUT);
                const invScale = 1.0 / 127.5;
                for (let i = 0; i < OUTPUT; i++) {
                  const idx = i * 4;
                  inputTensor[i] = (rgbaData[idx] - 127.5) * invScale;
                  inputTensor[OUTPUT + i] = (rgbaData[idx + 1] - 127.5) * invScale;
                  inputTensor[2 * OUTPUT + i] = (rgbaData[idx + 2] - 127.5) * invScale;
                }
                const input = new self.ort.Tensor('float32', inputTensor, [1, 3, 512, 512]);
                const inputName = ortSession.inputNames[0] || 'input';
                const outputName = ortSession.outputNames[0] || 'output';
                const result = await ortSession.run({ [inputName]: input });
                const output = result[outputName] || Object.values(result)[0];
                rawAlphaOutput = new Float32Array(output.data);

                const tNorm = (threshold <= 0.001 && feather <= 0.001) ? 0.45 : Math.max(0, Math.min(1, threshold));
                const sNorm = (threshold <= 0.001 && feather <= 0.001) ? 0.25 : Math.max(0, Math.min(1, feather));
                const vMin = Math.max(0.04, Math.min(0.15, 0.05 + tNorm * 0.08 - sNorm * 0.03));
                const vMax = Math.max(vMin + 0.20, Math.min(0.85, 0.58 + tNorm * 0.10 + sNorm * 0.08));
                const span = Math.max(0.10, vMax - vMin);
                const invSpan = 1.0 / span;

                // Step 1: Find high-confidence Human Core Seeds (raw alpha >= 0.50)
                const coreVisited = new Uint8Array(OUTPUT);
                const labels = new Uint32Array(OUTPUT);
                let currentLabel = 0;
                const compSizes = [];
                const queue = new Int32Array(OUTPUT);

                for (let idx = 0; idx < OUTPUT; idx++) {
                  if (rawAlphaOutput[idx] >= 0.50 && coreVisited[idx] === 0) {
                    currentLabel++;
                    let head = 0;
                    let tail = 0;
                    queue[tail++] = idx;
                    coreVisited[idx] = 1;
                    labels[idx] = currentLabel;
                    let count = 0;

                    while (head < tail) {
                      const cur = queue[head++];
                      count++;
                      const cy = (cur / 512) | 0;
                      const cx = cur % 512;

                      if (cy > 0) {
                        const n = cur - 512;
                        if (rawAlphaOutput[n] >= 0.50 && coreVisited[n] === 0) {
                          coreVisited[n] = 1;
                          labels[n] = currentLabel;
                          queue[tail++] = n;
                        }
                      }
                      if (cy + 1 < 512) {
                        const n = cur + 512;
                        if (rawAlphaOutput[n] >= 0.50 && coreVisited[n] === 0) {
                          coreVisited[n] = 1;
                          labels[n] = currentLabel;
                          queue[tail++] = n;
                        }
                      }
                      if (cx > 0) {
                        const n = cur - 1;
                        if (rawAlphaOutput[n] >= 0.50 && coreVisited[n] === 0) {
                          coreVisited[n] = 1;
                          labels[n] = currentLabel;
                          queue[tail++] = n;
                        }
                      }
                      if (cx + 1 < 512) {
                        const n = cur + 1;
                        if (rawAlphaOutput[n] >= 0.50 && coreVisited[n] === 0) {
                          coreVisited[n] = 1;
                          labels[n] = currentLabel;
                          queue[tail++] = n;
                        }
                      }
                    }
                    compSizes.push({ label: currentLabel, size: count });
                  }
                }

                // Step 2: Geodesic Region Growing from the human core
                const isHuman = new Uint8Array(OUTPUT);
                let maxComp = null;
                for (let i = 0; i < compSizes.length; i++) {
                  if (!maxComp || compSizes[i].size > maxComp.size) {
                    maxComp = compSizes[i];
                  }
                }

                if (maxComp && maxComp.size >= 120) {
                  // Step 2: Anatomical Head Crown Detection on primary body component
                  const maxLabel = maxComp.label;
                  let bodyMinY = 512, bodyMaxY = 0;
                  const rowSpans = [];

                  for (let y = 0; y < 512; y++) {
                    let rowMinX = 512, rowMaxX = 0, count = 0;
                    for (let x = 0; x < 512; x++) {
                      if (labels[y * 512 + x] === maxLabel) {
                        count++;
                        if (x < rowMinX) rowMinX = x;
                        if (x > rowMaxX) rowMaxX = x;
                      }
                    }
                    if (count > 0) {
                      if (y < bodyMinY) bodyMinY = y;
                      if (y > bodyMaxY) bodyMaxY = y;
                      rowSpans[y] = { span: rowMaxX - rowMinX + 1 };
                    }
                  }

                  let crownY = bodyMinY;
                  for (let y = bodyMinY; y <= Math.min(bodyMaxY, bodyMinY + 60); y++) {
                    const s = rowSpans[y];
                    if (s && s.span >= 6) {
                      let sustained = 0;
                      for (let k = 1; k <= 4; k++) {
                        if (rowSpans[y + k] && rowSpans[y + k].span >= 6) sustained++;
                      }
                      if (sustained >= 3) {
                        crownY = y;
                        break;
                      }
                    }
                  }

                  // Step 3: Valid Core Labels — keep secondary component ONLY if it starts AT/BELOW crownY
                  // AND has horizontal overlap with the main subject's shoulder band.
                  // This eliminates floating trees/antennas/plants whose tops are above the head
                  // even if their bottom pixels dip slightly below (the old compMaxY > crownY was too permissive).
                  const validCoreLabels = new Uint8Array(currentLabel + 1);
                  validCoreLabels[maxComp.label] = 1;
                  const minKeepSize = (maxComp.size / 6) | 0;

                  // Compute main subject's shoulder x-span at/below crownY for overlap check
                  let mainMinXAtCrown = 512, mainMaxXAtCrown = 0;
                  const shoulderScanEnd = Math.min(crownY + 20, 511);
                  for (let sy = crownY; sy <= shoulderScanEnd; sy++) {
                    for (let sx = 0; sx < 512; sx++) {
                      if (labels[sy * 512 + sx] === maxComp.label) {
                        if (sx < mainMinXAtCrown) mainMinXAtCrown = sx;
                        if (sx > mainMaxXAtCrown) mainMaxXAtCrown = sx;
                      }
                    }
                  }

                  for (let i = 0; i < compSizes.length; i++) {
                    if (compSizes[i].label === maxComp.label) continue;
                    if (compSizes[i].size >= minKeepSize) {
                      let compMinY = 512, compMaxY = 0, compMinX = 512, compMaxX = 0;
                      for (let idx = 0; idx < OUTPUT; idx++) {
                        if (labels[idx] === compSizes[i].label) {
                          const cy = (idx / 512) | 0;
                          const cx = idx % 512;
                          if (cy < compMinY) compMinY = cy;
                          if (cy > compMaxY) compMaxY = cy;
                          if (cx < compMinX) compMinX = cx;
                          if (cx > compMaxX) compMaxX = cx;
                        }
                      }
                      // Must START at/below crown and horizontally overlap with main subject
                      const startsBelowCrown = compMinY >= crownY;
                      const overlapX = compMinX <= mainMaxXAtCrown && compMaxX >= mainMinXAtCrown;
                      if (startsBelowCrown && overlapX) {
                        validCoreLabels[compSizes[i].label] = 1;
                      }
                    }
                  }

                  // Step 4: Geodesic Region Growing from human core
                  let head = 0;
                  let tail = 0;
                  for (let idx = 0; idx < OUTPUT; idx++) {
                    const l = labels[idx];
                    if (l > 0 && validCoreLabels[l] === 1) {
                      const cy = (idx / 512) | 0;
                      if (cy >= crownY) {
                        isHuman[idx] = 1;
                        queue[tail++] = idx;
                      }
                    }
                  }

                  while (head < tail) {
                    const cur = queue[head++];
                    const cy = (cur / 512) | 0;
                    const cx = cur % 512;

                    for (let dy = -1; dy <= 1; dy++) {
                      for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const ny = cy + dy;
                        const nx = cx + dx;
                        if (ny >= crownY && ny < 512 && nx >= 0 && nx < 512) {
                          const nIdx = ny * 512 + nx;
                          if (isHuman[nIdx] === 0 && rawAlphaOutput[nIdx] >= vMin) {
                            isHuman[nIdx] = 1;
                            queue[tail++] = nIdx;
                          }
                        }
                      }
                    }
                  }

                  // Natural crown apex dome 1-2 pixels above crownY
                  for (let y = Math.max(0, crownY - 2); y < crownY; y++) {
                    for (let x = 0; x < 512; x++) {
                      const idx = y * 512 + x;
                      if (rawAlphaOutput[idx] >= 0.50 && isHuman[idx + 512] === 1) {
                        isHuman[idx] = 1;
                      }
                    }
                  }
                } else {
                  for (let idx = 0; idx < OUTPUT; idx++) {
                    if (rawAlphaOutput[idx] >= vMin) isHuman[idx] = 1;
                  }
                }

                // Step 5: Two-Pass Euclidean Distance Transform
                const dist = new Float32Array(OUTPUT);
                const INF = 1e6;
                for (let idx = 0; idx < OUTPUT; idx++) {
                  dist[idx] = isHuman[idx] === 1 ? INF : 0.0;
                }

                // Forward pass (top-left to bottom-right)
                for (let y = 0; y < 512; y++) {
                  const row = y * 512;
                  const rowPrev = y > 0 ? (y - 1) * 512 : -1;
                  for (let x = 0; x < 512; x++) {
                    const idx = row + x;
                    if (dist[idx] > 0.0) {
                      let m = dist[idx];
                      if (x > 0) {
                        const d = dist[idx - 1] + 1.0;
                        if (d < m) m = d;
                      }
                      if (rowPrev >= 0) {
                        const d = dist[rowPrev + x] + 1.0;
                        if (d < m) m = d;
                        if (x > 0) {
                          const dDiag = dist[rowPrev + x - 1] + 1.414;
                          if (dDiag < m) m = dDiag;
                        }
                        if (x + 1 < 512) {
                          const dDiag = dist[rowPrev + x + 1] + 1.414;
                          if (dDiag < m) m = dDiag;
                        }
                      }
                      dist[idx] = m;
                    }
                  }
                }

                // Backward pass (bottom-right to top-left)
                for (let y = 511; y >= 0; y--) {
                  const row = y * 512;
                  const rowNext = y + 1 < 512 ? (y + 1) * 512 : -1;
                  for (let x = 511; x >= 0; x--) {
                    const idx = row + x;
                    if (dist[idx] > 0.0) {
                      let m = dist[idx];
                      if (x + 1 < 512) {
                        const d = dist[idx + 1] + 1.0;
                        if (d < m) m = d;
                      }
                      if (rowNext >= 0) {
                        const d = dist[rowNext + x] + 1.0;
                        if (d < m) m = d;
                        if (x + 1 < 512) {
                          const dDiag = dist[rowNext + x + 1] + 1.414;
                          if (dDiag < m) m = dDiag;
                        }
                        if (x > 0) {
                          const dDiag = dist[rowNext + x - 1] + 1.414;
                          if (dDiag < m) m = dDiag;
                        }
                      }
                      dist[idx] = m;
                    }
                  }
                }

                // Step 6: Level-Set Gaussian Curvature Smoothing for Sharp & Smooth Curves
                const phi = new Float32Array(OUTPUT);
                for (let idx = 0; idx < OUTPUT; idx++) {
                  if (isHuman[idx] === 1) {
                    const d = dist[idx];
                    const r = rawAlphaOutput[idx];
                    if (d >= 2.5) {
                      phi[idx] = Math.max(r, 0.85);
                    } else if (d >= 1.0) {
                      const w = (d - 1.0) / 1.5;
                      phi[idx] = Math.max(r, r * (1.0 - w) + 0.85 * w);
                    } else {
                      phi[idx] = r;
                    }
                  }
                }

                // Separable 5-tap Gaussian Blur to eliminate raster discretization ripples
                const kernel = [0.06136, 0.24477, 0.38774, 0.24477, 0.06136];
                const temp = new Float32Array(OUTPUT);
                const smoothed = new Float32Array(OUTPUT);

                // Horizontal pass
                for (let y = 0; y < 512; y++) {
                  const row = y * 512;
                  for (let x = 0; x < 512; x++) {
                    let sum = 0.0;
                    for (let k = -2; k <= 2; k++) {
                      const nx = Math.max(0, Math.min(511, x + k));
                      sum += phi[row + nx] * kernel[k + 2];
                    }
                    temp[row + x] = sum;
                  }
                }

                // Vertical pass
                for (let y = 0; y < 512; y++) {
                  for (let x = 0; x < 512; x++) {
                    let sum = 0.0;
                    for (let k = -2; k <= 2; k++) {
                      const ny = Math.max(0, Math.min(511, y + k));
                      sum += temp[ny * 512 + x] * kernel[k + 2];
                    }
                    smoothed[y * 512 + x] = sum;
                  }
                }

                // Sharp & Smooth Curve Sigmoid Mapping (synced with Rust v31 cutoff=0.58)
                const cutoff = Math.max(0.45, Math.min(0.70, 0.58 + (tNorm - 0.45) * 0.20));
                const halfW = Math.max(0.05, Math.min(0.14, 0.08 + (sNorm - 0.25) * 0.06));
                const minThresh = cutoff - halfW;
                const maxThresh = cutoff + halfW;
                const invW = 1.0 / (2.0 * halfW);

                const alphaBuffer = new Uint8Array(OUTPUT);

                for (let idx = 0; idx < OUTPUT; idx++) {
                  if (isHuman[idx] === 1) {
                    const cy = (idx / 512) | 0;
                    if (cy >= 510 && rawAlphaOutput[idx] >= 0.15) {
                      alphaBuffer[idx] = 255;
                      continue;
                    }

                    const d = dist[idx];
                    const val = smoothed[idx];
                    let opacity = 0;
                    if (val <= minThresh) {
                      opacity = 0;
                    } else if (val >= maxThresh) {
                      opacity = 255;
                    } else {
                      const u = (val - minThresh) * invW;
                      const s = u * u * u * (u * (u * 6.0 - 15.0) + 10.0);
                      opacity = Math.round(s * 255.0);
                    }

                    if (d < 1.5 && opacity > 0) {
                      const boundaryWeight = Math.min(1.0, d / 1.45);
                      alphaBuffer[idx] = Math.min(254, Math.max(1, Math.round(opacity * boundaryWeight)));
                    } else {
                      alphaBuffer[idx] = opacity;
                    }
                  } else {
                    alphaBuffer[idx] = 0;
                  }
                }

                const rleChunks = [];
                let curByte = 0;
                let curCount = 0;
                for (let i = 0; i < OUTPUT; i++) {
                  const byteVal = alphaBuffer[i];
                  if (curCount === 0) {
                    curByte = byteVal;
                    curCount = 1;
                  } else if (curByte === byteVal && curCount < 255) {
                    curCount++;
                  } else {
                    rleChunks.push(curCount, curByte);
                    curByte = byteVal;
                    curCount = 1;
                  }
                }
                if (curCount > 0) rleChunks.push(curCount, curByte);
                rle = new Uint8Array(rleChunks);
              }

              const resultMsg = {id, success: true, rle, rawAlpha: rawAlphaOutput};
              const transfers = (includeRawAlpha && rawAlphaOutput) ? [rle.buffer, rawAlphaOutput.buffer] : [rle.buffer];
              self.postMessage(resultMsg, transfers);
              return;
            }
            if (type === 'infer') {
              if (!floatData || floatData.length !== INPUT) throw new Error('Invalid input');
              if (!await initialize()) throw new Error('AI Cutout initialization failed');
              const input = new self.ort.Tensor('float32', floatData, [1, 3, 512, 512]);
              const inputName = ortSession.inputNames[0] || 'input';
              const outputName = ortSession.outputNames[0] || 'output';
              const result = await ortSession.run({ [inputName]: input });
              const output = result[outputName] || Object.values(result)[0];
              const copy = new Float32Array(output.data);
              self.postMessage({id, success: true, rawAlpha: copy}, [copy.buffer]);
              return;
            }
          } catch (error) { self.postMessage({id, success: false, error: String(error)}); }
        }).catch((err) => {
          self.postMessage({id: data?.id, success: false, error: String(err)});
        });
      };
    `;
    const url = URL.createObjectURL(new Blob([workerCode], { type: "application/javascript" }));
    const worker = new Worker(url);
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch {}
    }, 15_000);
    const slot: CutoutWorkerSlot = { worker, active: 0 };
    worker.onmessage = ({data}) => {
      if (data.backend) {
        console.log(`[CutoutWorkerBridge] Worker ready with ${data.backend.toUpperCase()} acceleration`);
      }
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(data.id);
      pending.slot.active = Math.max(0, pending.slot.active - 1);
      if (!data.success) console.warn("[CutoutWorkerBridge] Rust inference request failed:", data.error || "unknown worker error");
      pending.resolve(data.success ? { rawAlpha: data.rawAlpha ?? null, rle: data.rle ?? null } : null);
    };
    worker.onerror = (err) => {
      console.warn("[CutoutWorkerBridge] Worker error:", (err as ErrorEvent)?.message || err);
    };
    return slot;
  }

  public async init(): Promise<boolean> {
    if (this.ready) return true;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      const primary = this.createWorker();
      if (!primary) return false;
      this.workers.push(primary);
      const ok = await this.requestOnWorker(primary, "init", undefined, undefined, 20_000);
      if (!ok) {
        this.terminate();
        return false;
      }
      this.ready = true;

      const maxWorkers = this.desiredWorkerCount();
      if (maxWorkers > 1) {
        setTimeout(async () => {
          const secondary = this.createWorker();
          if (secondary) {
            this.workers.push(secondary);
            await this.requestOnWorker(secondary, "init", undefined, undefined, 20_000);
          }
        }, 50);
      }

      return true;
    })().finally(() => { this.initPromise = null; });
    return this.initPromise;
  }

  private requestOnWorker(
    slot: CutoutWorkerSlot,
    type: "init" | "infer" | "infer-frame",
    floatData?: Float32Array,
    frameData?: {
      rgbaData: Uint8ClampedArray;
      threshold: number;
      feather: number;
      includeRawAlpha: boolean;
      crop?: { dx: number; dy: number; dw: number; dh: number };
    },
    timeout = 30_000,
  ): Promise<CutoutWorkerResult | null> {
    const id = ++this.nextId;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        pending.slot.active = Math.max(0, pending.slot.active - 1);
        resolve(null);
      }, timeout);
      slot.active++;
      this.pending.set(id, { resolve, timer, slot });
      try {
        const payload = { id, type, floatData, ...frameData };
        const transfers = frameData ? [frameData.rgbaData.buffer as ArrayBuffer] : [];
        slot.worker.postMessage(payload, transfers);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        slot.active = Math.max(0, slot.active - 1);
        console.warn("[CutoutWorkerBridge] Could not submit inference request:", error);
        resolve(null);
      }
    });
  }

  private request(type: "init" | "infer", floatData?: Float32Array, timeout = 30_000): Promise<CutoutWorkerResult | null> {
    if (this.workers.length === 0) return Promise.resolve(null);
    const slot = this.workers.reduce((best, candidate) => candidate.active < best.active ? candidate : best);
    return this.requestOnWorker(slot, type, floatData, undefined, timeout);
  }

  public async runInference(floatData: Float32Array): Promise<Float32Array | null> {
    if (floatData.length !== 3 * 512 * 512) return null;
    if (!(await this.init())) return null;
    return (await this.request("infer", floatData))?.rawAlpha ?? null;
  }

  public async runFrame(
    rgbaData: Uint8ClampedArray,
    threshold: number,
    feather: number,
    includeRawAlpha: boolean,
    crop?: { dx: number; dy: number; dw: number; dh: number },
  ): Promise<CutoutWorkerResult | null> {
    if (rgbaData.length !== 512 * 512 * 4 || !(await this.init())) return null;
    if (this.workers.length === 0) return null;
    const idleSlot = this.workers.find((w) => w.active === 0);
    const slot = idleSlot || this.workers.reduce((best, candidate) => candidate.active < best.active ? candidate : best);
    return this.requestOnWorker(slot, "infer-frame", undefined, { rgbaData, threshold, feather, includeRawAlpha, crop });
  }

  public terminate(): void {
    this.workers.forEach(({worker}) => worker.terminate());
    this.workers = [];
    this.ready = false;
    this.pending.forEach(({timer, resolve}) => { clearTimeout(timer); resolve(null); });
    this.pending.clear();
    this.initPromise = null;
  }
}

export const cutoutWorkerBridge = new CutoutWorkerBridge();

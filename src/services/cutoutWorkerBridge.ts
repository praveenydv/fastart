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
    return cores >= 8 ? 4 : cores >= 6 ? 3 : cores >= 4 ? 2 : 1;
  }

  private createWorker(): CutoutWorkerSlot | null {
    if (!this.isSupported()) return null;
    const cutoutWasmUrl = resolveAssetUrl('/wasm/fastart_cutout_wasm.wasm');
    const modnetModelUrl = resolveAssetUrl('/models/modnet.onnx');
    const ortScriptUrl = resolveAssetUrl('/onnxruntime/ort.all.min.js');
    const ortWasmPaths = resolveAssetUrl('/onnxruntime/');
    const workerCode = `
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
          if (typeof navigator !== 'undefined' && navigator.gpu) {
            try {
              session = await Promise.race([
                self.ort.InferenceSession.create(modelBytes, {
                  executionProviders: [{ name: 'webgpu', powerPreference: 'high-performance' }, 'wasm'],
                  graphOptimizationLevel: 'all'
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('WebGPU session timeout')), 15000))
              ]);
              backend = 'webgpu';
            } catch (gpuError) {
              console.warn('[CutoutWorker] WebGPU unavailable or timed out, using WASM SIMD:', gpuError);
              session = null;
            }
          }

          if (!session) {
            session = await self.ort.InferenceSession.create(modelBytes, {
              executionProviders: ['wasm'],
              graphOptimizationLevel: 'all'
            });
            backend = 'wasm';
          }

          ortSession = session;
          ready = true;
          console.info('[CutoutWorker] Studio MODNet ready:', backend.toUpperCase(), '(512x512 Portrait Matting)');
          return true;
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
          const {id, type, floatData, rgbaData, threshold, feather, includeRawAlpha} = data;
          try {
            if (type === 'init') { const success = await initialize(); self.postMessage({id, success, backend, rawAlpha: success ? new Float32Array(0) : null}); return; }
            if (type === 'infer-frame') {
              if (!rgbaData || rgbaData.length !== RGBA_BYTES) throw new Error('Invalid RGBA frame');
              if (!await initialize() || !cutoutWasm) throw new Error('Rust cutout worker is unavailable');
              
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
              const rleLength = cutoutWasm.fastart_cutout_modnet_alpha_to_rle(persistentAlphaPtr, threshold, feather, persistentRlePtr, RLE_CAPACITY);
              if (!rleLength) throw new Error('Rust MODNet RLE encoding failed');
              const rle = new Uint8Array(new Uint8Array(cutoutWasm.memory.buffer, persistentRlePtr, rleLength));
              const resultMsg = {id, success: true, rle, rawAlpha: includeRawAlpha ? new Float32Array(alphaView) : null};
              const transfers = includeRawAlpha ? [rle.buffer, resultMsg.rawAlpha.buffer] : [rle.buffer];
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
      console.warn("[CutoutWorkerBridge] Worker error:", err);
      this.terminate();
    };
    return slot;
  }

  public async init(): Promise<boolean> {
    if (this.ready) return true;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      while (this.workers.length < this.desiredWorkerCount()) {
        const slot = this.createWorker();
        if (!slot) break;
        this.workers.push(slot);
      }
      if (this.workers.length === 0) return false;
      const results = await Promise.all(
        this.workers.map((slot) => this.requestOnWorker(slot, "init", undefined, undefined, 45_000)),
      );
      this.workers = this.workers.filter((_slot, index) => !!results[index]);
      this.ready = this.workers.length > 0;
      if (!this.ready) this.terminate();
      return this.ready;
    })().finally(() => { this.initPromise = null; });
    return this.initPromise;
  }

  private requestOnWorker(
    slot: CutoutWorkerSlot,
    type: "init" | "infer" | "infer-frame",
    floatData?: Float32Array,
    frameData?: { rgbaData: Uint8ClampedArray; threshold: number; feather: number; includeRawAlpha: boolean },
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
  ): Promise<CutoutWorkerResult | null> {
    if (rgbaData.length !== 512 * 512 * 4 || !(await this.init())) return null;
    if (this.workers.length === 0) return null;
    const idleSlot = this.workers.find((w) => w.active === 0);
    const slot = idleSlot || this.workers.reduce((best, candidate) => candidate.active < best.active ? candidate : best);
    return this.requestOnWorker(slot, "infer-frame", undefined, { rgbaData, threshold, feather, includeRawAlpha });
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

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

  /** Keep model duplication bounded; avoid multiple model copies on memory-limited devices. */
  public getConcurrency(): number {
    return this.ready ? Math.max(1, this.workers.length) : 1;
  }

  private desiredWorkerCount(): number {
    const nav = typeof navigator !== "undefined" ? navigator as Navigator & { deviceMemory?: number } : null;
    if (nav && "gpu" in nav) return 1;
    const cores = nav?.hardwareConcurrency ?? 2;
    const memory = nav?.deviceMemory;
    return cores >= 8 && (memory === undefined || memory >= 6) ? 2 : 1;
  }

  private createWorker(): CutoutWorkerSlot | null {
    if (!this.isSupported()) return null;
    const assetOrigin = window.location.origin;
    const workerCode = `
      const assetOrigin = ${JSON.stringify(assetOrigin)};
      let wasm = null;
      let wasmInstance = null;
      let cutoutWasm = null;
      let cutoutWasmInstance = null;
      let ortSession = null;
      let backend = null;
      let ready = false;
      let initializePromise = null;
      const INPUT = 3 * 512 * 512, OUTPUT = 512 * 512;
      const RGBA_BYTES = 4 * OUTPUT, RLE_CAPACITY = 2 * OUTPUT;
      async function initializeCutoutCore() {
        if (cutoutWasm) return true;
        const response = await fetch(new URL('/wasm/fastart_cutout_wasm.wasm', assetOrigin));
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
        return true;
      }
      async function initializeRust() {
        if (!wasm) {
          const wasmUrl = new URL('/wasm/fastart_wasm.wasm', assetOrigin).toString();
          const wasmResponse = await fetch(wasmUrl);
          if (!wasmResponse.ok) throw new Error('Rust WASM request failed (' + wasmResponse.status + ')');
          const result = await WebAssembly.instantiate(await wasmResponse.arrayBuffer(), {
            env: { fastart_fill_random: (ptr, len) => {
              const cryptoApi = self.crypto;
              if (!cryptoApi || !wasmInstance) return 0;
              const bytes = new Uint8Array(wasmInstance.exports.memory.buffer, ptr, len);
              for (let offset = 0; offset < len; offset += 65536) cryptoApi.getRandomValues(bytes.subarray(offset, Math.min(len, offset + 65536)));
              return 1;
            } },
            wasi_snapshot_preview1: {}
          });
          wasmInstance = result.instance;
          wasm = wasmInstance.exports;
        }
        const modelResponse = await fetch(new URL('/models/modnet.onnx', assetOrigin));
        if (!modelResponse.ok) throw new Error('MODNet model request failed (' + modelResponse.status + ')');
        const model = new Uint8Array(await modelResponse.arrayBuffer());
        const modelPtr = wasm.fastart_alloc(model.length);
        new Uint8Array(wasm.memory.buffer, modelPtr, model.length).set(model);
        try { ready = wasm.fastart_init_modnet_c(modelPtr, model.length) === 1; }
        finally { wasm.fastart_dealloc(modelPtr, model.length); }
        if (!ready) throw new Error('Rust rejected the MODNet model');
        backend = 'rust';
      }
      async function initializeOnnxRuntime() {
        if (typeof importScripts !== 'function') return false;
        try {
          const useWebGpu = !!navigator.gpu;
          importScripts(new URL(useWebGpu ? '/onnxruntime/ort.webgpu.min.js' : '/onnxruntime/ort.wasm.min.js', assetOrigin).toString());
          self.ort.env.logLevel = 'error';
          self.ort.env.wasm.wasmPaths = new URL('/onnxruntime/', assetOrigin).toString();
          // The bridge already creates a bounded worker pool. Keep each CPU
          // session single-threaded to avoid multiplying the thread count and
          // oversubscribing mobile/laptop CPUs. WebGPU sessions do not use it.
          self.ort.env.wasm.numThreads = 1;
          const modelResponse = await fetch(new URL('/models/modnet.onnx', assetOrigin));
          if (!modelResponse.ok) throw new Error('MODNet model request failed (' + modelResponse.status + ')');
          const providers = useWebGpu ? ['webgpu', 'wasm'] : ['wasm'];
          ortSession = await self.ort.InferenceSession.create(new Uint8Array(await modelResponse.arrayBuffer()), {
            executionProviders: providers,
            graphOptimizationLevel: 'all'
          });
          backend = useWebGpu ? 'webgpu' : 'wasm';
          ready = true;
          console.info('[CutoutWorker] ONNX Runtime ready:', backend);
          return true;
        } catch (error) {
          console.warn('[CutoutWorker] ONNX Runtime unavailable; using Rust/WASM:', String(error));
          ortSession = null;
          return false;
        }
      }
      async function initialize() {
        if (ready) return true;
        if (!initializePromise) {
          initializePromise = (async () => {
            await initializeCutoutCore();
            if (!(await initializeOnnxRuntime())) await initializeRust();
            return true;
          })();
        }
        try {
          return await initializePromise;
        } finally {
          if (!ready) initializePromise = null;
        }
      }
      self.onmessage = async ({data}) => {
        const {id, type, floatData, rgbaData, threshold, feather, includeRawAlpha} = data;
        try {
          if (type === 'init') { const success = await initialize(); self.postMessage({id, success, rawAlpha: success ? new Float32Array(0) : null}); return; }
          if (type === 'infer-frame') {
            if (!rgbaData || rgbaData.length !== RGBA_BYTES) throw new Error('Invalid MODNet RGBA frame');
            if (!await initialize() || !cutoutWasm) throw new Error('Rust cutout worker is unavailable');
            const rgbaPtr = cutoutWasm.fastart_cutout_alloc(RGBA_BYTES);
            const tensorPtr = cutoutWasm.fastart_cutout_alloc(INPUT * 4);
            const alphaPtr = cutoutWasm.fastart_cutout_alloc(OUTPUT * 4);
            const rlePtr = cutoutWasm.fastart_cutout_alloc(RLE_CAPACITY);
            try {
              new Uint8Array(cutoutWasm.memory.buffer, rgbaPtr, RGBA_BYTES).set(rgbaData);
              if (cutoutWasm.fastart_cutout_prepare_modnet_input(rgbaPtr, 512, 512, tensorPtr) !== 1) throw new Error('Rust MODNet input preparation failed');
              let rawAlpha;
              if (backend === 'webgpu' || backend === 'wasm') {
                try {
                  const inputData = new Float32Array(cutoutWasm.memory.buffer, tensorPtr, INPUT);
                  const input = new self.ort.Tensor('float32', inputData, [1, 3, 512, 512]);
                  const result = await ortSession.run({ [ortSession.inputNames[0]]: input });
                  const output = result[ortSession.outputNames[0]];
                  if (!output || output.type !== 'float32' || output.data.length < OUTPUT) throw new Error('Invalid ONNX MODNet alpha output');
                  new Float32Array(cutoutWasm.memory.buffer, alphaPtr, OUTPUT).set(output.data.subarray(0, OUTPUT));
                } catch (error) {
                  console.warn('[CutoutWorker] ONNX Runtime inference failed; falling back to Rust/WASM:', String(error));
                  try { await ortSession.release(); } catch {}
                  ortSession = null;
                  backend = null;
                  ready = false;
                  await initializeRust();
                }
              }
              if (backend === 'rust') {
                const rustInputPtr = wasm.fastart_alloc(INPUT * 4);
                const rustOutputPtr = wasm.fastart_alloc(OUTPUT * 4);
                try {
                  new Float32Array(wasm.memory.buffer, rustInputPtr, INPUT).set(new Float32Array(cutoutWasm.memory.buffer, tensorPtr, INPUT));
                  if (wasm.fastart_run_modnet_c(rustInputPtr, INPUT, rustOutputPtr, OUTPUT) !== 1) throw new Error('Rust MODNet inference failed');
                  new Float32Array(cutoutWasm.memory.buffer, alphaPtr, OUTPUT).set(new Float32Array(wasm.memory.buffer, rustOutputPtr, OUTPUT));
                } finally {
                  wasm.fastart_dealloc(rustInputPtr, INPUT * 4);
                  wasm.fastart_dealloc(rustOutputPtr, OUTPUT * 4);
                }
              }
              const alphaView = new Float32Array(cutoutWasm.memory.buffer, alphaPtr, OUTPUT);
              const rleLength = cutoutWasm.fastart_cutout_modnet_alpha_to_rle(alphaPtr, threshold, feather, rlePtr, RLE_CAPACITY);
              if (!rleLength) throw new Error('Rust MODNet RLE encoding failed');
              const rle = new Uint8Array(new Uint8Array(cutoutWasm.memory.buffer, rlePtr, rleLength));
              const result = {id, success: true, rle, rawAlpha: includeRawAlpha ? new Float32Array(alphaView) : null};
              const transfers = includeRawAlpha ? [rle.buffer, result.rawAlpha.buffer] : [rle.buffer];
              self.postMessage(result, transfers);
            } finally {
              cutoutWasm.fastart_cutout_dealloc(rgbaPtr, RGBA_BYTES);
              cutoutWasm.fastart_cutout_dealloc(tensorPtr, INPUT * 4);
              cutoutWasm.fastart_cutout_dealloc(alphaPtr, OUTPUT * 4);
              cutoutWasm.fastart_cutout_dealloc(rlePtr, RLE_CAPACITY);
            }
            return;
          }
          if (type !== 'infer' || !floatData || floatData.length !== INPUT) throw new Error('Invalid MODNet input');
          if (!await initialize()) throw new Error('Rust MODNet initialization failed');
          if (backend === 'webgpu' || backend === 'wasm') {
            try {
              const input = new self.ort.Tensor('float32', floatData, [1, 3, 512, 512]);
              const result = await ortSession.run({ [ortSession.inputNames[0]]: input });
              const output = result[ortSession.outputNames[0]];
              if (!output || output.type !== 'float32' || output.data.length < OUTPUT) throw new Error('Invalid WebGPU MODNet alpha output');
              const copy = new Float32Array(output.data);
              self.postMessage({id, success: true, rawAlpha: copy}, [copy.buffer]);
              return;
            } catch (error) {
              console.warn('[CutoutWorker] ONNX Runtime inference failed; falling back to Rust/WASM:', String(error));
              try { await ortSession.release(); } catch {}
              ortSession = null;
              backend = null;
              ready = false;
              await initializeRust();
            }
          }
          const inBytes = INPUT * 4, outBytes = OUTPUT * 4;
          const inPtr = wasm.fastart_alloc(inBytes), outPtr = wasm.fastart_alloc(outBytes);
          try {
            new Float32Array(wasm.memory.buffer, inPtr, INPUT).set(floatData);
            if (wasm.fastart_run_modnet_c(inPtr, INPUT, outPtr, OUTPUT) !== 1) throw new Error('Rust MODNet inference failed');
            const copy = new Float32Array(new Float32Array(wasm.memory.buffer, outPtr, OUTPUT));
            self.postMessage({id, success: true, rawAlpha: copy}, [copy.buffer]);
          } finally { wasm.fastart_dealloc(inPtr, inBytes); wasm.fastart_dealloc(outPtr, outBytes); }
        } catch (error) { self.postMessage({id, success: false, error: String(error)}); }
      };
    `;
    const url = URL.createObjectURL(new Blob([workerCode], { type: "application/javascript" }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    const slot: CutoutWorkerSlot = { worker, active: 0 };
    worker.onmessage = ({data}) => {
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(data.id);
      pending.slot.active = Math.max(0, pending.slot.active - 1);
      if (!data.success) console.warn("[CutoutWorkerBridge] Rust inference request failed:", data.error || "unknown worker error");
      pending.resolve(data.success ? { rawAlpha: data.rawAlpha ?? null, rle: data.rle ?? null } : null);
    };
    worker.onerror = () => this.terminate();
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
        this.workers.map((slot) => this.requestOnWorker(slot, "init", undefined, undefined, 120_000)),
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
    const slot = this.workers.reduce((best, candidate) => candidate.active < best.active ? candidate : best);
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

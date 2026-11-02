/** Runs the shared Rust WASM MODNet runtime off the browser UI thread. */
class CutoutWorkerBridge {
  private worker: Worker | null = null;
  private initPromise: Promise<boolean> | null = null;
  private ready = false;
  private nextId = 0;
  private pending = new Map<number, { resolve: (value: Float32Array | null) => void; timer: ReturnType<typeof setTimeout> }>();

  public isSupported(): boolean {
    return typeof window !== "undefined" && typeof Worker !== "undefined" && typeof Blob !== "undefined";
  }

  public isReady(): boolean { return this.ready; }

  private createWorker(): Worker | null {
    if (!this.isSupported()) return null;
    const assetOrigin = window.location.origin;
    const workerCode = `
      const assetOrigin = ${JSON.stringify(assetOrigin)};
      let wasm = null;
      let wasmInstance = null;
      let ready = false;
      let initializePromise = null;
      const INPUT = 3 * 512 * 512, OUTPUT = 512 * 512;
      async function initialize() {
        if (ready) return true;
        if (!initializePromise) {
          initializePromise = (async () => {
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
            const modelUrl = new URL('/models/modnet.onnx', assetOrigin).toString();
            const modelResponse = await fetch(modelUrl);
            if (!modelResponse.ok) throw new Error('MODNet model request failed (' + modelResponse.status + ')');
            const model = new Uint8Array(await modelResponse.arrayBuffer());
            const modelPtr = wasm.fastart_alloc(model.length);
            new Uint8Array(wasm.memory.buffer, modelPtr, model.length).set(model);
            try { ready = wasm.fastart_init_modnet_c(modelPtr, model.length) === 1; }
            finally { wasm.fastart_dealloc(modelPtr, model.length); }
            if (!ready) throw new Error('Rust rejected the MODNet model');
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
        const {id, type, floatData} = data;
        try {
          if (type === 'init') { const success = await initialize(); self.postMessage({id, success, rawAlpha: success ? new Float32Array(0) : null}); return; }
          if (type !== 'infer' || !floatData || floatData.length !== INPUT) throw new Error('Invalid MODNet input');
          if (!await initialize()) throw new Error('Rust MODNet initialization failed');
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
    worker.onmessage = ({data}) => {
      const pending = this.pending.get(data.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(data.id);
      if (!data.success) console.warn("[CutoutWorkerBridge] Rust inference request failed:", data.error || "unknown worker error");
      pending.resolve(data.success ? data.rawAlpha ?? null : null);
    };
    worker.onerror = () => this.terminate();
    return worker;
  }

  public async init(): Promise<boolean> {
    if (this.ready) return true;
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      if (!this.worker) this.worker = this.createWorker();
      if (!this.worker) return false;
      const result = await this.request("init", undefined, 120_000);
      this.ready = !!result;
      if (!this.ready) this.terminate();
      return this.ready;
    })().finally(() => { this.initPromise = null; });
    return this.initPromise;
  }

  private request(type: "init" | "infer", floatData?: Float32Array, timeout = 30_000): Promise<Float32Array | null> {
    if (!this.worker) return Promise.resolve(null);
    const id = ++this.nextId;
    return new Promise((resolve) => {
      const timer = setTimeout(() => { this.pending.delete(id); resolve(null); }, timeout);
      this.pending.set(id, { resolve, timer });
      this.worker!.postMessage({ id, type, floatData });
    });
  }

  public async runInference(floatData: Float32Array): Promise<Float32Array | null> {
    if (floatData.length !== 3 * 512 * 512) return null;
    if (!(await this.init())) return null;
    return this.request("infer", floatData);
  }

  public terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.pending.forEach(({timer, resolve}) => { clearTimeout(timer); resolve(null); });
    this.pending.clear();
    this.initPromise = null;
  }
}

export const cutoutWorkerBridge = new CutoutWorkerBridge();

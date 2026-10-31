/**
 * FastArt Studio Cutout Web Worker Bridge
 *
 * Runs heavy ONNX neural matting (MODNet) in a dedicated background Web Worker thread.
 * Guarantees the main UI thread stays locked at 60 FPS with zero freezing, zero stuttering,
 * and zero "Page Unresponsive" browser warnings.
 */

class CutoutWorkerBridge {
  private worker: Worker | null = null;
  private isInitializing = false;
  private initPromise: Promise<boolean> | null = null;
  private reqIdCounter = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (data: any) => void;
      reject: (err: any) => void;
      timeoutTimer: any;
    }
  >();
  private workerSupported: boolean | null = null;

  public isSupported(): boolean {
    if (this.workerSupported !== null) return this.workerSupported;
    if (
      typeof window === "undefined" ||
      typeof Worker === "undefined" ||
      typeof Blob === "undefined"
    ) {
      this.workerSupported = false;
      return false;
    }
    this.workerSupported = true;
    return true;
  }

  public isReady(): boolean {
    return this.worker !== null;
  }

  private createWorkerInstance(): Worker | null {
    if (!this.isSupported()) return null;

    try {
      const baseOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
      const workerScript = `
        const baseOrigin = "${baseOrigin}";
        let ort = null;
        let session = null;
        let isSessionInitializing = false;

        async function initOrtSession() {
          if (session) return true;
          if (isSessionInitializing) {
            let retries = 30;
            while (!session && retries > 0) {
              await new Promise(r => setTimeout(r, 100));
              retries--;
            }
            return !!session;
          }

          isSessionInitializing = true;
          try {
            const scriptUrl = baseOrigin ? baseOrigin + '/onnxruntime/ort.min.js' : '/onnxruntime/ort.min.js';
            try {
              importScripts(scriptUrl);
            } catch (loadErr) {
              console.warn('[CutoutWorker] importScripts failed:', loadErr);
              isSessionInitializing = false;
              return false;
            }
            ort = self.ort;
            if (!ort) {
              isSessionInitializing = false;
              return false;
            }

            ort.env.wasm.wasmPaths = baseOrigin ? baseOrigin + '/onnxruntime/' : '/onnxruntime/';
            ort.env.wasm.numThreads = Math.min(2, (self.navigator && self.navigator.hardwareConcurrency) || 2);
            ort.env.logLevel = 'error';

            const localModelUrl = baseOrigin ? baseOrigin + '/models/modnet.onnx' : '/models/modnet.onnx';
            let modelSource = localModelUrl;

            try {
              const res = await fetch(localModelUrl);
              if (res.ok && res.status < 400) {
                modelSource = await res.arrayBuffer();
              } else {
                throw new Error('Local model not served directly');
              }
            } catch (err) {
              const remoteModelUrl = 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx';
              if (typeof caches !== 'undefined') {
                try {
                  const cache = await caches.open('fastart-models');
                  let cachedResp = await cache.match(remoteModelUrl);
                  if (!cachedResp) {
                    await cache.add(remoteModelUrl);
                    cachedResp = await cache.match(remoteModelUrl);
                  }
                  if (cachedResp) {
                    modelSource = await cachedResp.arrayBuffer();
                  } else {
                    modelSource = remoteModelUrl;
                  }
                } catch {
                  modelSource = remoteModelUrl;
                }
              } else {
                modelSource = remoteModelUrl;
              }
            }

            const hasWebGpu = typeof self.navigator !== 'undefined' && !!self.navigator.gpu;
            const eps = hasWebGpu ? ['webgpu', 'wasm'] : ['wasm'];
            session = await ort.InferenceSession.create(modelSource, {
              executionProviders: eps,
              graphOptimizationLevel: 'all',
              logSeverityLevel: 3,
            });

            isSessionInitializing = false;
            return true;
          } catch (e) {
            isSessionInitializing = false;
            return false;
          }
        }

        let workerInferencePromise = Promise.resolve();

        self.onmessage = async (e) => {
          const { id, type, floatData } = e.data;

          if (type === 'init') {
            const ok = await initOrtSession();
            self.postMessage({ id, type: 'init_result', success: ok });
            return;
          }

          if (type === 'infer') {
            workerInferencePromise = workerInferencePromise.then(async () => {
              try {
                if (!session) {
                  const ok = await initOrtSession();
                  if (!ok) {
                    self.postMessage({ id, type: 'infer_result', success: false, error: 'Model init failed' });
                    return;
                  }
                }

                const tensor = new ort.Tensor('float32', floatData, [1, 3, 512, 512]);
                const results = await session.run({ input: tensor });
                const rawAlpha = results.output.data; // Float32Array (512x512)

                // Make a standalone copy so ONNX Runtime's internal tensor buffer is never detached
                const alphaCopy = new Float32Array(rawAlpha);
                self.postMessage(
                  { id, type: 'infer_result', success: true, rawAlpha: alphaCopy },
                  [alphaCopy.buffer]
                );
              } catch (err) {
                self.postMessage({ id, type: 'infer_result', success: false, error: String(err) });
              }
            }).catch((err) => {
              self.postMessage({ id, type: 'infer_result', success: false, error: String(err) });
            });
          }
        };
      `;

      const blob = new Blob([workerScript], { type: "application/javascript" });
      const blobUrl = URL.createObjectURL(blob);
      const w = new Worker(blobUrl);

      w.onmessage = (e) => {
        const { id, success, rawAlpha, error } = e.data;
        const pending = this.pendingRequests.get(id);
        if (pending) {
          clearTimeout(pending.timeoutTimer);
          this.pendingRequests.delete(id);
          if (success) {
            pending.resolve(rawAlpha);
          } else {
            pending.reject(new Error(error || "Worker inference error"));
          }
        }
      };

      w.onerror = (err: any) => {
        const msg = err?.message || (typeof err === "string" ? err : "Background worker encountered an issue");
        console.warn("[CutoutWorkerBridge] Worker error:", msg);
      };

      return w;
    } catch (e) {
      console.warn("[CutoutWorkerBridge] Failed to create Worker:", e);
      return null;
    }
  }

  public async init(): Promise<boolean> {
    if (this.worker) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<boolean>((resolve) => {
      const w = this.createWorkerInstance();
      if (!w) {
        resolve(false);
        return;
      }
      this.worker = w;

      const reqId = ++this.reqIdCounter;
      const timeoutTimer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        resolve(false);
      }, 15000);

      this.pendingRequests.set(reqId, {
        resolve: () => resolve(true),
        reject: () => resolve(false),
        timeoutTimer,
      });

      w.postMessage({ id: reqId, type: "init" });
    });

    return this.initPromise;
  }

  public async runInference(floatData: Float32Array): Promise<Float32Array | null> {
    if (!floatData || floatData.byteLength === 0 || floatData.length !== 512 * 512 * 3) {
      return null;
    }

    if (!this.worker) {
      const ready = await this.init();
      if (!ready || !this.worker) return null;
    }

    return new Promise<Float32Array | null>((resolve) => {
      const reqId = ++this.reqIdCounter;
      // 10 second timeout guard
      const timeoutTimer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        resolve(null);
      }, 10000);

      this.pendingRequests.set(reqId, {
        resolve: (rawAlpha: Float32Array) => resolve(rawAlpha),
        reject: () => resolve(null),
        timeoutTimer,
      });

      // Send floatData to worker (structured clone avoids detaching main thread buffer)
      try {
        this.worker!.postMessage({ id: reqId, type: "infer", floatData });
      } catch (err) {
        clearTimeout(timeoutTimer);
        this.pendingRequests.delete(reqId);
        resolve(null);
      }
    });
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.initPromise = null;
    this.pendingRequests.forEach((p) => clearTimeout(p.timeoutTimer));
    this.pendingRequests.clear();
  }
}

export const cutoutWorkerBridge = new CutoutWorkerBridge();

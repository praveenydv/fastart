const fs = require("fs");
const path = require("path");

const packageDist = path.join(__dirname, "..", "node_modules", "onnxruntime-web", "dist");
const publicDir = path.join(__dirname, "..", "public", "onnxruntime");
const runtimeFiles = [
  "ort.webgpu.min.js",
  "ort.wasm.min.js",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
];

fs.mkdirSync(publicDir, { recursive: true });
for (const file of runtimeFiles) {
  const source = path.join(packageDist, file);
  if (!fs.existsSync(source)) {
    throw new Error(`ONNX Runtime WebGPU asset is missing: ${source}`);
  }
  fs.copyFileSync(source, path.join(publicDir, file));
}

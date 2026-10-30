const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'node_modules', 'onnxruntime-web', 'dist');
const destDir = path.join(__dirname, '..', 'public', 'onnxruntime');

const filesToCopy = [
  'ort.min.js',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
];

function setupRuntime() {
  if (!fs.existsSync(srcDir)) {
    console.warn('[setup-runtime] node_modules/onnxruntime-web/dist not found. Run npm/yarn install first.');
    return;
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  let copied = 0;
  for (const file of filesToCopy) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);

    if (fs.existsSync(srcPath)) {
      // Only copy if destination doesn't exist or size differs
      const shouldCopy = !fs.existsSync(destPath) || fs.statSync(srcPath).size !== fs.statSync(destPath).size;
      if (shouldCopy) {
        fs.copyFileSync(srcPath, destPath);
        copied++;
      }
    } else {
      console.warn(`[setup-runtime] Source file not found: ${file}`);
    }
  }

  if (copied > 0) {
    console.log(`[setup-runtime] Successfully copied ${copied} ONNX Runtime Web files to public/onnxruntime/`);
  } else {
    console.log('[setup-runtime] ONNX Runtime Web files are up to date in public/onnxruntime/');
  }
}

setupRuntime();


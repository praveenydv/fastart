const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const MODEL_DIR = path.join(__dirname, '..', 'public', 'models');
const ASSETS_MODEL_DIR = path.join(__dirname, '..', 'assets', 'models');
const SELFIE_PATH = path.join(MODEL_DIR, 'selfie_segmentation.onnx');
const SELFIE_URL = 'https://huggingface.co/onnx-community/mediapipe_selfie_segmentation/resolve/main/onnx/model.onnx';
const SELFIE_EXPECTED_BYTES = 462352;
const SELFIE_SHA256 = '3241ac4ad8aa35bdaf33946776db29f7c283a413aa0b0dacb9483594b4531aad';

const MODEL_PATH = path.join(MODEL_DIR, 'modnet.onnx');
const MODEL_URL = 'https://huggingface.co/Xenova/modnet/resolve/refs%2Fpr%2F6/onnx/model.onnx';
const EXPECTED_MIN_BYTES = 25000000; // ~25.8 MB
const EXPECTED_SHA256 = '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9';

function verifySelfieModel() {
  if (!fs.existsSync(SELFIE_PATH)) return false;
  const bytes = fs.readFileSync(SELFIE_PATH);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  return bytes.length === SELFIE_EXPECTED_BYTES && digest === SELFIE_SHA256;
}

function verifyModel() {
  if (!fs.existsSync(MODEL_PATH)) return false;
  const bytes = fs.readFileSync(MODEL_PATH);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  return bytes.length >= EXPECTED_MIN_BYTES && digest === EXPECTED_SHA256;
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Follow HTTP 301 / 302 / 307 redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      let lastReport = 0;

      const fileStream = fs.createWriteStream(destPath);

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalBytes > 0) {
          const pct = Math.floor((downloaded / totalBytes) * 100);
          if (pct >= lastReport + 10 || pct === 100) {
            lastReport = pct;
            const mb = (downloaded / (1024 * 1024)).toFixed(1);
            const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
            process.stdout.write(`\r[download-models] Progress: ${pct}% (${mb}MB / ${totalMb}MB)`);
          }
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => {
          console.log('\n[download-models] Download complete!');
          resolve();
        });
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function main() {
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }
  if (!fs.existsSync(ASSETS_MODEL_DIR)) {
    fs.mkdirSync(ASSETS_MODEL_DIR, { recursive: true });
  }

  // 1. Download ultra-fast 256x256 MediaPipe Selfie Segmentation (462 KB)
  if (!verifySelfieModel()) {
    console.log('[download-models] Downloading ultra-fast MediaPipe selfie model (462 KB)...');
    try {
      await downloadFile(SELFIE_URL, SELFIE_PATH);
      console.log('[download-models] Verified selfie_segmentation.onnx');
    } catch (err) {
      console.warn('[download-models] Could not download selfie model:', err.message);
    }
  } else {
    console.log('[download-models] Ultra-fast selfie segmentation model already present.');
  }

  if (fs.existsSync(SELFIE_PATH)) {
    fs.copyFileSync(SELFIE_PATH, path.join(ASSETS_MODEL_DIR, 'selfie_segmentation.onnx'));
  }

  // 2. Download MODNet model if needed
  if (!verifyModel()) {
    console.log('[download-models] Downloading MODNet model from Hugging Face...');
    try {
      await downloadFile(MODEL_URL, MODEL_PATH);
      console.log('[download-models] Verified modnet.onnx');
    } catch (err) {
      console.warn('[download-models] Could not download MODNet model:', err.message);
    }
  } else {
    console.log('[download-models] MODNet model already present.');
  }
}

main();


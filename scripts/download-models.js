const fs = require('fs');
const path = require('path');
const https = require('https');

const MODEL_DIR = path.join(__dirname, '..', 'public', 'models');
const MODEL_PATH = path.join(MODEL_DIR, 'modnet.onnx');
const MODEL_URL = 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx';
const EXPECTED_MIN_BYTES = 25000000; // ~25.8 MB

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

  if (fs.existsSync(MODEL_PATH)) {
    const stats = fs.statSync(MODEL_PATH);
    if (stats.size >= EXPECTED_MIN_BYTES) {
      console.log(`[download-models] MODNet model already exists (${(stats.size / (1024 * 1024)).toFixed(1)}MB). Skipping download.`);
      return;
    }
    console.log('[download-models] Existing model file is incomplete or corrupted, re-downloading...');
    try { fs.unlinkSync(MODEL_PATH); } catch (_) {}
  }

  console.log('[download-models] Downloading MODNet AI matting model from Hugging Face...');
  try {
    await downloadFile(MODEL_URL, MODEL_PATH);
    const finalStats = fs.statSync(MODEL_PATH);
    console.log(`[download-models] Verified model file: ${(finalStats.size / (1024 * 1024)).toFixed(1)}MB saved to public/models/modnet.onnx`);
  } catch (err) {
    console.error('[download-models] Failed to download model:', err.message);
    process.exit(1);
  }
}

main();


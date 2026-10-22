// High-Performance Large Media Storage & Metadata Engine
// Handles gigabyte-scale video, 4K footage, and audio with IndexedDB & hardware decoder safety

import { Platform } from 'react-native';

const DB_NAME = 'fastart_media_db';
const DB_VERSION = 1;
const STORE_MEDIA = 'media_files';

export interface StoredMediaRecord {
  id: string;
  name: string;
  type: 'video' | 'photo' | 'audio';
  mimeType: string;
  size: number;
  blob: Blob;
  duration?: number;
  width?: number;
  height?: number;
  thumbnail?: string;
  createdAt: number;
}

// In-memory object URL cache to avoid redundant URL.createObjectURL allocations
const objectUrlCache = new Map<string, string>();

let dbPromise: Promise<IDBDatabase> | null = null;

function getIndexedDB(): Promise<IDBDatabase> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e: any) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          const store = db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.close();
          const upgradeReq = indexedDB.open(DB_NAME, (db.version || 1) + 1);
          upgradeReq.onupgradeneeded = () => {
            const upDb = upgradeReq.result;
            if (!upDb.objectStoreNames.contains(STORE_MEDIA)) {
              const store = upDb.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
              store.createIndex('createdAt', 'createdAt', { unique: false });
            }
          };
          upgradeReq.onsuccess = () => resolve(upgradeReq.result);
          upgradeReq.onerror = () => resolve(db);
          return;
        }
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

// Store a large media file (Blob / File) safely in IndexedDB without memory or localStorage limit
export async function persistLargeMedia(
  fileOrBlob: Blob | File,
  id: string,
  name: string,
  type: 'video' | 'photo' | 'audio',
  metadata?: { duration?: number; width?: number; height?: number; thumbnail?: string }
): Promise<{ id: string; url: string; size: number; duration: number; thumbnail?: string }> {
  const mimeType = fileOrBlob.type || (type === 'video' ? 'video/mp4' : type === 'audio' ? 'audio/mpeg' : 'image/jpeg');
  const size = fileOrBlob.size;

  let duration = metadata?.duration || (type === 'video' ? 6.0 : type === 'audio' ? 10.0 : 4.0);
  let width = metadata?.width || (type === 'video' ? 1920 : 1080);
  let height = metadata?.height || (type === 'video' ? 1080 : 1920);
  let thumbnail = metadata?.thumbnail;

  // Extract real metadata if missing
  if (Platform.OS === 'web' && (!metadata || !metadata.duration)) {
    try {
      if (type === 'video') {
        const extracted = await extractVideoMetadata(fileOrBlob);
        duration = extracted.duration || duration;
        width = extracted.width || width;
        height = extracted.height || height;
        thumbnail = extracted.thumbnail || thumbnail;
      } else if (type === 'audio') {
        const extracted = await extractAudioMetadata(fileOrBlob);
        duration = extracted.duration || duration;
      }
    } catch (e) {
      console.warn('Metadata extraction fallback:', e);
    }
  }

  // Create or reuse object URL
  let liveUrl = objectUrlCache.get(id);
  if (!liveUrl) {
    liveUrl = URL.createObjectURL(fileOrBlob);
    objectUrlCache.set(id, liveUrl);
  }

  // Save to IndexedDB if on web
  if (Platform.OS === 'web' && typeof indexedDB !== 'undefined') {
    try {
      const db = await getIndexedDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_MEDIA, 'readwrite');
        const store = tx.objectStore(STORE_MEDIA);
        const record: StoredMediaRecord = {
          id,
          name,
          type,
          mimeType,
          size,
          blob: fileOrBlob,
          duration,
          width,
          height,
          thumbnail,
          createdAt: Date.now(),
        };
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      });
    } catch (err) {
      console.warn('IndexedDB persist warning (continuing with in-memory URL):', err);
    }
  }

  return { id, url: liveUrl, size, duration, thumbnail };
}

// Retrieve live object URL for a media ID from IndexedDB
export async function getLiveMediaUrl(id: string): Promise<string | null> {
  if (objectUrlCache.has(id)) {
    return objectUrlCache.get(id)!;
  }
  if (Platform.OS !== 'web' || typeof indexedDB === 'undefined') return null;

  try {
    const db = await getIndexedDB();
    const record = await new Promise<StoredMediaRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const store = tx.objectStore(STORE_MEDIA);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (record && record.blob) {
      const url = URL.createObjectURL(record.blob);
      objectUrlCache.set(id, url);
      return url;
    }
  } catch (err) {
    console.warn('Failed to load media from IndexedDB:', err);
  }
  return null;
}

// Extract exact video duration, dimensions, and generate crisp lightweight thumbnail
export function extractVideoMetadata(
  fileOrBlob: Blob | File | string
): Promise<{ duration: number; width: number; height: number; thumbnail: string }> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve({ duration: 6.0, width: 1920, height: 1080, thumbnail: '' });
    }

    const url = typeof fileOrBlob === 'string' ? fileOrBlob : URL.createObjectURL(fileOrBlob);
    const vid = document.createElement('video');
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = 'metadata';
    vid.src = url;

    const cleanup = () => {
      try {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
        if (typeof fileOrBlob !== 'string') {
          // Do not revoke if cached, or let GC handle
        }
      } catch (e) {}
    };

    let resolved = false;
    const finish = (duration: number, width: number, height: number, thumbnail = '') => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ duration, width, height, thumbnail });
    };

    const timeout = setTimeout(() => {
      finish(
        vid.duration && isFinite(vid.duration) && vid.duration > 0 ? Number(vid.duration.toFixed(2)) : 6.0,
        vid.videoWidth || 1920,
        vid.videoHeight || 1080
      );
    }, 3000);

    vid.onloadedmetadata = () => {
      const dur = vid.duration && isFinite(vid.duration) && vid.duration > 0 ? Number(vid.duration.toFixed(2)) : 6.0;
      const w = vid.videoWidth || 1920;
      const h = vid.videoHeight || 1080;

      // Capture small thumbnail at 0.5s
      const seekTime = Math.min(0.5, Math.max(0.1, dur * 0.1));
      vid.currentTime = seekTime;
    };

    vid.onseeked = () => {
      clearTimeout(timeout);
      let thumb = '';
      try {
        const thumbCanvas = document.createElement('canvas');
        const tw = Math.min(640, vid.videoWidth || 640);
        const aspect = (vid.videoWidth || 16) / (vid.videoHeight || 9);
        const th = Math.round(tw / aspect);
        thumbCanvas.width = tw;
        thumbCanvas.height = th;
        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(vid, 0, 0, tw, th);
          thumb = thumbCanvas.toDataURL('image/jpeg', 0.85);
        }
      } catch (e) {}

      const dur = vid.duration && isFinite(vid.duration) && vid.duration > 0 ? Number(vid.duration.toFixed(2)) : 6.0;
      finish(dur, vid.videoWidth || 1920, vid.videoHeight || 1080, thumb);
    };

    vid.onerror = () => {
      clearTimeout(timeout);
      finish(6.0, 1920, 1080, '');
    };
  });
}

// Extract exact audio duration from file or blob
export function extractAudioMetadata(fileOrBlob: Blob | File | string): Promise<{ duration: number }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve({ duration: 15.0 });

    const url = typeof fileOrBlob === 'string' ? fileOrBlob : URL.createObjectURL(fileOrBlob);
    const audio = new Audio(url);

    let resolved = false;
    const finish = (duration: number) => {
      if (resolved) return;
      resolved = true;
      try {
        audio.pause();
        audio.src = '';
      } catch (e) {}
      resolve({ duration });
    };

    const timeout = setTimeout(() => finish(15.0), 3000);

    audio.onloadedmetadata = () => {
      clearTimeout(timeout);
      const dur = audio.duration && isFinite(audio.duration) && audio.duration > 0
        ? Number(audio.duration.toFixed(2))
        : 15.0;
      finish(dur);
    };

    audio.onerror = () => {
      clearTimeout(timeout);
      finish(15.0);
    };
  });
}

// Delete media from IndexedDB & revoke live object URL
export async function deleteMedia(id: string): Promise<void> {
  const cachedUrl = objectUrlCache.get(id);
  if (cachedUrl) {
    try {
      URL.revokeObjectURL(cachedUrl);
    } catch (e) {}
    objectUrlCache.delete(id);
  }

  if (Platform.OS !== 'web' || typeof indexedDB === 'undefined') return;

  try {
    const db = await getIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_MEDIA, 'readwrite');
      const store = tx.objectStore(STORE_MEDIA);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to delete media from IndexedDB:', err);
  }
}

// Prune orphaned media records from IndexedDB to free disk space
export async function pruneUnusedMediaFiles(activeIds: Set<string>): Promise<number> {
  if (Platform.OS !== 'web' || typeof indexedDB === 'undefined') return 0;
  let deletedCount = 0;

  try {
    const db = await getIndexedDB();
    const allRecords = await new Promise<StoredMediaRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const store = tx.objectStore(STORE_MEDIA);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    for (const rec of allRecords) {
      if (!activeIds.has(rec.id)) {
        await deleteMedia(rec.id);
        deletedCount++;
      }
    }
  } catch (err) {
    console.warn('Failed to prune unused media files:', err);
  }

  return deletedCount;
}

// Estimate total storage used by media files in IndexedDB (in MB)
export async function estimateMediaStorageUsage(): Promise<{ totalBytes: number; count: number }> {
  if (Platform.OS !== 'web' || typeof indexedDB === 'undefined') {
    return { totalBytes: 0, count: 0 };
  }

  try {
    const db = await getIndexedDB();
    const records = await new Promise<StoredMediaRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const store = tx.objectStore(STORE_MEDIA);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    let totalBytes = 0;
    records.forEach((r) => {
      totalBytes += r.size || (r.blob ? r.blob.size : 0);
    });

    return { totalBytes, count: records.length };
  } catch (err) {
    console.warn('Failed to estimate media storage:', err);
    return { totalBytes: 0, count: 0 };
  }
}

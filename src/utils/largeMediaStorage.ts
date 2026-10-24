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
// Direct in-memory blob cache by URL to eliminate brittle fetch(blobUrl) errors completely
const blobByUrlCache = new Map<string, Blob | File>();

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
      } else if (type === 'photo') {
        const extracted = await extractImageMetadata(fileOrBlob);
        width = extracted.width || width;
        height = extracted.height || height;
        thumbnail = extracted.thumbnail || thumbnail;
      }
    } catch (e) {
      console.warn('Metadata extraction fallback:', e);
    }
  } else if (Platform.OS !== 'web' && type === 'video' && !thumbnail && typeof fileOrBlob === 'string') {
    try {
      const { getThumbnailAsync } = await import('expo-video-thumbnails');
      const thumb = await getThumbnailAsync(fileOrBlob, { time: 500 });
      thumbnail = thumb?.uri || thumbnail;
    } catch (e) {
      console.warn('Native thumbnail extraction fallback:', e);
    }
  }

  // Create or reuse object URL
  let liveUrl = objectUrlCache.get(id);
  if (!liveUrl) {
    liveUrl = URL.createObjectURL(fileOrBlob);
    objectUrlCache.set(id, liveUrl);
    blobByUrlCache.set(liveUrl, fileOrBlob);
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
    let record = await new Promise<StoredMediaRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const store = tx.objectStore(STORE_MEDIA);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    // Fallback: If not found by exact id, match against all records
    if (!record) {
      const all = await getAllStoredMedia();
      record = all.find((r) => r.id === id || id.startsWith(r.id) || r.id.startsWith(id)) || null;
    }

    if (record && record.blob) {
      const url = URL.createObjectURL(record.blob);
      objectUrlCache.set(id, url);
      objectUrlCache.set(record.id, url);
      blobByUrlCache.set(url, record.blob);
      return url;
    }
  } catch (err) {
    console.warn('Failed to load media from IndexedDB:', err);
  }
  return null;
}

// Retrieve live File or Blob for a media ID from IndexedDB
export async function getLiveMediaBlob(id: string): Promise<Blob | File | null> {
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
    return record?.blob || null;
  } catch (err) {
    console.warn('Failed to load media blob from IndexedDB:', err);
    return null;
  }
}

// Robust multi-strategy ArrayBuffer loader for media (handles in-memory blob cache, blob URLs, XHR, and IndexedDB)
export async function getMediaBinaryBuffer(url: string, lookupId?: string): Promise<ArrayBuffer | null> {
  if (!url && !lookupId) return null;

  // 0. Direct in-memory Blob/File cache (0ms, 100% reliable, zero network/CORS failure)
  if (url && blobByUrlCache.has(url)) {
    try {
      const b = blobByUrlCache.get(url)!;
      const buf = await b.arrayBuffer();
      if (buf && buf.byteLength > 0) return buf.slice(0);
    } catch (_) {}
  }

  // 0b. Data URI base64 decoder
  if (url && url.startsWith('data:')) {
    try {
      const commaIdx = url.indexOf(',');
      if (commaIdx >= 0) {
        const base64 = url.slice(commaIdx + 1);
        const buf = base64ToArrayBuffer(base64);
        if (buf && buf.byteLength > 0) return buf;
      }
    } catch (_) {}
  }

  // 1. Try standard fetch if URL exists
  if (url) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        if (buf && buf.byteLength > 0) return buf.slice(0);
      }
    } catch (_) {}

    // 2. XMLHttpRequest fallback (Chrome and Safari permit XHR reading local blob: URLs even when fetch rejects)
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const buf = await new Promise<ArrayBuffer | null>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.responseType = 'arraybuffer';
          xhr.onload = () => {
            if (xhr.status === 200 || xhr.status === 0) {
              resolve(xhr.response);
            } else {
              resolve(null);
            }
          };
          xhr.onerror = () => resolve(null);
          xhr.send();
        });
        if (buf && buf.byteLength > 0) return buf.slice(0);
      } catch (_) {}
    }
  }

  // 3. Mobile FileSystem read for file://, content://, or local paths (React Native Android & iOS)
  if (Platform.OS !== 'web' && url && (url.startsWith('file:') || url.startsWith('content:') || url.startsWith('/'))) {
    try {
      const { File } = await import('expo-file-system');
      const file = new File(url);
      const ab = await file.arrayBuffer();
      if (ab && ab.byteLength > 0) return ab;
    } catch (_) {}

    try {
      const FileSystemLegacy = await import('expo-file-system/legacy');
      const base64Data = await FileSystemLegacy.readAsStringAsync(url, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });
      if (base64Data && base64Data.length > 0) {
        const buf = base64ToArrayBuffer(base64Data);
        if (buf && buf.byteLength > 0) return buf;
      }
    } catch (e) {
      console.warn('[largeMediaStorage] Mobile FileSystem binary read failed:', e);
    }
  }

  // 4. Retrieve directly from IndexedDB if lookupId is provided
  if (lookupId) {
    try {
      const blob = await getLiveMediaBlob(lookupId);
      if (blob) {
        const buf = await blob.arrayBuffer();
        if (buf && buf.byteLength > 0) return buf.slice(0);
      }
    } catch (_) {}
  }

  // 5. Try searching IndexedDB for matching record
  if (Platform.OS === 'web' && typeof indexedDB !== 'undefined') {
    try {
      const records = await getAllStoredMedia();
      for (const rec of records) {
        if (rec.id === lookupId || (lookupId && rec.id.includes(lookupId))) {
          const buf = await rec.blob.arrayBuffer();
          if (buf && buf.byteLength > 0) return buf.slice(0);
        }
      }
      if (records.length > 0 && records[0].blob) {
        const buf = await records[0].blob.arrayBuffer();
        if (buf && buf.byteLength > 0) return buf.slice(0);
      }
    } catch (_) {}
  }

  return null;
}

/**
 * High-speed pure JS base64 to ArrayBuffer converter
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  let len = base64.length;
  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }
  const arrayBuffer = new ArrayBuffer(Math.max(0, Math.floor(bufferLength)));
  const bytes = new Uint8Array(arrayBuffer);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const enc1 = lookup[base64.charCodeAt(i)];
    const enc2 = lookup[base64.charCodeAt(i + 1)];
    const enc3 = lookup[base64.charCodeAt(i + 2)];
    const enc4 = lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = (enc1 << 2) | (enc2 >> 4);
    if (base64[i + 2] !== '=') {
      bytes[p++] = ((enc2 & 15) << 4) | (enc3 >> 2);
    }
    if (base64[i + 3] !== '=') {
      bytes[p++] = ((enc3 & 3) << 6) | enc4;
    }
  }
  return arrayBuffer;
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
    vid.preload = 'auto';
    vid.style.position = 'fixed';
    vid.style.top = '-9999px';
    vid.style.left = '-9999px';
    vid.style.width = '1px';
    vid.style.height = '1px';
    vid.style.opacity = '0';
    vid.style.pointerEvents = 'none';

    const cleanup = () => {
      try {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
        if (vid.parentNode) {
          vid.parentNode.removeChild(vid);
        }
      } catch (e) {}
    };

    let resolved = false;
    let seekAttempt = 0;
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
    }, 4500);

    vid.onloadedmetadata = () => {
      const dur = vid.duration && isFinite(vid.duration) && vid.duration > 0 ? Number(vid.duration.toFixed(2)) : 6.0;
      // Seek to at least 0.25s to avoid pre-roll black frames
      const seekTime = Math.min(Math.max(0.25, dur * 0.15), Math.max(0.2, dur - 0.2));
      vid.currentTime = seekTime;
    };

    vid.onseeked = () => {
      let thumb = '';
      try {
        const vw = vid.videoWidth || 640;
        const vh = vid.videoHeight || 360;
        const thumbCanvas = document.createElement('canvas');
        const tw = Math.min(480, vw);
        const aspect = vw / (vh || 1);
        const th = Math.round(tw / aspect);
        thumbCanvas.width = tw;
        thumbCanvas.height = th;
        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(vid, 0, 0, tw, th);

          // Check if frame is pure black
          let isBlack = false;
          try {
            const p = ctx.getImageData(Math.floor(tw / 2), Math.floor(th / 2), 1, 1).data;
            if (p[0] < 15 && p[1] < 15 && p[2] < 15) {
              isBlack = true;
            }
          } catch (_) {}

          const dur = vid.duration && isFinite(vid.duration) && vid.duration > 0 ? Number(vid.duration.toFixed(2)) : 6.0;
          if (isBlack && seekAttempt === 0 && dur > 0.8) {
            seekAttempt++;
            vid.currentTime = Math.min(1.0, dur * 0.35);
            return;
          }

          thumb = thumbCanvas.toDataURL('image/jpeg', 0.85);
        }
      } catch (e) {}

      clearTimeout(timeout);
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

// Extract image dimensions and generate a persistent lightweight base64 thumbnail
export function extractImageMetadata(
  fileOrBlob: Blob | File | string
): Promise<{ width: number; height: number; thumbnail: string }> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return resolve({ width: 1080, height: 1920, thumbnail: '' });
    }

    const url = typeof fileOrBlob === 'string' ? fileOrBlob : URL.createObjectURL(fileOrBlob);
    const img = new Image();

    let resolved = false;
    const finish = (width: number, height: number, thumbnail = '') => {
      if (resolved) return;
      resolved = true;
      resolve({ width, height, thumbnail });
    };

    const timeout = setTimeout(() => {
      finish(1080, 1920, '');
    }, 3000);

    img.onload = () => {
      clearTimeout(timeout);
      const w = img.naturalWidth || 1080;
      const h = img.naturalHeight || 1920;
      let thumb = '';
      try {
        const canvas = document.createElement('canvas');
        const aspect = (w || 1) / (h || 1);
        const targetW = Math.min(320, w);
        const targetH = Math.round(targetW / aspect);
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);
          thumb = canvas.toDataURL('image/jpeg', 0.85);
        }
      } catch (e) {}
      finish(w, h, thumb);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      finish(1080, 1920, '');
    };

    img.src = url;
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

// Retrieve all stored media records from IndexedDB
export async function getAllStoredMedia(): Promise<StoredMediaRecord[]> {
  if (Platform.OS !== 'web' || typeof indexedDB === 'undefined') return [];
  try {
    const db = await getIndexedDB();
    return await new Promise<StoredMediaRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const store = tx.objectStore(STORE_MEDIA);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to get all stored media:', err);
    return [];
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

// Rehydrate all dead blob URLs across video, photo, and audio clips upon page refresh
export async function rehydrateProjectMedia(project: any): Promise<any> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return project;
  if (!project || !project.tracks) return project;

  let hasChanges = false;
  const updatedVideo = await Promise.all(
    (project.tracks.video || []).map(async (clip: any) => {
      const lookupId = clip.sourceMediaId || clip.id;
      const isBlob = clip.url && clip.url.startsWith('blob:');
      const isKnown = isBlob && objectUrlCache.has(clip.url);

      if (!isKnown) {
        const freshUrl = await getLiveMediaUrl(lookupId);
        if (freshUrl && freshUrl !== clip.url) {
          hasChanges = true;
          return {
            ...clip,
            url: freshUrl,
            thumbnail:
              clip.thumbnail && !clip.thumbnail.startsWith('blob:')
                ? clip.thumbnail
                : clip.type === 'photo'
                  ? freshUrl
                  : clip.thumbnail,
          };
        }
      }
      return clip;
    })
  );

  const updatedAudio = await Promise.all(
    (project.tracks.audio || []).map(async (clip: any) => {
      const lookupId = clip.sourceMediaId || clip.id;
      const isBlob = clip.url && clip.url.startsWith('blob:');
      const isKnown = isBlob && objectUrlCache.has(clip.url);

      if (!isKnown) {
        const freshUrl = await getLiveMediaUrl(lookupId);
        if (freshUrl && freshUrl !== clip.url) {
          hasChanges = true;
          return {
            ...clip,
            url: freshUrl,
          };
        }
      }
      return clip;
    })
  );

  if (hasChanges) {
    return {
      ...project,
      tracks: {
        ...project.tracks,
        video: updatedVideo,
        audio: updatedAudio,
      },
    };
  }

  return project;
}

export async function rehydrateProjectsMedia(projects: any[]): Promise<any[]> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return projects;
  return Promise.all(projects.map(rehydrateProjectMedia));
}

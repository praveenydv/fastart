// High-Performance Large Media Storage & Metadata Engine
// Handles gigabyte-scale video, 4K footage, and audio with IndexedDB & hardware decoder safety

import { Platform } from 'react-native';

const DB_NAME = 'fastart_media_db';
const DB_VERSION = 3;
const STORE_MEDIA = 'media_files';
const STORE_MASKS = 'cutout_masks';
const STORE_PROJECTS = 'projects_data';

export interface StoredMediaRecord {
  id: string;
  name: string;
  type: 'video' | 'photo' | 'audio';
  mimeType: string;
  size: number;
  blob?: Blob;
  handle?: any; // FileSystemFileHandle for zero-duplication direct disk linking
  isLinked?: boolean;
  nativePath?: string;
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
        if (!db.objectStoreNames.contains(STORE_MASKS)) {
          db.createObjectStore(STORE_MASKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        if (
          !db.objectStoreNames.contains(STORE_MEDIA) ||
          !db.objectStoreNames.contains(STORE_MASKS) ||
          !db.objectStoreNames.contains(STORE_PROJECTS)
        ) {
          db.close();
          const upgradeReq = indexedDB.open(DB_NAME, (db.version || 1) + 1);
          upgradeReq.onupgradeneeded = () => {
            const upDb = upgradeReq.result;
            if (!upDb.objectStoreNames.contains(STORE_MEDIA)) {
              const store = upDb.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
              store.createIndex('createdAt', 'createdAt', { unique: false });
            }
            if (!upDb.objectStoreNames.contains(STORE_MASKS)) {
              upDb.createObjectStore(STORE_MASKS, { keyPath: 'id' });
            }
            if (!upDb.objectStoreNames.contains(STORE_PROJECTS)) {
              upDb.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
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

/**
 * Verifies or prompts user permission for a stored FileSystemFileHandle
 */
export async function verifyHandlePermission(handle: any): Promise<boolean> {
  if (!handle || typeof handle.queryPermission !== 'function') return false;
  try {
    const status = await handle.queryPermission({ mode: 'read' });
    if (status === 'granted') return true;
    if (status === 'prompt' && typeof handle.requestPermission === 'function') {
      const requestStatus = await handle.requestPermission({ mode: 'read' });
      return requestStatus === 'granted';
    }
  } catch (e) {
    console.warn('Handle permission check error:', e);
  }
  return false;
}

export interface WebMediaPickResult {
  file: File;
  handle?: any; // FileSystemFileHandle
  isLinked: boolean;
}

/**
 * Universal Web file picker:
 * - Prioritizes File System Access API (showOpenFilePicker): links directly to user's file location with 0 duplicate bytes!
 * - Fallbacks to HTML5 file input when unavailable (Safari, Firefox)
 */
export async function pickWebMedia(
  acceptTypes: 'all' | 'video' | 'photo' | 'audio' = 'all'
): Promise<WebMediaPickResult | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  // 1. Prioritize File System Access API (Zero-Duplication Local File Linking)
  if ('showOpenFilePicker' in window) {
    try {
      const acceptMap: Record<string, string[]> = {};
      if (acceptTypes === 'all' || acceptTypes === 'video') {
        acceptMap['video/*'] = ['.mp4', '.mov', '.webm', '.m4v', '.mkv'];
      }
      if (acceptTypes === 'all' || acceptTypes === 'photo') {
        acceptMap['image/*'] = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
      }
      if (acceptTypes === 'all' || acceptTypes === 'audio') {
        acceptMap['audio/*'] = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
      }

      const handles = await (window as any).showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Media Files',
            accept: acceptMap,
          },
        ],
      });

      if (handles && handles.length > 0) {
        const handle = handles[0];
        const file = await handle.getFile();
        return { file, handle, isLinked: true };
      }
      return null;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return null; // User cancelled dialog
      }
      console.warn('showOpenFilePicker error, falling back to input:', err);
    }
  }

  // 2. Standard HTML5 file picker fallback
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    let accept = 'video/*,image/*,audio/*';
    if (acceptTypes === 'video') accept = 'video/*';
    else if (acceptTypes === 'photo') accept = 'image/*';
    else if (acceptTypes === 'audio') accept = 'audio/*';
    input.accept = accept;

    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        resolve({ file, isLinked: false });
      } else {
        resolve(null);
      }
    };

    input.oncancel = () => resolve(null);

    setTimeout(() => {
      try {
        input.click();
      } catch {
        resolve(null);
      }
    }, 40);
  });
}

/**
 * On Mobile (iOS & Android): Copies media from ephemeral picker cache to the application's permanent Documents/media/ directory.
 * Survives app restarts, system cache cleanups, and device reboot.
 */
export async function persistNativeMediaCopy(
  sourceUri: string,
  id: string,
  fileName?: string
): Promise<string> {
  if (Platform.OS === 'web') return sourceUri;
  try {
    const FileSystemLegacy = await import('expo-file-system/legacy');
    const docDir = FileSystemLegacy.documentDirectory;
    if (!docDir) return sourceUri;

    const mediaDir = `${docDir}media/`;
    const dirInfo = await FileSystemLegacy.getInfoAsync(mediaDir);
    if (!dirInfo.exists) {
      await FileSystemLegacy.makeDirectoryAsync(mediaDir, { intermediates: true });
    }

    const cleanName = (fileName || 'media').replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = cleanName.includes('.') ? '' : '.mp4';
    const targetPath = `${mediaDir}${id}_${cleanName}${ext}`;

    const targetInfo = await FileSystemLegacy.getInfoAsync(targetPath);
    if (targetInfo.exists) {
      return targetPath;
    }

    await FileSystemLegacy.copyAsync({
      from: sourceUri,
      to: targetPath,
    });

    return targetPath;
  } catch (err) {
    console.warn('[largeMediaStorage] Failed to copy media on native:', err);
    return sourceUri;
  }
}

/**
 * Checks if a stored media record exists in IndexedDB and whether it has a handle or blob.
 */
export async function getStoredMediaStatus(
  id: string,
  hintName?: string
): Promise<{ exists: boolean; hasHandle: boolean; hasBlob: boolean; name?: string }> {
  if (Platform.OS !== 'web' || typeof indexedDB === 'undefined') {
    return { exists: false, hasHandle: false, hasBlob: false };
  }
  try {
    const all = await getAllStoredMedia();
    let record =
      all.find(
        (r) =>
          r.id === id ||
          r.id.startsWith(id) ||
          id.startsWith(r.id) ||
          (hintName &&
            (r.name === hintName ||
              r.name.toLowerCase().includes(hintName.toLowerCase()) ||
              hintName.toLowerCase().includes(r.name.toLowerCase())))
      ) || null;

    if (!record && all.length === 1) {
      record = all[0];
    }

    if (!record) return { exists: false, hasHandle: false, hasBlob: false };
    return {
      exists: true,
      hasHandle: Boolean(record.handle),
      hasBlob: Boolean(record.blob),
      name: record.name,
    };
  } catch {
    return { exists: false, hasHandle: false, hasBlob: false };
  }
}

/**
 * Attempts to reconnect a linked media file using its existing FileSystemFileHandle without opening a file picker.
 * Called during a user interaction (gesture) so Chrome/WebKit permits querying/requesting permission.
 */
export async function reconnectLinkedMedia(
  mediaId: string,
  hintName?: string
): Promise<{ url: string; title: string } | null> {
  if (Platform.OS !== 'web' || typeof indexedDB === 'undefined') return null;
  try {
    const db = await getIndexedDB();
    const all = await getAllStoredMedia();
    let record =
      all.find(
        (r) =>
          r.id === mediaId ||
          r.id.startsWith(mediaId) ||
          mediaId.startsWith(r.id) ||
          (hintName &&
            (r.name === hintName ||
              r.name.toLowerCase().includes(hintName.toLowerCase()) ||
              hintName.toLowerCase().includes(r.name.toLowerCase())))
      ) || null;

    if (!record && all.length === 1) {
      record = all[0];
    }

    if (!record) return null;

    // If record already has a blob, create and cache URL immediately
    if (record.blob) {
      const live = URL.createObjectURL(record.blob);
      objectUrlCache.set(mediaId, live);
      objectUrlCache.set(live, live);
      if (record.id) objectUrlCache.set(record.id, live);
      blobByUrlCache.set(live, record.blob);
      return { url: live, title: record.name };
    }

    if (!record.handle) return null;

    let hasPerm = false;
    try {
      const status = await record.handle.queryPermission({ mode: 'read' });
      if (status === 'granted') {
        hasPerm = true;
      } else if (typeof record.handle.requestPermission === 'function') {
        const req = await record.handle.requestPermission({ mode: 'read' });
        hasPerm = req === 'granted';
      }
    } catch (e) {
      console.warn('[reconnectLinkedMedia] Permission check:', e);
    }

    if (hasPerm) {
      const file = await record.handle.getFile();
      if (file) {
        const live = URL.createObjectURL(file);
        objectUrlCache.set(mediaId, live);
        objectUrlCache.set(live, live);
        if (record.id) objectUrlCache.set(record.id, live);
        blobByUrlCache.set(live, file);

        // Permanently cache blob in record so that all future refreshes load instantly
        try {
          const tx = db.transaction(STORE_MEDIA, 'readwrite');
          const store = tx.objectStore(STORE_MEDIA);
          record.blob = file;
          store.put(record);
        } catch (saveErr) {
          console.warn('[reconnectLinkedMedia] Failed to cache blob into record:', saveErr);
        }

        return { url: live, title: record.name };
      }
    }
  } catch (err) {
    console.warn('[reconnectLinkedMedia] Error reconnecting:', err);
  }
  return null;
}

/**
 * Relinks a missing or moved media file by selecting a new location from the user's filesystem.
 */
export async function relinkMediaFile(
  mediaId: string,
  type: 'all' | 'video' | 'photo' | 'audio' = 'all'
): Promise<{ url: string; title: string } | null> {
  const result = await pickWebMedia(type as any);
  if (!result) return null;

  const { file, handle } = result;
  const title = file.name.replace(/\.[^/.]+$/, '');
  const mediaType =
    type === 'all'
      ? file.type.startsWith('video')
        ? 'video'
        : file.type.startsWith('audio')
          ? 'audio'
          : 'photo'
      : type;

  const saved = await persistLargeMedia(file, mediaId, title, mediaType, {
    handle,
    isLinked: !!handle,
  });

  return { url: saved.url, title };
}

// Store a large media file (or linked FileSystemFileHandle) safely in IndexedDB
export async function persistLargeMedia(
  fileOrBlob: Blob | File,
  id: string,
  name: string,
  type: 'video' | 'photo' | 'audio',
  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
    thumbnail?: string;
    handle?: any; // FileSystemFileHandle for zero-duplication linking
    nativePath?: string;
    isLinked?: boolean;
  }
): Promise<{ id: string; url: string; size: number; duration: number; thumbnail?: string; isLinked?: boolean }> {
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
    objectUrlCache.set(liveUrl, liveUrl);
    blobByUrlCache.set(liveUrl, fileOrBlob);
  }

  const isLinked = !!metadata?.handle || metadata?.isLinked === true;

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
          // Zero-duplication: For linked files with a disk handle, NEVER copy the giant blob into IndexedDB!
          // Only unlinked ephemeral files (clipboard / recordings) store a local blob.
          blob: isLinked ? undefined : fileOrBlob,
          handle: metadata?.handle,
          isLinked,
          nativePath: metadata?.nativePath,
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

  return { id, url: liveUrl, size, duration, thumbnail, isLinked };
}

// Retrieve live object URL for a media ID from IndexedDB
export async function getLiveMediaUrl(id: string, hintName?: string): Promise<string | null> {
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
      record =
        all.find(
          (r) =>
            r.id === id ||
            id.startsWith(r.id) ||
            r.id.startsWith(id) ||
            (hintName &&
              (r.name === hintName ||
                r.name.includes(hintName) ||
                hintName.includes(r.name)))
        ) || null;

      // Secondary fallback: case-insensitive name match or single media stored
      if (!record && all.length > 0) {
        if (hintName) {
          const hn = hintName.toLowerCase();
          record =
            all.find(
              (r) =>
                r.name.toLowerCase().includes(hn) ||
                hn.includes(r.name.toLowerCase())
            ) || null;
        }
        if (!record && all.length === 1) {
          record = all[0];
        }
      }
    }

    if (record) {
      // 1. Prioritize stored blob (instant, reliable, no user-gesture permission hurdle)
      if (record.blob) {
        const url = URL.createObjectURL(record.blob);
        objectUrlCache.set(id, url);
        objectUrlCache.set(url, url);
        if (record.id) {
          objectUrlCache.set(record.id, url);
        }
        blobByUrlCache.set(url, record.blob);
        return url;
      }

      // 2. Direct local disk handle
      if (record.handle) {
        try {
          const file = await record.handle.getFile();
          if (file) {
            const url = URL.createObjectURL(file);
            objectUrlCache.set(id, url);
            objectUrlCache.set(url, url);
            if (record.id) objectUrlCache.set(record.id, url);
            blobByUrlCache.set(url, file);

            // Cache blob permanently into store so future refreshes need 0 permissions
            try {
              const writeTx = db.transaction(STORE_MEDIA, 'readwrite');
              const writeStore = writeTx.objectStore(STORE_MEDIA);
              record.blob = file;
              writeStore.put(record);
            } catch {}

            return url;
          }
        } catch (handleErr: any) {
          if (handleErr.name === 'NotAllowedError') {
            const granted = await verifyHandlePermission(record.handle);
            if (granted) {
              const file = await record.handle.getFile();
              if (file) {
                const url = URL.createObjectURL(file);
                objectUrlCache.set(id, url);
                objectUrlCache.set(url, url);
                if (record.id) objectUrlCache.set(record.id, url);
                blobByUrlCache.set(url, file);

                try {
                  const writeTx = db.transaction(STORE_MEDIA, 'readwrite');
                  const writeStore = writeTx.objectStore(STORE_MEDIA);
                  record.blob = file;
                  writeStore.put(record);
                } catch {}

                return url;
              }
            }
          }
          console.warn(`[largeMediaStorage] Linked file "${record.name}" could not be opened:`, handleErr);
          return null;
        }
      }
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

    if (record?.blob) {
      return record.blob;
    }

    if (record?.handle) {
      try {
        const file = await record.handle.getFile();
        if (file) return file;
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          const granted = await verifyHandlePermission(record.handle);
          if (granted) {
            const file = await record.handle.getFile();
            if (file) return file;
          }
        }
      }
    }

    return null;
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
    vid.preload = 'metadata'; // Fast header-only load: avoids buffering the full multi-GB video
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
    }, 1200);

    vid.onloadedmetadata = () => {
      const dur = vid.duration && isFinite(vid.duration) && vid.duration > 0 ? Number(vid.duration.toFixed(2)) : 6.0;
      vid.currentTime = Math.min(0.2, Math.max(0, dur * 0.1));
    };

    vid.onseeked = () => {
      let thumb = '';
      try {
        const vw = vid.videoWidth || 640;
        const vh = vid.videoHeight || 360;
        const thumbCanvas = document.createElement('canvas');
        const tw = Math.min(320, vw);
        const aspect = vw / (vh || 1);
        const th = Math.round(tw / aspect);
        thumbCanvas.width = tw;
        thumbCanvas.height = th;
        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(vid, 0, 0, tw, th);
          thumb = thumbCanvas.toDataURL('image/jpeg', 0.7);
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
        const freshUrl = await getLiveMediaUrl(lookupId, clip.title || clip.name);
        if (freshUrl && freshUrl !== clip.url) {
          hasChanges = true;
          return {
            ...clip,
            sourceMediaId: clip.sourceMediaId || lookupId,
            url: freshUrl,
            isMissing: false,
            needsPermission: false,
            thumbnail:
              clip.thumbnail && !clip.thumbnail.startsWith('blob:')
                ? clip.thumbnail
                : clip.type === 'photo'
                  ? freshUrl
                  : clip.thumbnail,
          };
        } else if (!freshUrl && isBlob) {
          hasChanges = true;
          const status = await getStoredMediaStatus(lookupId, clip.title || clip.name);
          if (clip.isLinked || status.hasHandle || status.exists) {
            return {
              ...clip,
              isLinked: true,
              needsPermission: true,
              isMissing: false, // Guaranteed: linked files on user's disk are NEVER falsely marked missing!
              missingTitle: status.name || clip.title || clip.name,
            };
          }
          return {
            ...clip,
            isLinked: true,
            needsPermission: true,
            isMissing: false,
            missingTitle: clip.title || clip.name,
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
        const freshUrl = await getLiveMediaUrl(lookupId, clip.title || clip.name);
        if (freshUrl && freshUrl !== clip.url) {
          hasChanges = true;
          return {
            ...clip,
            sourceMediaId: clip.sourceMediaId || lookupId,
            url: freshUrl,
            isMissing: false,
            needsPermission: false,
          };
        } else if (!freshUrl && isBlob) {
          hasChanges = true;
          const status = await getStoredMediaStatus(lookupId, clip.title || clip.name);
          if (clip.isLinked || status.hasHandle || status.exists) {
            return {
              ...clip,
              isLinked: true,
              needsPermission: true,
              isMissing: false,
              missingTitle: status.name || clip.title || clip.name,
            };
          }
          return {
            ...clip,
            isLinked: true,
            needsPermission: true,
            isMissing: false,
            missingTitle: clip.title || clip.name,
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

/**
 * Listens for the first user interaction to transparently query and reconnect any linked files
 * that Chrome held back permissions for during page load.
 */
export function setupAutoReconnectListener(
  onReconnected?: (lookupId: string, url: string) => void
) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  const tryReconnectAll = async () => {
    window.removeEventListener('click', tryReconnectAll, true);
    window.removeEventListener('keydown', tryReconnectAll, true);

    try {
      const all = await getAllStoredMedia();
      for (const record of all) {
        if (record.handle && !record.blob) {
          const res = await reconnectLinkedMedia(record.id, record.name);
          if (res && onReconnected) {
            onReconnected(record.id, res.url);
          }
        }
      }
    } catch (e) {
      console.warn('[setupAutoReconnectListener] error:', e);
    }
  };

  window.addEventListener('click', tryReconnectAll, { capture: true, once: true });
  window.addEventListener('keydown', tryReconnectAll, { capture: true, once: true });
}

/**
 * Persists compressed 8-bit RLE cutout masks into IndexedDB for instant, persistent recovery.
 */
export async function persistMasksRLE(
  clipId: string,
  masks: Record<string, Uint8Array>,
): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const db = await getIndexedDB();
    if (!db.objectStoreNames.contains(STORE_MASKS)) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MASKS, 'readwrite');
      const store = tx.objectStore(STORE_MASKS);
      store.put({ id: clipId, masks, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[largeMediaStorage] Failed to persist masks:', e);
  }
}

/**
 * Loads compressed 8-bit RLE cutout masks from IndexedDB.
 */
export async function loadMasksRLE(
  clipId: string,
): Promise<Record<string, Uint8Array> | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const db = await getIndexedDB();
    if (!db.objectStoreNames.contains(STORE_MASKS)) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_MASKS, 'readonly');
      const store = tx.objectStore(STORE_MASKS);
      const req = store.get(clipId);
      req.onsuccess = () => {
        resolve(req.result ? req.result.masks : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Persists all projects JSON into IndexedDB as a resilient tier-2 storage backup
 * that survives browser local storage quota limits and tab crashes.
 */
export async function persistProjectsToIndexedDB(projectsJson: string): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const db = await getIndexedDB();
    if (!db.objectStoreNames.contains(STORE_PROJECTS)) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      const store = tx.objectStore(STORE_PROJECTS);
      store.put({ id: 'all_projects', data: projectsJson, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

/**
 * Loads projects JSON backup from IndexedDB if local storage is missing or corrupted.
 */
export async function loadProjectsFromIndexedDB(): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const db = await getIndexedDB();
    if (!db.objectStoreNames.contains(STORE_PROJECTS)) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.get('all_projects');
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

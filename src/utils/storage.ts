// Universal Multi-Platform Storage and Persistence Engine (TypeScript)
// Seamless persistent data support across Web (localStorage) and Mobile (expo-file-system)
import { Platform } from 'react-native';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import {
  createDefaultProject,
  computeTotalDuration,
  FastArtProject,
  AspectRatio,
  Resolution,
  FPS,
} from '../types/project';

// Storage keys
export const PROJECTS_STORAGE_KEY = '@fastart_projects_v2';
export const LEGACY_PROJECTS_KEY = '@fastart_projects_v1';
export const SETTINGS_STORAGE_KEY = '@fastart_settings_v1';
export const NOTIFICATIONS_STORAGE_KEY = '@fastart_notifications_v1';
export const LAST_SESSION_STORAGE_KEY = '@fastart_last_session_v2';
export const UPLOADED_MEDIA_KEY = '@fastart_uploaded_media_v2';
export const UPLOADED_AUDIO_KEY = '@fastart_uploaded_audio_v2';
export const CAPTION_SETTINGS_KEY = '@fastart_caption_settings_v1';

// In-memory cache for synchronous instant lookups
let memoryStore: Record<string, string> = {};
let isStorageInitialized = Platform.OS === 'web';
let syncTimer: any = null;

// Determine native documents directory safely
const getNativeFilePath = (): string | null => {
  if (Platform.OS === 'web') return null;
  try {
    const dir = FileSystemLegacy.documentDirectory;
    if (dir) {
      return `${dir}fastart_persistent_store_v2.json`;
    }
  } catch (e) {
    // Ignore in unsupported environments
  }
  return null;
};

// Schedule debounced background write to mobile native flash storage
const scheduleNativeDiskSync = () => {
  if (Platform.OS === 'web') return;
  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(async () => {
    const targetFile = getNativeFilePath();
    if (!targetFile) return;

    try {
      const payload = JSON.stringify(memoryStore);
      await FileSystemLegacy.writeAsStringAsync(targetFile, payload);
    } catch (err) {
      console.warn('FastArt native storage disk sync error:', err);
    }
  }, 150);
};

// Initialize mobile native storage from disk on app start
export const initNativeStorageAsync = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    isStorageInitialized = true;
    return true;
  }

  const targetFile = getNativeFilePath();
  if (!targetFile) {
    isStorageInitialized = true;
    return true;
  }

  try {
    const fileInfo = await FileSystemLegacy.getInfoAsync(targetFile);
    if (fileInfo.exists) {
      const raw = await FileSystemLegacy.readAsStringAsync(targetFile);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // Merge disk data into memory store
          memoryStore = { ...parsed, ...memoryStore };
        }
      }
    }
  } catch (err) {
    console.warn('FastArt native disk load warning:', err);
  } finally {
    isStorageInitialized = true;
  }

  return true;
};

// Low-level synchronous get
export const getStorageItem = (key: string): string | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) {
        memoryStore[key] = val;
        return val;
      }
    }
    return memoryStore[key] ?? null;
  } catch (e) {
    return memoryStore[key] ?? null;
  }
};

// Low-level synchronous set
export const setStorageItem = (key: string, value: string): void => {
  try {
    memoryStore[key] = value;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    if (Platform.OS !== 'web') {
      scheduleNativeDiskSync();
    }
  } catch (e) {
    // Graceful fallback for quota exceeded or storage disabled
    memoryStore[key] = value;
  }
};

// Low-level synchronous remove
export const removeStorageItem = (key: string): void => {
  try {
    delete memoryStore[key];
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    if (Platform.OS !== 'web') {
      scheduleNativeDiskSync();
    }
  } catch (e) {}
};

// --- Last Edit Session Persistence ---
export interface LastEditSession {
  projectId: string;
  currentTime: number;
  zoom?: number;
  selectedClipId?: string | null;
  updatedAt: number;
}

export const loadLastSession = (): LastEditSession | null => {
  try {
    const raw = getStorageItem(LAST_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.projectId) {
        return parsed;
      }
    }
  } catch (e) {}
  return null;
};

export const saveLastSession = (session: LastEditSession): void => {
  try {
    setStorageItem(LAST_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {}
};

// Sanitize project to guarantee all tracks and properties are defined
const sanitizeProject = (proj: any): FastArtProject => {
  const tracks = proj.tracks || {};
  return {
    ...proj,
    id: proj.id || 'proj-' + Date.now(),
    title: proj.title || 'Untitled Project',
    aspectRatio: proj.aspectRatio || '9:16',
    canvasBackground: proj.canvasBackground || '#000000',
    resolution: proj.resolution || '1080p',
    fps: proj.fps || 30,
    currentTime: typeof proj.currentTime === 'number' ? proj.currentTime : 0,
    zoom: typeof proj.zoom === 'number' ? proj.zoom : 60,
    thumbnailUrl: proj.thumbnailUrl || (tracks.video?.[0]?.thumbnailUrl || tracks.video?.[0]?.url),
    createdAt: proj.createdAt || Date.now(),
    updatedAt: proj.updatedAt || Date.now(),
    tracks: {
      video: Array.isArray(tracks.video) ? tracks.video : [],
      audio: Array.isArray(tracks.audio) ? tracks.audio : [],
      text: Array.isArray(tracks.text) ? tracks.text.filter((c: any) => !c.id?.startsWith('cap-')) : [],
      captions: Array.isArray(tracks.captions)
        ? tracks.captions
        : Array.isArray(tracks.text)
          ? tracks.text.filter((c: any) => c.id?.startsWith('cap-'))
          : [],
      stickers: Array.isArray(tracks.stickers) ? tracks.stickers : [],
      effects: Array.isArray(tracks.effects) ? tracks.effects : [],
      filters: Array.isArray(tracks.filters) ? tracks.filters : [],
    },
  };
};

// --- Projects Persistence ---
export const loadAllProjects = (): FastArtProject[] => {
  try {
    // 1. Try modern storage key
    let raw = getStorageItem(PROJECTS_STORAGE_KEY);

    // 2. Fallback to legacy key if needed
    if (!raw) {
      const legacyRaw = getStorageItem(LEGACY_PROJECTS_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
        // Migrate to v2
        setStorageItem(PROJECTS_STORAGE_KEY, legacyRaw);
      }
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (parsed.length > 0) {
          return parsed.map(sanitizeProject);
        }
        // User explicitly deleted all projects, return empty list
        return [];
      }
    }
  } catch (err) {
    console.warn('Error loading projects:', err);
  }

  // Only create default project if storage is fully ready and truly no projects exist
  if (isStorageInitialized) {
    const initial = [createDefaultProject('Project 1')];
    saveAllProjects(initial);
    return initial;
  }

  return [];
};

export const saveAllProjects = (projects: FastArtProject[]): void => {
  try {
    const sanitized = projects.map(sanitizeProject);
    setStorageItem(PROJECTS_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('Error saving projects:', err);
  }
};

export const saveProject = (project: FastArtProject): FastArtProject => {
  const projects = loadAllProjects();
  const idx = projects.findIndex((p) => p.id === project.id);

  // Recalculate duration & auto thumbnail if available
  const sanitized = sanitizeProject(project);
  const updated: FastArtProject = {
    ...sanitized,
    updatedAt: Date.now(),
  };

  if (idx >= 0) {
    projects[idx] = updated;
  } else {
    projects.unshift(updated);
  }

  saveAllProjects(projects);

  // Auto-record as last active session
  saveLastSession({
    projectId: updated.id,
    currentTime: updated.currentTime || 0,
    zoom: updated.zoom || 60,
    updatedAt: Date.now(),
  });

  return updated;
};

export const deleteProject = (projectId: string): FastArtProject[] => {
  const projects = loadAllProjects();
  const filtered = projects.filter((p) => p.id !== projectId);
  saveAllProjects(filtered);

  // Update last session if deleted project was active
  const lastSession = loadLastSession();
  if (lastSession && lastSession.projectId === projectId) {
    if (filtered.length > 0) {
      saveLastSession({
        projectId: filtered[0].id,
        currentTime: filtered[0].currentTime || 0,
        zoom: filtered[0].zoom || 60,
        updatedAt: Date.now(),
      });
    } else {
      removeStorageItem(LAST_SESSION_STORAGE_KEY);
    }
  }

  return filtered;
};

// --- Uploaded Media & Audio Persistence ---
export const loadUploadedMedia = (): any[] => {
  try {
    const raw = getStorageItem(UPLOADED_MEDIA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
};

export const saveUploadedMedia = (items: any[]): void => {
  try {
    setStorageItem(UPLOADED_MEDIA_KEY, JSON.stringify(items));
  } catch (e) {}
};

export const deleteUploadedMedia = (id: string): any[] => {
  const list = loadUploadedMedia().filter((item) => item.id !== id);
  saveUploadedMedia(list);
  return list;
};

export const loadUploadedAudio = (): any[] => {
  try {
    const raw = getStorageItem(UPLOADED_AUDIO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
};

export const saveUploadedAudio = (items: any[]): void => {
  try {
    setStorageItem(UPLOADED_AUDIO_KEY, JSON.stringify(items));
  } catch (e) {}
};

export const deleteUploadedAudio = (id: string): any[] => {
  const list = loadUploadedAudio().filter((item) => item.id !== id);
  saveUploadedAudio(list);
  return list;
};

// --- Settings ---
export interface AppSettings {
  defaultResolution: Resolution;
  defaultFps: FPS;
  defaultAspectRatio: AspectRatio;
  autoAddEnding: boolean;
  magneticSnapping: boolean;
  hapticFeedback: boolean;
  soundEffects: boolean;
  hardwareAcceleration: boolean;
  cachedSizeMb: number;
  language: string;
}

export const defaultSettings: AppSettings = {
  defaultResolution: '1080p',
  defaultFps: 30,
  defaultAspectRatio: '9:16',
  autoAddEnding: false,
  magneticSnapping: true,
  hapticFeedback: true,
  soundEffects: false,
  hardwareAcceleration: true,
  cachedSizeMb: 142.8,
  language: 'English (US)',
};

export const loadSettings = (): AppSettings => {
  try {
    const raw = getStorageItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      return { ...defaultSettings, ...JSON.parse(raw) };
    }
  } catch (e) {}
  return defaultSettings;
};

export const saveSettings = (settings: Partial<AppSettings>): AppSettings => {
  try {
    const current = loadSettings();
    const updated = { ...current, ...settings };
    setStorageItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return defaultSettings;
  }
};

export const clearAppCache = (): number => {
  try {
    saveSettings({ cachedSizeMb: 0.0 });
  } catch (e) {}
  return 0.0;
};

// --- Caption Style Settings Persistence ---
export interface CaptionSettings {
  presetId?: string;
  enableHighlight: boolean;
  highlightColor: string;
  highlightStyle: 'color' | 'box' | 'scale' | 'glow' | 'underline';
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  backgroundColor: string;
  textEffect: string;
  animation: string;
  positionY: number;
  textAlign: 'center' | 'left' | 'right';
  uppercase: boolean;
  maxWordsPerCue: number;
  chunkMode: 'punchy' | 'balanced' | 'sentence';
}

export const defaultCaptionSettings: CaptionSettings = {
  presetId: 'custom',
  enableHighlight: true,
  highlightColor: '#FFE600',
  highlightStyle: 'color',
  fontSize: 26,
  fontFamily: 'Impact, Arial Black, sans-serif',
  fontWeight: '900',
  textColor: '#FFE600',
  strokeColor: '#000000',
  strokeWidth: 4,
  backgroundColor: 'transparent',
  textEffect: '3d',
  animation: 'bounce',
  positionY: 82,
  textAlign: 'center',
  uppercase: true,
  maxWordsPerCue: 3,
  chunkMode: 'punchy',
};

export const loadCaptionSettings = (): CaptionSettings => {
  try {
    const raw = getStorageItem(CAPTION_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...defaultCaptionSettings, ...parsed };
      }
    }
  } catch (e) {}
  return defaultCaptionSettings;
};

export const saveCaptionSettings = (settings: Partial<CaptionSettings>): CaptionSettings => {
  try {
    const current = loadCaptionSettings();
    const updated = { ...current, ...settings };
    setStorageItem(CAPTION_SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    return defaultCaptionSettings;
  }
};

// --- Notifications ---
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  body?: string;
  description?: string;
  timestamp: string;
  createdAt: number;
  unread: boolean;
  projectId?: string;
  projectTitle?: string;
  actionText?: string;
  actionType?: 'open_project' | 'navigate' | string;
  icon?: string;
}

export const formatNotificationTime = (timestamp: number | string): string => {
  const time = typeof timestamp === 'number' ? timestamp : Date.now();
  const diffSec = Math.floor((Date.now() - time) / 1000);
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(time).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// No hardcoded fake promo notifications; notifications reflect real project events
export const defaultNotifications: AppNotification[] = [];

export const loadNotifications = (): AppNotification[] => {
  try {
    const raw = getStorageItem(NOTIFICATIONS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Strip out old hardcoded dummy notifications
        const cleaned = parsed
          .filter(
            (n: any) =>
              n &&
              n.id !== 'notif-1' &&
              n.id !== 'notif-2' &&
              n.id !== 'notif-3' &&
              !n.title?.includes('Viral Phonk') &&
              !n.title?.includes('New Shaders') &&
              !n.title?.includes('Welcome to FastArt Pro')
          )
          .map((n: any) => ({
            id: n.id || 'notif-' + Date.now(),
            title: n.title || 'Notification',
            message: n.message || n.body || n.description || '',
            body: n.message || n.body || n.description || '',
            description: n.message || n.body || n.description || '',
            timestamp:
              n.timestamp ||
              (n.createdAt ? formatNotificationTime(n.createdAt) : 'Recently'),
            createdAt: typeof n.createdAt === 'number' ? n.createdAt : Date.now(),
            unread: n.unread !== false,
            projectId: n.projectId,
            projectTitle: n.projectTitle,
            actionText: n.actionText || (n.projectId ? 'Open Project' : undefined),
            actionType: n.actionType || (n.projectId ? 'open_project' : undefined),
            icon: n.icon || (n.projectId ? 'videocam' : 'notifications-outline'),
          }));

        if (cleaned.length !== parsed.length) {
          saveNotifications(cleaned);
        }
        return cleaned;
      }
    }
  } catch (e) {}

  return defaultNotifications;
};

export const saveNotifications = (notifs: AppNotification[]): void => {
  try {
    setStorageItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifs));
  } catch (e) {}
};

export const addNotification = (
  notif: Partial<AppNotification> & { title: string; message?: string; body?: string }
): AppNotification => {
  const current = loadNotifications();
  const now = Date.now();
  const msg = notif.message || notif.body || notif.description || '';
  const newNotif: AppNotification = {
    id: notif.id || 'notif-' + now + '-' + Math.random().toString(36).substring(2, 7),
    title: notif.title,
    message: msg,
    body: msg,
    description: msg,
    timestamp: notif.timestamp || formatNotificationTime(now),
    createdAt: notif.createdAt || now,
    unread: notif.unread !== undefined ? notif.unread : true,
    projectId: notif.projectId,
    projectTitle: notif.projectTitle,
    actionText: notif.actionText || (notif.projectId ? 'Open Project' : undefined),
    actionType: notif.actionType || (notif.projectId ? 'open_project' : undefined),
    icon: notif.icon || (notif.projectId ? 'videocam' : 'notifications-outline'),
  };

  const updated = [newNotif, ...current].slice(0, 50);
  saveNotifications(updated);

  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.dispatchEvent === 'function' &&
    typeof CustomEvent !== 'undefined'
  ) {
    try {
      window.dispatchEvent(
        new CustomEvent('fastart:notification_added', { detail: newNotif })
      );
    } catch (_) {}
  }

  return newNotif;
};

export const deleteNotification = (id: string): AppNotification[] => {
  const current = loadNotifications().filter((n) => n.id !== id);
  saveNotifications(current);
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof window.dispatchEvent === 'function' &&
    typeof CustomEvent !== 'undefined'
  ) {
    try {
      window.dispatchEvent(
        new CustomEvent('fastart:notifications_changed', { detail: current })
      );
    } catch (_) {}
  }
  return current;
};

// --- Clean Export / Backup & Import All App Data ---
export interface FastArtBackupData {
  version: string;
  exportedAt: number;
  projects: FastArtProject[];
  settings: AppSettings;
  notifications: AppNotification[];
  uploadedMedia: any[];
  uploadedAudio: any[];
  lastSession: LastEditSession | null;
}

export const exportAllAppData = (): string => {
  const backup: FastArtBackupData = {
    version: '2.0.0',
    exportedAt: Date.now(),
    projects: loadAllProjects(),
    settings: loadSettings(),
    notifications: loadNotifications(),
    uploadedMedia: loadUploadedMedia(),
    uploadedAudio: loadUploadedAudio(),
    lastSession: loadLastSession(),
  };
  return JSON.stringify(backup, null, 2);
};

export const importAllAppData = (jsonStr: string): boolean => {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') return false;

    if (Array.isArray(data.projects)) {
      saveAllProjects(data.projects);
    }
    if (data.settings && typeof data.settings === 'object') {
      saveSettings(data.settings);
    }
    if (Array.isArray(data.notifications)) {
      saveNotifications(data.notifications);
    }
    if (Array.isArray(data.uploadedMedia)) {
      saveUploadedMedia(data.uploadedMedia);
    }
    if (Array.isArray(data.uploadedAudio)) {
      saveUploadedAudio(data.uploadedAudio);
    }
    if (data.lastSession && typeof data.lastSession === 'object') {
      saveLastSession(data.lastSession);
    }
    return true;
  } catch (err) {
    console.error('FastArt data import error:', err);
    return false;
  }
};

export const resetAllAppData = (): void => {
  try {
    removeStorageItem(PROJECTS_STORAGE_KEY);
    removeStorageItem(LEGACY_PROJECTS_KEY);
    removeStorageItem(SETTINGS_STORAGE_KEY);
    removeStorageItem(NOTIFICATIONS_STORAGE_KEY);
    removeStorageItem(LAST_SESSION_STORAGE_KEY);
    removeStorageItem(UPLOADED_MEDIA_KEY);
    removeStorageItem(UPLOADED_AUDIO_KEY);
    memoryStore = {};
    if (Platform.OS !== 'web') {
      scheduleNativeDiskSync();
    }
  } catch (e) {}
};

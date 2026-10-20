// Local Storage, Project Persistence, Settings, and Notifications (TypeScript)
import { createDefaultProject, FastArtProject, AspectRatio, Resolution, FPS } from '../types/project';

const PROJECTS_STORAGE_KEY = '@fastart_projects_v2';
const SETTINGS_STORAGE_KEY = '@fastart_settings_v1';
const NOTIFICATIONS_STORAGE_KEY = '@fastart_notifications_v1';

let memoryStore: Record<string, string> = {};

const getStorageItem = (key: string): string | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStore[key] || null;
  } catch (e) {
    return memoryStore[key] || null;
  }
};

const setStorageItem = (key: string, value: string): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    memoryStore[key] = value;
  } catch (e) {
    memoryStore[key] = value;
  }
};

// --- Projects ---
export const loadAllProjects = (): FastArtProject[] => {
  try {
    const raw = getStorageItem(PROJECTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error loading projects:', err);
  }
  const initial = [createDefaultProject('Project 1')];
  saveAllProjects(initial);
  return initial;
};

export const saveAllProjects = (projects: FastArtProject[]): void => {
  try {
    setStorageItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.warn('Error saving projects:', err);
  }
};

export const saveProject = (project: FastArtProject): FastArtProject => {
  const projects = loadAllProjects();
  const idx = projects.findIndex((p) => p.id === project.id);
  const updated = { ...project, updatedAt: Date.now() };
  if (idx >= 0) {
    projects[idx] = updated;
  } else {
    projects.unshift(updated);
  }
  saveAllProjects(projects);
  return updated;
};

export const deleteProject = (projectId: string): FastArtProject[] => {
  const projects = loadAllProjects();
  const filtered = projects.filter((p) => p.id !== projectId);
  saveAllProjects(filtered);
  return filtered;
};

// --- Settings ---
export interface AppSettings {
  defaultResolution: Resolution;
  defaultFps: FPS;
  defaultAspectRatio: AspectRatio;
  autoAddEnding: boolean;
  magneticSnapping: boolean;
  hapticFeedback: boolean;
  hardwareAcceleration: boolean;
  cachedSizeMb: number;
  language: string;
}

const defaultSettings: AppSettings = {
  defaultResolution: '1080p',
  defaultFps: 30,
  defaultAspectRatio: '9:16',
  autoAddEnding: false,
  magneticSnapping: true,
  hapticFeedback: true,
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

export const saveSettings = (settings: AppSettings): void => {
  try {
    setStorageItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {}
};

// --- Notifications ---
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  type: 'system' | 'creative' | 'update' | string;
  unread: boolean;
}

const defaultNotifications: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'Welcome to FastArt Pro 🚀',
    body: 'Hardware-accelerated video editing with real-time LUT filters & non-linear speed ramping is now active.',
    timestamp: 'Just now',
    type: 'system',
    unread: true,
  },
  {
    id: 'notif-2',
    title: 'Viral Phonk & Lo-Fi Beats Added 🎵',
    body: 'Fresh royalty-free audio tracks and sound effects have been added to your audio studio.',
    timestamp: '1 hour ago',
    type: 'creative',
    unread: true,
  },
  {
    id: 'notif-3',
    title: 'New Shaders: Glitch & VHS 90s ✨',
    body: 'Updated 60 FPS real-time WebGL video shader effects are available in the Effects tab.',
    timestamp: 'Yesterday',
    type: 'update',
    unread: false,
  },
];

export const loadNotifications = (): AppNotification[] => {
  try {
    const raw = getStorageItem(NOTIFICATIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  saveNotifications(defaultNotifications);
  return defaultNotifications;
};

export const saveNotifications = (notifs: AppNotification[]): void => {
  try {
    setStorageItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifs));
  } catch (e) {}
};

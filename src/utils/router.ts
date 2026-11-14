// FastArt URL Router & Navigation System
// Supports Web (HTML5 History pushState / popstate & Hash fallback) and Mobile (React Native)

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

export interface RouteState {
  screen: 'home' | 'editor' | 'settings' | 'notifications' | 'export' | 'not-found';
  projectKey?: string;
  tool?: string | null;
  path: string;
}

/**
 * Returns the base path of the application (e.g. '/fastart' on GitHub Pages, or '' locally).
 */
export function getBasePath(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return '';
  }

  // 1. Check build-time inlined EXPO_BASE_URL environment variable
  const envBase = (process.env.EXPO_BASE_URL || '').trim().replace(/\/+$/, '');
  if (envBase) {
    return envBase.startsWith('/') ? envBase : `/${envBase}`;
  }

  // 2. Base tag in HTML head if present
  if (typeof document !== 'undefined') {
    const baseTag = document.querySelector('base[href]');
    if (baseTag) {
      const href = baseTag.getAttribute('href') || '';
      try {
        const parsed = new URL(href, window.location.origin);
        const path = parsed.pathname.replace(/\/+$/, '');
        if (path) return path;
      } catch (e) {}
    }
  }

  // 3. GitHub Pages detection or fallback
  const pathname = window.location.pathname || '';
  if (/^\/fastart(?:\/|$)/i.test(pathname)) {
    return '/fastart';
  }

  // 4. Any GitHub Pages repository subpath (e.g. username.github.io/repo-name/...)
  if (
    typeof window.location.hostname === 'string' &&
    window.location.hostname.endsWith('github.io')
  ) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      return `/${segments[0]}`;
    }
  }

  return '';
}

/**
 * Strips base path prefix (e.g. '/fastart') from a pathname or URL so router works with clean app routes.
 */
export function stripBasePath(path: string, basePath?: string): string {
  if (!path || typeof path !== 'string') return '/';
  const base = (basePath ?? getBasePath()).replace(/\/+$/, '');
  if (!base || base === '/') return path;

  let cleaned = path;
  // If full URL was passed, strip origin first
  if (cleaned.includes('://')) {
    cleaned = cleaned.replace(/^[a-zA-Z]+:\/\/[^/]+/, '') || '/';
  }

  const baseLower = base.toLowerCase();
  const pathLower = cleaned.toLowerCase();

  // Exact match: /fastart or /fastart/ -> /
  if (pathLower === baseLower || pathLower === `${baseLower}/`) {
    return '/';
  }

  // Subpath match: /fastart/project/123 -> /project/123
  if (pathLower.startsWith(`${baseLower}/`)) {
    return cleaned.substring(base.length);
  }

  // Query or Hash: /fastart?tool=... -> /?tool=...
  if (pathLower.startsWith(`${baseLower}?`) || pathLower.startsWith(`${baseLower}#`)) {
    return `/${cleaned.substring(base.length)}`;
  }

  return cleaned;
}

/**
 * Prepends base path (e.g. '/fastart') to an app-relative path for browser history pushState / replaceState.
 */
export function withBasePath(path: string, basePath?: string): string {
  if (!path) return '/';
  const base = (basePath ?? getBasePath()).replace(/\/+$/, '');
  if (!base || base === '/') return path;

  const baseLower = base.toLowerCase();
  const pathLower = path.toLowerCase();

  // If already prefixed with base, return as-is
  if (
    pathLower === baseLower ||
    pathLower.startsWith(`${baseLower}/`) ||
    pathLower.startsWith(`${baseLower}?`) ||
    pathLower.startsWith(`${baseLower}#`)
  ) {
    return path;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Resolves a public static asset URL (like WASM binaries or ONNX models) accounting for base path.
 */
export function resolveAssetUrl(relativePath: string): string {
  const base = getBasePath();
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  const fullPath = `${base}${cleanPath}`;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    try {
      return new URL(fullPath, window.location.origin).toString();
    } catch (e) {
      return fullPath;
    }
  }
  return fullPath;
}

// In-memory navigation state (tracks route on mobile & web)
function getInitialLocation(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const raw =
      (window.location.pathname || '/') +
      (window.location.search || '') +
      (window.location.hash || '');
    return stripBasePath(raw);
  }
  return '/';
}

let currentPath: string = getInitialLocation();
const historyStack: string[] = [currentPath];

// Parse a path or URL string into RouteState
export function parseRoute(targetPath?: string): RouteState {
  let effective = targetPath ?? (Platform.OS === 'web' ? getInitialLocation() : currentPath);
  if (!effective || typeof effective !== 'string') {
    effective = '/';
  }

  // Strip protocol and domain if full URL was passed (e.g. http://localhost:8081/settings)
  let raw = effective;
  if (raw.includes('://')) {
    raw = raw.replace(/^[a-zA-Z]+:\/\/[^/]+/, '') || '/';
  }

  // Strip base path (e.g. /fastart)
  raw = stripBasePath(raw);

  // Extract hash
  let hash = '';
  const hashIdx = raw.indexOf('#');
  if (hashIdx !== -1) {
    hash = raw.substring(hashIdx);
    raw = raw.substring(0, hashIdx);
  }

  // Extract query string
  let search = '';
  const qIdx = raw.indexOf('?');
  if (qIdx !== -1) {
    search = raw.substring(qIdx);
    raw = raw.substring(0, qIdx);
  }

  let effectivePath = raw || '/';
  let effectiveSearch = search;

  // Support hash routing (e.g., /#/settings, /#/project/1)
  if (hash && (hash.startsWith('#/') || hash.startsWith('#!/'))) {
    const rawHash = hash.replace(/^#[!]?/, '');
    const [hPath, hQuery] = rawHash.split('?');
    effectivePath = hPath || '/';
    if (hQuery) effectiveSearch = '?' + hQuery;
  }

  // Support SPA redirect queries (e.g. ?/project/1 or ?p=/project/1)
  if (effectiveSearch) {
    if (effectiveSearch.startsWith('?/')) {
      const queryPath = effectiveSearch.slice(1).split('&')[0];
      if (queryPath) effectivePath = queryPath;
    } else {
      try {
        if (typeof URLSearchParams !== 'undefined') {
          const params = new URLSearchParams(effectiveSearch);
          const pRoute = params.get('p') || params.get('route') || params.get('path');
          if (pRoute) effectivePath = pRoute;
        }
      } catch (_e) {}
    }
  }

  // Parse search params for tool/modal query
  let toolFromQuery: string | null = null;
  if (effectiveSearch) {
    try {
      if (typeof URLSearchParams !== 'undefined') {
        const params = new URLSearchParams(effectiveSearch);
        toolFromQuery = params.get('tool') || params.get('modal') || params.get('panel') || null;
      } else {
        const match = effectiveSearch.match(/[?&](?:tool|modal|panel)=([^&#]+)/);
        if (match) toolFromQuery = decodeURIComponent(match[1]);
      }
    } catch (e) {
      // Ignore URLSearchParams error
    }
  }

  // Normalise path (trim trailing slash except root)
  const cleanPath = effectivePath === '/' ? '/' : effectivePath.replace(/\/+$/, '');

  // 1. Settings page: /settings or /setting
  if (cleanPath === '/settings' || cleanPath === '/setting') {
    return { screen: 'settings', path: cleanPath, tool: toolFromQuery };
  }

  // 2. Notifications page: /notifications or /notification
  if (cleanPath === '/notifications' || cleanPath === '/notification') {
    return { screen: 'notifications', path: cleanPath, tool: toolFromQuery };
  }

  // 3. Standalone Export: /export
  if (cleanPath === '/export') {
    return { screen: 'export', path: cleanPath, tool: 'export' };
  }

  // 4. Project with key: /project/:key or /editor/:key
  // e.g. /project/1, /project/proj-1774..., /project/new, /project/1/export
  const projectMatch = cleanPath.match(
    /^\/(?:project|editor)\/([^/?#]+)(?:\/(export|settings|media))?$/i
  );
  if (projectMatch) {
    const projectKey = decodeURIComponent(projectMatch[1]);
    const subRoute = projectMatch[2];
    const activeTool = subRoute || toolFromQuery;
    return {
      screen: 'editor',
      projectKey,
      tool: activeTool,
      path: cleanPath,
    };
  }

  // 5. Query param project: /?project=1 or /project?id=1
  if (cleanPath === '/' || cleanPath === '/project' || cleanPath === '/editor') {
    if (effectiveSearch) {
      try {
        let pKey: string | null = null;
        if (typeof URLSearchParams !== 'undefined') {
          const params = new URLSearchParams(effectiveSearch);
          pKey = params.get('project') || params.get('id') || params.get('key');
        } else {
          const match = effectiveSearch.match(/[?&](?:project|id|key)=([^&#]+)/);
          if (match) pKey = decodeURIComponent(match[1]);
        }
        if (pKey) {
          return {
            screen: 'editor',
            projectKey: pKey,
            tool: toolFromQuery,
            path: `/project/${pKey}`,
          };
        }
      } catch (_e) {}
    }
  }

  // 6. Home / Dashboard: / or /home or /projects
  if (
    cleanPath === '' ||
    cleanPath === '/' ||
    cleanPath === '/home' ||
    cleanPath === '/projects'
  ) {
    return { screen: 'home', path: '/', tool: toolFromQuery };
  }

  // Fallback: check if the first segment looks like a project id (e.g., /proj-1234)
  const singleSegmentMatch = cleanPath.match(/^\/([a-zA-Z0-9_-]+)$/);
  if (
    singleSegmentMatch &&
    (singleSegmentMatch[1].startsWith('proj-') || singleSegmentMatch[1] === 'new')
  ) {
    return {
      screen: 'editor',
      projectKey: singleSegmentMatch[1],
      tool: toolFromQuery,
      path: cleanPath,
    };
  }

  // Default to home
  return { screen: 'home', path: cleanPath, tool: toolFromQuery };
}

// Route listener manager for subscriptions
type RouteListener = (route: RouteState) => void;

class RouteListenerManager {
  private items: RouteListener[] = [];

  add(listener: RouteListener) {
    if (typeof listener === 'function' && !this.items.includes(listener)) {
      this.items.push(listener);
    }
    return this;
  }

  delete(listener: RouteListener) {
    const idx = this.items.indexOf(listener);
    if (idx !== -1) {
      this.items.splice(idx, 1);
      return true;
    }
    return false;
  }

  forEach(callback: (listener: RouteListener) => void) {
    [...this.items].forEach((listener) => {
      try {
        callback(listener);
      } catch (err) {
        console.warn('Router listener error:', err);
      }
    });
  }
}

const listeners = new RouteListenerManager();

let currentRouteState: RouteState = parseRoute(currentPath);

export function getRoute(): RouteState {
  return currentRouteState;
}

export function parseCurrentRoute(): RouteState {
  return parseRoute(currentPath);
}

// Navigate to a new path or route (works on Mobile and Web)
export function navigateTo(targetPath: string, options?: { replace?: boolean }) {
  const appPath = stripBasePath(targetPath);
  const browserPath = withBasePath(appPath);

  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.history &&
    typeof window.history.pushState === 'function'
  ) {
    try {
      if (options?.replace && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', browserPath);
      } else {
        window.history.pushState(null, '', browserPath);
      }
    } catch (e) {
      console.warn('Navigation history error:', e);
    }
  }

  // Update in-memory route state for mobile & web
  currentPath = appPath;
  if (options?.replace) {
    if (historyStack.length > 0) {
      historyStack[historyStack.length - 1] = appPath;
    } else {
      historyStack.push(appPath);
    }
  } else {
    historyStack.push(appPath);
  }

  const nextRoute = parseRoute(appPath);
  currentRouteState = nextRoute;
  listeners.forEach((listener) => listener(nextRoute));
}

// Go back or fallback to home (works on Mobile and Web)
export function navigateBack() {
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.history &&
    typeof window.history.back === 'function' &&
    window.history.length > 1
  ) {
    window.history.back();
    return;
  }

  // Mobile / in-memory history stack back navigation
  if (historyStack.length > 1) {
    historyStack.pop(); // remove current
    const prevPath = historyStack[historyStack.length - 1] || '/';
    currentPath = prevPath;
    const nextRoute = parseRoute(prevPath);
    currentRouteState = nextRoute;
    listeners.forEach((listener) => listener(nextRoute));
  } else {
    navigateTo('/', { replace: true });
  }
}

// React Hook for URL and routing
export function useAppRouter() {
  const [route, setRoute] = useState<RouteState>(() => parseRoute(currentPath));

  useEffect(() => {
    const handleChange = (newRoute: RouteState) => {
      setRoute(newRoute);
    };

    listeners.add(handleChange);

    // Browser back / forward buttons (Web only)
    const handlePopState = () => {
      if (typeof window !== 'undefined' && window.location) {
        const url =
          (window.location.pathname || '/') +
          (window.location.search || '') +
          (window.location.hash || '');
        const appUrl = stripBasePath(url);
        currentPath = appUrl;
        const updated = parseRoute(appUrl);
        currentRouteState = updated;
        setRoute(updated);
        listeners.forEach((l) => l(updated));
      }
    };

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('popstate', handlePopState);
      window.addEventListener('hashchange', handlePopState);
    }

    return () => {
      listeners.delete(handleChange);
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        typeof window.removeEventListener === 'function'
      ) {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('hashchange', handlePopState);
      }
    };
  }, []);

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    navigateTo(path, options);
  }, []);

  const goBack = useCallback(() => {
    navigateBack();
  }, []);

  return { route, navigate, goBack };
}

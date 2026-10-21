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

// In-memory navigation state (tracks route on mobile & web)
function getInitialLocation(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return (
      (window.location.pathname || '/') +
      (window.location.search || '') +
      (window.location.hash || '')
    );
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
      } catch (e) {}
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
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.history &&
    typeof window.history.pushState === 'function'
  ) {
    try {
      if (options?.replace && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', targetPath);
      } else {
        window.history.pushState(null, '', targetPath);
      }
    } catch (e) {
      console.warn('Navigation history error:', e);
    }
  }

  // Update in-memory route state for mobile & web
  currentPath = targetPath;
  if (options?.replace) {
    if (historyStack.length > 0) {
      historyStack[historyStack.length - 1] = targetPath;
    } else {
      historyStack.push(targetPath);
    }
  } else {
    historyStack.push(targetPath);
  }

  const nextRoute = parseRoute(targetPath);
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
    // Initial check
    const initial = parseRoute(currentPath);
    setRoute(initial);
    currentRouteState = initial;

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
        currentPath = url;
        const updated = parseRoute(url);
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

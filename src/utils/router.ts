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

// Extract path, hash, and search from browser window or fallback
function getBrowserLocation(): { pathname: string; search: string; hash: string } {
  if (typeof window !== 'undefined' && window.location) {
    return {
      pathname: window.location.pathname || '/',
      search: window.location.search || '',
      hash: window.location.hash || '',
    };
  }
  return { pathname: '/', search: '', hash: '' };
}

// Parse current URL into RouteState
export function parseCurrentRoute(): RouteState {
  const { pathname, search, hash } = getBrowserLocation();

  // Support hash routing (e.g., /#/settings, /#/project/1) as well as pathname routing (/settings, /project/1)
  let effectivePath = pathname;
  let effectiveSearch = search;

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
      const params = new URLSearchParams(effectiveSearch);
      toolFromQuery = params.get('tool') || params.get('modal') || params.get('panel') || null;
    } catch (e) {
      // Ignore URLSearchParams error on legacy env
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
  const projectMatch = cleanPath.match(/^\/(?:project|editor)\/([^/?#]+)(?:\/(export|settings|media))?$/i);
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
        const params = new URLSearchParams(effectiveSearch);
        const pKey = params.get('project') || params.get('id') || params.get('key');
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
  if (cleanPath === '' || cleanPath === '/' || cleanPath === '/home' || cleanPath === '/projects') {
    return { screen: 'home', path: '/', tool: toolFromQuery };
  }

  // Fallback: check if the first segment looks like a project id (e.g., /proj-1234)
  const singleSegmentMatch = cleanPath.match(/^\/([a-zA-Z0-9_-]+)$/);
  if (singleSegmentMatch && (singleSegmentMatch[1].startsWith('proj-') || singleSegmentMatch[1] === 'new')) {
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

// Listeners for route changes
type RouteListener = (route: RouteState) => void;
const listeners = new Set<RouteListener>();

let currentRouteState: RouteState = parseCurrentRoute();

export function getRoute(): RouteState {
  return currentRouteState;
}

// Navigate to a new path or route
export function navigateTo(targetPath: string, options?: { replace?: boolean }) {
  if (typeof window !== 'undefined' && window.history) {
    try {
      if (options?.replace) {
        window.history.replaceState(null, '', targetPath);
      } else {
        window.history.pushState(null, '', targetPath);
      }
    } catch (e) {
      console.warn('Navigation history error:', e);
    }
  }

  const nextRoute = parseCurrentRoute();
  currentRouteState = nextRoute;
  listeners.forEach((listener) => listener(nextRoute));
}

// Go back or fallback to home
export function navigateBack() {
  if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
    window.history.back();
  } else {
    navigateTo('/');
  }
}

// React Hook for URL and routing
export function useAppRouter() {
  const [route, setRoute] = useState<RouteState>(() => parseCurrentRoute());

  useEffect(() => {
    // Initial check
    const initial = parseCurrentRoute();
    setRoute(initial);
    currentRouteState = initial;

    const handleChange = (newRoute: RouteState) => {
      setRoute(newRoute);
    };

    listeners.add(handleChange);

    // Browser back / forward buttons
    const handlePopState = () => {
      const updated = parseCurrentRoute();
      currentRouteState = updated;
      setRoute(updated);
      listeners.forEach((l) => l(updated));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', handlePopState);
      window.addEventListener('hashchange', handlePopState);
    }

    return () => {
      listeners.delete(handleChange);
      if (typeof window !== 'undefined') {
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

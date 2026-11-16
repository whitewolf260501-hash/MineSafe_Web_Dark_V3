export type AppRoute = 'landing' | 'login' | 'panel';

export interface ParsedAppRoute {
  route: AppRoute;
  sectionId?: string;
}

const LANDING_SECTIONS = new Set([
  'inicio',
  'producto',
  'como-funciona',
  'quienes-somos',
  'contacto',
]);

export function parseAppRoute(pathname: string, hash: string): ParsedAppRoute {
  const cleanHash = (hash || '').trim();
  const normalizedHash = cleanHash.startsWith('#') ? cleanHash.slice(1) : cleanHash;
  const hashLower = normalizedHash.toLowerCase();

  if (hashLower === '/acceso' || hashLower === 'acceso') {
    return { route: 'login' };
  }
  if (hashLower === '/panel' || hashLower === 'panel') {
    return { route: 'panel' };
  }
  if (hashLower === '/' || hashLower === '') {
    // Fall through to inspect pathname unless hash explicitly pointed to a route
  } else if (LANDING_SECTIONS.has(hashLower)) {
    return { route: 'landing', sectionId: hashLower };
  } else if (hashLower.startsWith('/')) {
    const cleanHashPath = hashLower.replace(/\/+$/, '');
    if (cleanHashPath === '/acceso') return { route: 'login' };
    if (cleanHashPath === '/panel') return { route: 'panel' };
  }

  const cleanPath = (pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
  if (cleanPath === '/acceso' || cleanPath.endsWith('/acceso')) {
    return { route: 'login' };
  }
  if (cleanPath === '/panel' || cleanPath.endsWith('/panel')) {
    return { route: 'panel' };
  }

  return { route: 'landing' };
}

export function shouldUseHashRouting(pathname: string, hash: string): boolean {
  if (hash.startsWith('#/')) return true;
  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/';
  if (cleanPath === '/' || cleanPath === '/acceso' || cleanPath === '/panel') {
    return false;
  }
  // Subpath static deployments (e.g., GitHub Pages /repo-name/) or file://
  return true;
}

export function buildAppUrl(
  route: AppRoute,
  options?: { useHash?: boolean; sectionId?: string }
): string {
  const useHash = Boolean(options?.useHash);
  if (useHash) {
    if (route === 'login') return '#/acceso';
    if (route === 'panel') return '#/panel';
    if (options?.sectionId && LANDING_SECTIONS.has(options.sectionId)) {
      return `#${options.sectionId}`;
    }
    return '#/';
  }

  if (route === 'login') return '/acceso';
  if (route === 'panel') return '/panel';
  if (options?.sectionId && LANDING_SECTIONS.has(options.sectionId)) {
    return `/#${options.sectionId}`;
  }
  return '/';
}

export function navigateToAppRoute(
  route: AppRoute,
  options?: { replace?: boolean; sectionId?: string }
): void {
  if (typeof window === 'undefined') return;
  const useHash = shouldUseHashRouting(window.location.pathname, window.location.hash);
  const nextUrl = buildAppUrl(route, { useHash, sectionId: options?.sectionId });

  if (useHash) {
    if (options?.replace) {
      window.history.replaceState(null, '', nextUrl);
    } else {
      window.location.hash = nextUrl;
    }
  } else {
    const currentFull = `${window.location.pathname}${window.location.hash}`;
    if (currentFull !== nextUrl) {
      if (options?.replace) {
        window.history.replaceState(null, '', nextUrl);
      } else {
        window.history.pushState(null, '', nextUrl);
      }
    }
  }

  if (route === 'landing' && options?.sectionId) {
    const target = document.getElementById(options.sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

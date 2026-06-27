const DEFAULT_SITE_ORIGIN = 'https://the-engineering-journal.mdtaju.tech';
const DEFAULT_LOCAL_BACKEND_ORIGIN = 'https://the-engineering-journal.onrender.com';

function clean(value = '') {
  return String(value || '').trim();
}

function trimTrailingSlashes(value = '') {
  return clean(value).replace(/\/+$/, '');
}

function trimLeadingSlashes(value = '') {
  return clean(value).replace(/^\/+/, '');
}

function stripApiSuffix(value = '') {
  return trimTrailingSlashes(value).replace(/\/api$/, '');
}

function isAbsoluteHttpUrl(value = '') {
  return /^https?:\/\//i.test(clean(value));
}

export const SITE_ORIGIN = trimTrailingSlashes(
  process.env.NEXT_PUBLIC_SITE_ORIGIN || DEFAULT_SITE_ORIGIN
);

export const BACKEND_ORIGIN = trimTrailingSlashes(
  process.env.BACKEND_ORIGIN ||
    process.env.NEXT_PUBLIC_API_ORIGIN ||
    (process.env.NODE_ENV === 'development' ? DEFAULT_LOCAL_BACKEND_ORIGIN : SITE_ORIGIN)
);

export const API_BASE = trimTrailingSlashes(process.env.NEXT_PUBLIC_API_BASE || '/api') || '/api';

export const SERVER_API_BASE =
  trimTrailingSlashes(
    process.env.BACKEND_API_BASE ||
      (isAbsoluteHttpUrl(process.env.NEXT_PUBLIC_API_BASE) ? process.env.NEXT_PUBLIC_API_BASE : '') ||
      `${BACKEND_ORIGIN}/api`
  ) || `${BACKEND_ORIGIN}/api`;

export function buildApiUrl(path: string, params?: URLSearchParams) {
  const normalizedPath = trimLeadingSlashes(path);
  const query = params && params.toString() ? `?${params.toString()}` : '';
  return `${API_BASE}/${normalizedPath}${query}`;
}

export function buildServerApiUrl(path: string, params?: URLSearchParams) {
  const normalizedPath = trimLeadingSlashes(path);
  const query = params && params.toString() ? `?${params.toString()}` : '';
  return `${SERVER_API_BASE}/${normalizedPath}${query}`;
}

export function buildWebSocketUrl(path: string, explicitUrl = '') {
  if (explicitUrl) return explicitUrl;

  const normalizedPath = `/${trimLeadingSlashes(path)}`;
  const configuredOrigin =
    process.env.NEXT_PUBLIC_WS_ORIGIN ||
    process.env.NEXT_PUBLIC_API_ORIGIN ||
    (process.env.NODE_ENV === 'development' ? DEFAULT_LOCAL_BACKEND_ORIGIN : '');

  if (configuredOrigin) {
    try {
      const [pathname, search = ''] = normalizedPath.split('?');
      const url = new URL(stripApiSuffix(configuredOrigin));
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = pathname;
      url.search = search ? `?${search}` : '';
      url.hash = '';
      return url.toString();
    } catch {
      return '';
    }
  }

  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${normalizedPath}`;
}

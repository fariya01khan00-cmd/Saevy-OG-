const rawEnvApiUrl =
  typeof import.meta.env?.VITE_API_URL === 'string'
    ? import.meta.env.VITE_API_URL.trim()
    : '';

export const API_URL = (rawEnvApiUrl || '').replace(/\/+$/, '');

function extractNormalizedPath(pathOrUrl) {
  if (typeof pathOrUrl !== 'string' || !pathOrUrl.trim()) {
    return '/';
  }
  const trimmed = pathOrUrl.trim();
  if (API_URL && trimmed.startsWith(API_URL)) {
    const rest = trimmed.slice(API_URL.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return '/';
    }
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function isLocalhostTarget(urlStr) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(urlStr);
}

/**
 * Builds the full endpoint URL from API_URL (`import.meta.env.VITE_API_URL`).
 * Defaults to same-origin relative `/api/...` when VITE_API_URL is unset.
 */
export function buildApiUrl(path) {
  const normalizedPath = extractNormalizedPath(path);
  if (!API_URL) {
    return normalizedPath;
  }
  const onHostedOrigin =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  if (onHostedOrigin && isLocalhostTarget(API_URL)) {
    return normalizedPath;
  }
  return `${API_URL}${normalizedPath}`;
}

export const getApiEndpoint = buildApiUrl;

/**
 * Fetches against the configured API endpoint with fallback to same-origin.
 */
export async function apiFetch(pathOrUrl, options) {
  const normalizedPath = extractNormalizedPath(pathOrUrl);
  const targetUrl = buildApiUrl(normalizedPath);

  if (targetUrl !== normalizedPath) {
    try {
      return await fetch(targetUrl, options);
    } catch {
      return fetch(normalizedPath, options);
    }
  }

  return fetch(normalizedPath, options);
}

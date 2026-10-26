import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';

const REFRESH_KEY = 'cc.refreshToken';

/**
 * Small fetch wrapper.
 * - Access token is kept only in memory.
 * - Refresh token is kept in the device keychain/keystore (expo-secure-store).
 * - On a 401 it refreshes once and retries; if that fails the session ends.
 */
let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

// Where secure storage is unavailable (e.g. web preview) the refresh token is
// kept in memory only, so the user signs in again after a reload.
let memoryRefresh: string | null = null;

export const tokenStore = {
  setAccess: (t: string | null) => {
    accessToken = t;
  },
  getRefresh: async () => {
    try {
      return await SecureStore.getItemAsync(REFRESH_KEY);
    } catch {
      return memoryRefresh;
    }
  },
  setRefresh: async (t: string) => {
    try {
      await SecureStore.setItemAsync(REFRESH_KEY, t);
    } catch {
      memoryRefresh = t;
    }
  },
  clear: async () => {
    accessToken = null;
    memoryRefresh = null;
    try {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    } catch {
      // nothing stored
    }
  },
  onExpired: (fn: () => void) => {
    onSessionExpired = fn;
  },
};

async function refresh(): Promise<boolean> {
  const rt = await tokenStore.getRefresh();
  if (!rt) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return false;
    const body = await res.json();
    accessToken = body.accessToken;
    await tokenStore.setRefresh(body.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/** Restores a session at app start using the stored refresh token. */
export async function restoreSession(): Promise<boolean> {
  return refresh();
}

type Query = Record<string, string | number | boolean | undefined | null>;

export async function request<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  opts: { body?: unknown; query?: Query; auth?: boolean } = {},
  retried = false,
): Promise<T> {
  const qs = opts.query
    ? '?' +
      Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs === '?' ? '' : qs}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(opts.auth !== false && accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'We could not reach CareCompass. Check your internet connection and try again.');
  }

  if (res.status === 401 && opts.auth !== false && !retried) {
    refreshing = refreshing ?? refresh().finally(() => (refreshing = null));
    if (await refreshing) return request<T>(method, path, opts, true);
    onSessionExpired?.();
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Something went wrong.', body?.error?.details);
  }
  return body as T;
}

export const api = {
  get: <T = any>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T = any>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} }),
  put: <T = any>(path: string, body: unknown) => request<T>('PUT', path, { body }),
  patch: <T = any>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  del: <T = any>(path: string, body?: unknown) => request<T>('DELETE', path, { body }),
  publicGet: <T = any>(path: string, query?: Query) => request<T>('GET', path, { query, auth: false }),
  publicPost: <T = any>(path: string, body: unknown) => request<T>('POST', path, { body, auth: false }),
};

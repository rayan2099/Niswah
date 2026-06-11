import { createClient } from '@supabase/supabase-js';

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const configuredSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(configuredSupabaseUrl && configuredSupabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('Supabase configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

const supabaseUrl = configuredSupabaseUrl || 'https://supabase-not-configured.invalid';
const supabaseAnonKey = configuredSupabaseAnonKey || 'supabase-not-configured';

const cookieChunkSize = 3000;
const cookieMaxAge = 60 * 60 * 24 * 30;

const cookieNameFor = (key: string) => `niswah_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

const setCookie = (name: string, value: string, maxAge = cookieMaxAge) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
};

const getCookie = (name: string) => {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const match = document.cookie
    .split('; ')
    .find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
};

const removeCookie = (name: string) => setCookie(name, '', 0);

const writeCookieChunks = (key: string, value: string) => {
  const baseName = cookieNameFor(key);
  const previousCount = Number(getCookie(`${baseName}_chunks`) || '0');
  const chunks = Math.ceil(value.length / cookieChunkSize);

  setCookie(`${baseName}_chunks`, String(chunks));
  for (let i = 0; i < chunks; i += 1) {
    setCookie(`${baseName}_${i}`, value.slice(i * cookieChunkSize, (i + 1) * cookieChunkSize));
  }
  for (let i = chunks; i < previousCount; i += 1) {
    removeCookie(`${baseName}_${i}`);
  }
};

const readCookieChunks = (key: string) => {
  const baseName = cookieNameFor(key);
  const chunks = Number(getCookie(`${baseName}_chunks`) || '0');
  if (!chunks) return null;

  let value = '';
  for (let i = 0; i < chunks; i += 1) {
    const chunk = getCookie(`${baseName}_${i}`);
    if (chunk === null) return null;
    value += chunk;
  }
  return value;
};

const removeCookieChunks = (key: string) => {
  const baseName = cookieNameFor(key);
  const chunks = Number(getCookie(`${baseName}_chunks`) || '0');
  for (let i = 0; i < chunks; i += 1) {
    removeCookie(`${baseName}_${i}`);
  }
  removeCookie(`${baseName}_chunks`);
};

const durableAuthStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;

    try {
      const localValue = window.localStorage.getItem(key);
      if (localValue) {
        writeCookieChunks(key, localValue);
        return localValue;
      }
    } catch {
      // Fall back to cookies below.
    }

    const cookieValue = readCookieChunks(key);
    if (cookieValue) {
      try {
        window.localStorage.setItem(key, cookieValue);
      } catch {
        // Cookies still carry the session for this load.
      }
    }
    return cookieValue;
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Cookie mirror remains available when localStorage is restricted.
    }
    writeCookieChunks(key, value);
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Keep cleanup best-effort.
    }
    removeCookieChunks(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: durableAuthStorage,
  },
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
  },
});

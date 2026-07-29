const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const base = apiBaseUrl || (() => {
  const host = import.meta.env.VITE_API_HOST || window.location.hostname;
  const port = import.meta.env.VITE_API_PORT || '7900';
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.');
  const scheme = isLocal ? 'http' : 'https';
  return `${scheme}://${host}:${port}`;
})();

export const AUTH_API_BASE = `${base}${import.meta.env.VITE_API_AUTH_PATH || '/api/auth'}`;
export const GAME_API_BASE = `${base}${import.meta.env.VITE_API_GAME_PATH || '/api/game'}`;

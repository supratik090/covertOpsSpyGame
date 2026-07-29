const host = import.meta.env.VITE_API_HOST || window.location.hostname;
const port = import.meta.env.VITE_API_PORT || '7900';
const base = `http://${host}:${port}`;

export const AUTH_API_BASE = `${base}${import.meta.env.VITE_API_AUTH_PATH || '/api/auth'}`;
export const GAME_API_BASE = `${base}${import.meta.env.VITE_API_GAME_PATH || '/api/game'}`;

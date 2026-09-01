import { GAME_API_BASE } from '../config';
import { fetchWithRetry } from './api';

export async function fetchLeaderboard() {
  try {
    const res = await fetchWithRetry(`${GAME_API_BASE}/scores/leaderboard`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch leaderboard:', err);
    return [];
  }
}

export async function fetchMyScores() {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('spy_game_token') : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetchWithRetry(`${GAME_API_BASE}/scores/me`, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch user scores:', err);
    return null;
  }
}

export async function fetchSessionScore(sessionId) {
  try {
    const res = await fetchWithRetry(`${GAME_API_BASE}/scores/session/${sessionId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch session score:', err);
    return null;
  }
}

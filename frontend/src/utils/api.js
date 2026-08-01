const MAX_RETRIES = 10;
const RETRY_DELAY = 2000;

export async function fetchWithRetry(input, init = {}, onRetry = null) {
  let lastError;

  const token = localStorage.getItem('spy_game_token');
  if (token) {
    if (!init.headers) {
      init.headers = {};
    }
    init.headers['Authorization'] = `Bearer ${token}`;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok) return res;

      if (res.status === 401) {
        localStorage.removeItem('spy_game_token');
        localStorage.removeItem('covert_ops_operator_user');
        localStorage.removeItem('spy_game_session_id');
        window.dispatchEvent(new Event('unauthorized_logout'));
        const err = new Error(`HTTP 401: Unauthorized`);
        err.status = 401;
        throw err;
      }

      lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      if (err.status === 401) {
        throw err;
      }
      lastError = err;
    }

    if (attempt < MAX_RETRIES) {
      if (onRetry) onRetry(attempt + 1, MAX_RETRIES);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
  }

  throw lastError;
}

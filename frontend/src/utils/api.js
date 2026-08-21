const MAX_RETRIES = 2;
const RETRY_DELAY = 300;

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

      // Fast-fail 4xx client errors (400, 403, 404, 409, etc.) without 20s retry loop
      if (res.status >= 400 && res.status < 500) {
        let errText = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const body = await res.json();
          if (body && body.message) errText = body.message;
        } catch (e) {}
        const err = new Error(errText);
        err.status = res.status;
        throw err;
      }

      lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      if (err.status && err.status >= 400 && err.status < 500) {
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

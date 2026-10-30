import { Capacitor, registerPlugin } from '@capacitor/core';

export const CovertOpsNative = Capacitor.isNativePlatform()
  ? registerPlugin('CovertOps')
  : null;

// Initialize native bridge interceptor when running on native Android
if (typeof window !== 'undefined' && Capacitor.isNativePlatform() && CovertOpsNative) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (url.includes('/api/') || url.includes('/health')) {
      try {
        const method = init.method || 'GET';
        const body = init.body || null;
        let authHeader = '';
        if (init.headers) {
          if (init.headers instanceof Headers) {
            authHeader = init.headers.get('Authorization') || '';
          } else if (typeof init.headers === 'object') {
            authHeader = init.headers['Authorization'] || init.headers['authorization'] || '';
          }
        }
        if (!authHeader) {
          const token = localStorage.getItem('spy_game_token');
          if (token) authHeader = `Bearer ${token}`;
        }
        const res = await CovertOpsNative.executeRequest({
          url,
          method,
          body: typeof body === 'string' ? body : (body ? JSON.stringify(body) : null),
          authHeader
        });
        return new Response(res.json, {
          status: res.status || 200,
          statusText: res.status === 200 ? 'OK' : 'Error',
          headers: new Headers({ 'Content-Type': 'application/json' })
        });
      } catch (e) {
        console.error('Native CovertOps bridge error:', e);
        return new Response(JSON.stringify({ message: e.message || 'Native Bridge Error' }), {
          status: 500,
          headers: new Headers({ 'Content-Type': 'application/json' })
        });
      }
    }
    return originalFetch(input, init);
  };
}

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
        let errText = 'Invalid credentials';
        try {
          const body = await res.json();
          if (body && (body.message || body.error)) {
            errText = body.message || body.error;
          }
        } catch (e) {}

        if (token) {
          localStorage.removeItem('spy_game_token');
          localStorage.removeItem('covert_ops_operator_user');
          localStorage.removeItem('spy_game_session_id');
          window.dispatchEvent(new Event('unauthorized_logout'));
        }

        const err = new Error(errText);
        err.status = 401;
        throw err;
      }

      // Fast-fail 4xx client errors (400, 403, 404, 409, etc.) without retry loop
      if (res.status >= 400 && res.status < 500) {
        let errText = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const body = await res.json();
          if (body && (body.message || body.error)) errText = body.message || body.error;
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

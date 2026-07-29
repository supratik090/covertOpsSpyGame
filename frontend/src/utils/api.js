const MAX_RETRIES = 10;
const RETRY_DELAY = 2000;

export async function fetchWithRetry(input, init = {}, onRetry = null) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok) return res;

      lastError = new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < MAX_RETRIES) {
      if (onRetry) onRetry(attempt + 1, MAX_RETRIES);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
  }

  throw lastError;
}

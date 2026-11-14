import { API_BASE_URL } from './config';

let accessToken = null;
let refreshInFlight = null;
let nextRequestId = 0;
const activeRequests = new Map();
const apiActivityListeners = new Set();
let apiActivitySnapshot = { activeRequestCount: 0, loadingMessage: '' };

export function subscribeToApiActivity(listener) {
  apiActivityListeners.add(listener);
  return () => apiActivityListeners.delete(listener);
}

export function getApiActivitySnapshot() {
  return apiActivitySnapshot;
}

function publishApiActivity() {
  const messages = Array.from(activeRequests.values());
  apiActivitySnapshot = {
    activeRequestCount: messages.length,
    loadingMessage: messages[messages.length - 1] || ''
  };
  apiActivityListeners.forEach((listener) => listener());
}

function trackApiRequest(operation, loadingMessage = 'Processing your request…') {
  const requestId = ++nextRequestId;
  activeRequests.set(requestId, loadingMessage);
  publishApiActivity();

  return (async () => {
    try {
      return await operation();
    } finally {
      activeRequests.delete(requestId);
      publishApiActivity();
    }
  })();
}

export function withApiActivity(loadingMessage, operation) {
  return trackApiRequest(operation, loadingMessage);
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function setAccessToken(token) {
  accessToken = token;
}

async function send(path, options = {}, token = accessToken) {
  const { body, headers: requestHeaders, societyId, ...fetchOptions } = options;
  const headers = new Headers(requestHeaders);

  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (societyId) headers.set('X-Society-Id', societyId);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
    credentials: 'include',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  if (response.status === 204) return null;

  const responseText = await response.text();
  let responseBody = null;
  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = { error: { message: responseText } };
    }
  }

  if (!response.ok) {
    const error = responseBody?.error;
    throw new ApiError(
      error?.message || `The API request failed with status ${response.status}.`,
      response.status,
      error?.code
    );
  }

  return responseBody;
}

export function refreshSession(loadingMessage = 'Checking your session…') {
  return trackApiRequest(async () => {
    if (!refreshInFlight) {
      refreshInFlight = send('/auth/refresh', { method: 'POST' }, null)
        .then((response) => {
          setAccessToken(response.accessToken);
          return response;
        })
        .catch((error) => {
          setAccessToken(null);
          throw error;
        })
        .finally(() => {
          refreshInFlight = null;
        });
    }

    return refreshInFlight;
  }, loadingMessage);
}

export function apiRequest(path, options = {}) {
  const { auth, loadingMessage, ...requestOptions } = options;
  return trackApiRequest(async () => {
    const requiresAuth = auth !== false;
    try {
      return await send(path, requestOptions, requiresAuth ? accessToken : null);
    } catch (error) {
      if (!requiresAuth || error.status !== 401) throw error;

      await refreshSession();
      return send(path, requestOptions, accessToken);
    }
  }, loadingMessage);
}

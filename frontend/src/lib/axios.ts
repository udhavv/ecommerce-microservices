import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const AUTH_BASE_URL =
  process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:4000/api/auth';

export const authApiClient = axios.create({
  baseURL: AUTH_BASE_URL,
  withCredentials: true, // Enables browser to automatically send and store HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

// Response Interceptor: Silent token refresh via HTTP-only cookies
authApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!error.response || !originalRequest) {
      return Promise.reject(error);
    }

    const status = error.response.status;
    const url = originalRequest.url || '';

    // Do not attempt refresh on authentication initiation routes or /refresh itself
    const isAuthRoute =
      url.includes('/login') ||
      url.includes('/register') ||
      url.includes('/refresh') ||
      url.includes('/forgot-password') ||
      url.includes('/reset-password');

    if (status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => authApiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Send request to refresh endpoint. Browser automatically includes httpOnly refreshToken cookie.
        await axios.post(
          `${AUTH_BASE_URL}/refresh`,
          {},
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        processQueue(null);
        // Retry the original request; the browser will automatically include the newly refreshed httpOnly accessToken cookie
        return authApiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Extracts a user-friendly error message from Axios errors
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data) {
      if (typeof data.message === 'string') return data.message;
      if (typeof data.error === 'string') return data.error;
      if (Array.isArray(data.details) && data.details.length > 0) {
        return data.details.map((d: { message: string }) => d.message).join(', ');
      }
    }
    if (error.code === 'ERR_NETWORK') {
      return 'Cannot connect to authentication service. Please check your backend connection.';
    }
    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

export default authApiClient;

import axios, {
  AxiosError,
  AxiosInstance,
  CreateAxiosDefaults,
  InternalAxiosRequestConfig,
} from 'axios';

export const AUTH_BASE_URL =
  process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:4000/api/auth';

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

/**
 * Triggers a silent token refresh using the httpOnly refreshToken cookie.
 * Shared across all microservice API clients.
 */
export async function refreshAccessToken(): Promise<void> {
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
}

/**
 * Attaches the automatic 401 token refresh interceptor to any Axios instance.
 * When any request fails with 401 (token expired):
 * 1. Pauses other failing requests and queues them.
 * 2. Invokes /api/auth/refresh to renew the httpOnly accessToken cookie.
 * 3. Automatically retries the original request and all queued requests.
 * 4. Eliminates the need for manual page refreshes or relogins on expired tokens.
 */
export function attachAuthRefreshInterceptor(client: AxiosInstance): AxiosInstance {
  client.interceptors.response.use(
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

      // Skip refresh for auth initiation or refresh endpoints to prevent infinite loops
      const isAuthExempt =
        url.includes('/login') ||
        url.includes('/register') ||
        url.includes('/refresh') ||
        url.includes('/forgot-password') ||
        url.includes('/reset-password');

      if (status === 401 && !originalRequest._retry && !isAuthExempt) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(() => client(originalRequest))
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          await refreshAccessToken();
          processQueue(null);
          // Retry the original failed request with the newly issued httpOnly accessToken cookie
          return client(originalRequest);
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

  return client;
}

/**
 * Factory helper to create an Axios client with credentials and automatic 401 token refresh.
 */
export function createApiClient(config: CreateAxiosDefaults = {}): AxiosInstance {
  const client = axios.create({
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
    ...config,
  });

  return attachAuthRefreshInterceptor(client);
}

export const authApiClient = createApiClient({
  baseURL: AUTH_BASE_URL,
  timeout: 15000,
});

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
      return 'Cannot connect to backend service. Please check your connection or gateway.';
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

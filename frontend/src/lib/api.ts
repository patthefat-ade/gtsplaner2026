import axios from "axios";

/**
 * Pre-configured Axios instance for communicating with the Django backend.
 *
 * Authentication is handled via httpOnly cookies set by the backend.
 * The `withCredentials: true` flag ensures cookies are sent with every request.
 * No manual token management is needed on the client side.
 *
 * Token refresh is handled automatically on 401 responses by calling
 * the /auth/refresh/ endpoint (which reads the refresh token from its cookie).
 */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Response interceptor: handle 401 with silent token refresh via cookies
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(undefined);
    }
  });
  failedQueue = [];
};

/**
 * Auth-related endpoints that should NOT trigger the automatic token refresh.
 * These endpoints are called during auth flow itself, so retrying them
 * would cause infinite loops.
 */
const AUTH_SKIP_URLS = [
  "/auth/login",
  "/auth/refresh",
  "/auth/me",
  "/auth/logout",
  "/auth/2fa/login-verify",
];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if the URL matches any auth endpoint that should skip refresh
    const shouldSkipRefresh = AUTH_SKIP_URLS.some((url) =>
      originalRequest.url?.includes(url),
    );

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !shouldSkipRefresh &&
      typeof window !== "undefined"
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            // Retry with cookies (no manual header needed)
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Call refresh endpoint – it reads the refresh token from the httpOnly cookie
        // and sets new access + refresh cookies in the response
        await axios.post(
          `${api.defaults.baseURL}/auth/refresh/`,
          {},
          { withCredentials: true },
        );

        processQueue(null);
        // Retry original request – new cookies are automatically included
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);

        // Refresh failed – only redirect if not already on /login to prevent loops
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export { api };
export default api;

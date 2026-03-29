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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh for login and refresh endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/refresh") &&
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
        // Refresh failed – redirect to login
        window.location.href = "/login";
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

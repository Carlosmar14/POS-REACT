// frontend/src/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  headers: { "Content-Type": "application/json" },
});

let isRedirecting = false;
const resetRedirect = () => {
  setTimeout(() => {
    isRedirecting = false;
  }, 1000);
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pos_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const url = error.config?.url;

    // Evitar bucles de redirección
    if (isRedirecting) return Promise.reject(error);

    // Si es error de licencia (403 con licenseRequired)
    if (status === 403 && data?.licenseRequired) {
      if (!window.location.pathname.includes("/activacion")) {
        isRedirecting = true;
        localStorage.removeItem("pos_token");
        localStorage.removeItem("pos_user");
        window.location.href = "/activacion";
      }
      return Promise.reject(error);
    }

    // Si es error de autenticación (401)
    if (status === 401) {
      // No redirigir si la petición es /auth/me (evita bucles al restaurar sesión)
      if (url?.includes("/auth/me")) {
        return Promise.reject(error);
      }
      const path = window.location.pathname;
      if (!path.includes("/login") && !path.includes("/activacion")) {
        isRedirecting = true;
        localStorage.removeItem("pos_token");
        localStorage.removeItem("pos_user");
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

window.addEventListener("load", resetRedirect);
export default api;

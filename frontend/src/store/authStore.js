import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "../api";

export const useAuth = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: true,

      login: (data) => {
        const user = data.user || data;
        const token = data.accessToken || data.token;
        localStorage.setItem("pos_token", token);
        localStorage.setItem("pos_user", JSON.stringify(user));
        set({ user, token, isLoading: false });
      },

      logout: () => {
        localStorage.removeItem("pos_token");
        localStorage.removeItem("pos_user");
        set({ user: null, token: null, isLoading: false });
      },

      // Restaurar sesión al cargar la app
      initialize: async () => {
        const token = localStorage.getItem("pos_token");
        if (!token) {
          set({ isLoading: false });
          return;
        }
        try {
          const res = await api.get("/auth/me");
          const user = res.data.data.user;
          set({ user, token, isLoading: false });
        } catch {
          // Token inválido: limpiar
          localStorage.removeItem("pos_token");
          localStorage.removeItem("pos_user");
          set({ user: null, token: null, isLoading: false });
        }
      },
    }),
    {
      name: "pos_auth",
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
);

// Inicializar en el punto de entrada (main.jsx o App.jsx)
if (typeof window !== "undefined") {
  useAuth.getState().initialize();
}

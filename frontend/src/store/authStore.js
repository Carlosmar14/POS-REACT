// frontend/src/store/authStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuth = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (data) => {
        const user = data.user || data;
        const token = data.accessToken || data.token;

        set({
          user,
          token,
          isAuthenticated: true,
        });

        // También guardar en localStorage para el interceptor de axios
        if (token) {
          localStorage.setItem("pos_token", token);
        }
        if (user) {
          localStorage.setItem("pos_user", JSON.stringify(user));
        }
      },

      logout: () => {
        localStorage.removeItem("pos_token");
        localStorage.removeItem("pos_user");
        set({ user: null, token: null, isAuthenticated: false });
      },

      updateUser: (userData) => {
        set({ user: userData });
        localStorage.setItem("pos_user", JSON.stringify(userData));
      },

      // Verificar si el usuario tiene un rol específico
      hasRole: (role) => {
        const { user } = get();
        return user?.role === role;
      },

      // Verificar si el usuario tiene alguno de los roles permitidos
      hasAnyRole: (roles) => {
        const { user } = get();
        return roles.includes(user?.role);
      },
    }),
    {
      name: "pos_auth",
      getStorage: () => localStorage,
    },
  ),
);

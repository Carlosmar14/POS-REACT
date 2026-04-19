// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/authStore";
import Layout from "./components/Layout";
import { ConfigProvider } from "./context/ConfigContext";
import { useSessionTimeout } from "./hooks/useSessionTimeout";
import { useState, useEffect, useRef } from "react";
import api from "./api";
import { Loader2 } from "lucide-react";

// Páginas
import Activacion from "./pages/Activacion";
import Login from "./pages/Login";
import Caja from "./pages/Caja";
import Reportes from "./pages/Reportes";
import Productos from "./pages/Productos";
import Categorias from "./pages/Categorias";
import Usuarios from "./pages/Usuarios";
import Logs from "./pages/Logs";
import Stock from "./pages/Stock";
import Historial from "./pages/Historial";
import HistorialStock from "./pages/HistorialStock";
import Configuracion from "./pages/Configuracion";

// ✅ Componente que verifica licencia UNA SOLA VEZ al montar
const LicenseGuard = ({ children }) => {
  const [status, setStatus] = useState({ loading: true, valid: false });
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    (async () => {
      try {
        const res = await api.get("/license/status");
        setStatus({ loading: false, valid: res.data.data?.valid });
      } catch {
        setStatus({ loading: false, valid: false });
      }
    })();
  }, []);

  if (status.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  if (!status.valid) {
    return <Navigate to="/activacion" replace />;
  }

  return children;
};

// ✅ Protección por rol (ya incluye chequeo de usuario)
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    // Redirigir al dashboard por defecto según rol
    const defaultPath =
      user.role === "admin"
        ? "/reportes"
        : user.role === "warehouse"
          ? "/stock"
          : "/caja";
    return <Navigate to={defaultPath} replace />;
  }
  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  useSessionTimeout();

  return (
    <Routes>
      <Route path="/activacion" element={<Activacion />} />
      <Route
        path="/login"
        element={!user ? <Login /> : <Navigate to="/caja" replace />}
      />

      <Route path="/" element={<Layout />}>
        {/* Rutas protegidas por licencia (usando LicenseGuard) */}
        <Route
          path="caja"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["cashier", "admin"]}>
                <Caja />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="stock"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["warehouse", "admin"]}>
                <Stock />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="historial"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["cashier", "admin"]}>
                <Historial />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="historial-stock"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["warehouse", "admin"]}>
                <HistorialStock />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="reportes"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Reportes />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="productos"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Productos />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="categorias"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Categorias />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="usuarios"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Usuarios />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="logs"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Logs />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          path="configuracion"
          element={
            <LicenseGuard>
              <ProtectedRoute allowedRoles={["admin"]}>
                <Configuracion />
              </ProtectedRoute>
            </LicenseGuard>
          }
        />
        <Route
          index
          element={
            <Navigate
              to={
                user?.role === "admin"
                  ? "/reportes"
                  : user?.role === "warehouse"
                    ? "/stock"
                    : "/caja"
              }
              replace
            />
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/activacion" replace />} />
    </Routes>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function App() {
  return (
    <ConfigProvider>
      <AppContent />
    </ConfigProvider>
  );
}

export default App;

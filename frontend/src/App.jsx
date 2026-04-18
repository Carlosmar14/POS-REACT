// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/authStore";
import Layout from "./components/Layout";
import { ConfigProvider } from "./context/ConfigContext";
import { useSessionTimeout } from "./hooks/useSessionTimeout";
import { useState, useEffect } from "react";
import api from "./api";
import { Loader2, Shield, AlertTriangle } from "lucide-react";

// Páginas
import Activacion from "./pages/Activacion"; // ✅ NUEVO
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

// ✅ Componente para verificar licencia antes de mostrar rutas protegidas
const LicenseProtectedRoute = ({ children }) => {
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLicense = async () => {
      try {
        const res = await api.get("/license/status");
        setLicenseStatus(res.data.data);
      } catch (err) {
        console.error("Error verificando licencia:", err);
        setLicenseStatus({ valid: false, reason: "error" });
      } finally {
        setLoading(false);
      }
    };
    checkLicense();
  }, []);

  // Mientras carga
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-gray-600 dark:text-gray-400">
          Verificando licencia...
        </p>
      </div>
    );
  }

  // Si no tiene licencia válida, redirigir a activación
  if (!licenseStatus?.valid) {
    return <Navigate to="/activacion" replace />;
  }

  // Si tiene licencia válida, mostrar contenido
  return children;
};

// ✅ Componente para proteger rutas por rol
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [];

  if (roles.length > 0 && !roles.includes(user.role)) {
    if (user.role === "admin") return <Navigate to="/reportes" replace />;
    if (user.role === "warehouse") return <Navigate to="/stock" replace />;
    if (user.role === "cashier") return <Navigate to="/caja" replace />;
    return <Navigate to="/login" replace />;
  }
  return children;
};

// ✅ Componente que muestra info de licencia en desarrollo (opcional)
const LicenseBanner = () => {
  const [license, setLicense] = useState(null);

  useEffect(() => {
    const checkLicense = async () => {
      try {
        const res = await api.get("/license/status");
        if (res.data.data?.valid) {
          setLicense(res.data.data.data);
        }
      } catch {
        /* ignorar */
      }
    };
    checkLicense();
  }, []);

  if (!license || process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-2 right-2 z-50 bg-white dark:bg-gray-800 shadow-lg rounded-lg px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <Shield className="text-green-600" size={12} />
        <span className="text-gray-600 dark:text-gray-400">
          {license.customerName} · Vence: {license.endDate} · {license.daysLeft}{" "}
          días
        </span>
      </div>
    </div>
  );
};

// ✅ Componente interno que usa el hook de sesión
function AppRoutes() {
  const { user } = useAuth();

  // ✅ Activar monitoreo de inactividad
  useSessionTimeout();

  return (
    <>
      <Routes>
        {/* 🔓 RUTAS PÚBLICAS (SIN LICENCIA Y SIN LOGIN) */}

        {/* ✅ Activación de licencia - NO requiere login ni licencia */}
        <Route path="/activacion" element={<Activacion />} />

        {/* ✅ Login - NO requiere licencia */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/caja" replace />}
        />

        {/* 🔒 RUTAS PROTEGIDAS (REQUIEREN LICENCIA Y LOGIN) */}
        <Route
          path="/"
          element={
            <LicenseProtectedRoute>
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            </LicenseProtectedRoute>
          }
        >
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

          {/* ✅ Caja - Solo Cajero y Admin */}
          <Route
            path="caja"
            element={
              <ProtectedRoute allowedRoles={["cashier", "admin"]}>
                <Caja />
              </ProtectedRoute>
            }
          />

          {/* ✅ Stock - Solo Almacenero y Admin */}
          <Route
            path="stock"
            element={
              <ProtectedRoute allowedRoles={["warehouse", "admin"]}>
                <Stock />
              </ProtectedRoute>
            }
          />

          {/* ✅ Historial Ventas - Solo Cajero y Admin */}
          <Route
            path="historial"
            element={
              <ProtectedRoute allowedRoles={["cashier", "admin"]}>
                <Historial />
              </ProtectedRoute>
            }
          />

          {/* ✅ Historial Stock - Solo Almacenero y Admin */}
          <Route
            path="historial-stock"
            element={
              <ProtectedRoute allowedRoles={["warehouse", "admin"]}>
                <HistorialStock />
              </ProtectedRoute>
            }
          />

          {/* ✅ Reportes - Solo Admin */}
          <Route
            path="reportes"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Reportes />
              </ProtectedRoute>
            }
          />

          {/* ✅ Productos - Solo Admin */}
          <Route
            path="productos"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Productos />
              </ProtectedRoute>
            }
          />

          {/* ✅ Categorías - Solo Admin */}
          <Route
            path="categorias"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Categorias />
              </ProtectedRoute>
            }
          />

          {/* ✅ Usuarios - Solo Admin */}
          <Route
            path="usuarios"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Usuarios />
              </ProtectedRoute>
            }
          />

          {/* ✅ Logs - Solo Admin */}
          <Route
            path="logs"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Logs />
              </ProtectedRoute>
            }
          />

          {/* ✅ Configuración - Solo Admin */}
          <Route
            path="configuracion"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Configuracion />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* 🔄 Redirección por defecto */}
        <Route path="*" element={<Navigate to="/activacion" replace />} />
      </Routes>

      {/* ✅ Banner de licencia (solo visible en desarrollo) */}
      <LicenseBanner />
    </>
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

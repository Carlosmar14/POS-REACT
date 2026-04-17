// frontend/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./store/authStore";
import Layout from "./components/Layout";
import { ConfigProvider } from "./context/ConfigContext";
import { useSessionTimeout } from "./hooks/useSessionTimeout";

// Páginas
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

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  // ✅ Asegurar que allowedRoles es un array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [];

  if (roles.length > 0 && !roles.includes(user.role)) {
    if (user.role === "admin") return <Navigate to="/reportes" replace />;
    if (user.role === "warehouse") return <Navigate to="/stock" replace />;
    if (user.role === "cashier") return <Navigate to="/caja" replace />;
    return <Navigate to="/login" replace />;
  }
  return children;
};

// ✅ Componente interno que usa el hook de sesión
function AppRoutes() {
  const { user } = useAuth();

  // ✅ Activar monitoreo de inactividad
  useSessionTimeout();

  return (
    <Routes>
      {/* 🔓 Pública */}
      <Route
        path="/login"
        element={!user ? <Login /> : <Navigate to="/caja" replace />}
      />

      {/* 🔒 Protegidas */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
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

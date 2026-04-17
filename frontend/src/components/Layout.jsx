// frontend/src/components/Layout.jsx
import { NavLink, useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../store/authStore";
import { useStockNotifications } from "../hooks/useStockNotifications";
import { useTheme } from "../hooks/useTheme";
import { createPortal } from "react-dom";
import {
  ShoppingCart,
  BarChart3,
  Package,
  Tags,
  Users,
  FileText,
  LogOut,
  Menu,
  X,
  Store,
  Boxes,
  History,
  Bell,
  AlertTriangle,
  PackageOpen,
  Settings,
  RefreshCw,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const sidebarRef = useRef(null);
  const buttonRef = useRef(null);

  // Hook para el tema (modo oscuro)
  useTheme();

  const {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    reload,
  } = useStockNotifications(user);

  // Cerrar panel al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  // Cerrar menú móvil
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    if (mobileOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileOpen]);

  const goToProduct = (notification) => {
    setShowNotifications(false);
    markAsRead(notification.id);
    navigate("/stock");
  };

  // Menú según rol
  const navItems = (() => {
    if (user?.role === "warehouse") {
      return [
        { to: "/stock", icon: Boxes, label: "Stock" },
        { to: "/historial-stock", icon: History, label: "Historial Stock" },
      ];
    }
    if (user?.role === "cashier") {
      return [
        { to: "/caja", icon: ShoppingCart, label: "Punto de Ventas" },
        { to: "/historial", icon: History, label: "Historial" },
      ];
    }
    if (user?.role === "admin") {
      return [
        { to: "/caja", icon: ShoppingCart, label: "Punto de Venta" },
        { to: "/stock", icon: Boxes, label: "Stock" },
        { to: "/historial", icon: History, label: "Historial Ventas" },
        { to: "/historial-stock", icon: History, label: "Historial Stock" },
        { to: "/reportes", icon: BarChart3, label: "Reportes" },
        { to: "/productos", icon: Package, label: "Productos" },
        { to: "/categorias", icon: Tags, label: "Categorías" },
        { to: "/usuarios", icon: Users, label: "Usuarios" },
        { to: "/logs", icon: FileText, label: "Registros" },
        { to: "/configuracion", icon: Settings, label: "Configuración" },
      ];
    }
    return [];
  })();

  const title =
    navItems.find((n) => n.to === location.pathname)?.label || "POS System";

  const getNotificationColor = (type) => {
    switch (type) {
      case "danger":
        return "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800";
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800";
      default:
        return "bg-gray-50 dark:bg-gray-800/50";
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case "danger":
        return "text-red-500 dark:text-red-400";
      case "warning":
        return "text-yellow-500 dark:text-yellow-400";
      default:
        return "text-blue-500 dark:text-blue-400";
    }
  };

  // Panel de notificaciones renderizado con Portal
  const NotificationsPanel = () => {
    if (!showNotifications) return null;

    return createPortal(
      <div className="fixed top-16 right-4 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-[99999] overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell size={16} />
            Notificaciones
            {unreadCount > 0 && (
              <span className="bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 text-xs px-2 py-0.5 rounded-full">
                {unreadCount} nuevas
              </span>
            )}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={reload}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
              title="Actualizar"
            >
              <RefreshCw size={14} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Leer todas
              </button>
            )}
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
              Cargando...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">
              <Bell size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay notificaciones</p>
              <p className="text-xs">Stock normal</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => goToProduct(notification)}
                className={`p-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                  !notification.read ? "bg-blue-50/30 dark:bg-blue-900/20" : ""
                } ${getNotificationColor(notification.type)}`}
              >
                <div className="flex items-start gap-2">
                  <div className={`mt-0.5 ${getIconColor(notification.type)}`}>
                    {notification.type === "danger" ? (
                      <AlertTriangle size={16} />
                    ) : (
                      <PackageOpen size={16} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {notification.title}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {notification.message}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/80 text-center">
            <button
              onClick={() => {
                setShowNotifications(false);
                navigate("/stock");
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              Ir a inventario
            </button>
          </div>
        )}
      </div>,
      document.body,
    );
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden font-sans">
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Store className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              POS System
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-800"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white"
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 px-3 py-3 mb-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow">
              {user?.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-gray-900 dark:text-white">
                {user?.name || "Usuario"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user?.role === "admin"
                  ? "Administrador"
                  : user?.role === "warehouse"
                    ? "Almacenero"
                    : "Cajero"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-lg font-semibold truncate text-gray-900 dark:text-white">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              ref={buttonRef}
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* MENÚ MÓVIL */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Store className="text-blue-600" size={20} />
            <span className="font-bold text-gray-900 dark:text-white">
              POS System
            </span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 px-3 py-3 mb-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700">
            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {user?.name || "Usuario"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user?.role === "admin"
                  ? "Administrador"
                  : user?.role === "warehouse"
                    ? "Almacenero"
                    : "Cajero"}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              setMobileOpen(false);
              navigate("/login");
            }}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <NotificationsPanel />
    </div>
  );
}

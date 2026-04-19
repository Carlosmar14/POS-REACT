// frontend/src/pages/Configuracion.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/authStore";
import Swal from "sweetalert2";
import api from "../api";
import {
  Bell,
  Moon,
  Sun,
  Monitor,
  Database,
  Receipt,
  Save,
  RotateCcw,
  Shield,
  Printer as PrinterIcon,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Key,
  RefreshCw,
  Copy,
  X,
  Upload,
  Trash2,
} from "lucide-react";

// ✅ Función para aplicar el tema
const applyTheme = (theme) => {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else if (theme === "light") {
    document.documentElement.classList.remove("dark");
  } else if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }
};

// ✅ Configuración por defecto
const getDefaultSettings = () => ({
  notifications: {
    lowStockThreshold: 10,
    lowStockEnabled: true,
    outOfStockEnabled: true,
    soundEnabled: false,
    autoRefresh: 30,
  },
  appearance: {
    theme: "light",
    compactMode: false,
    showProductImages: true,
    itemsPerPage: 9,
  },
  invoice: {
    companyName: "CAFÉ UNIVERSAL",
    companyAddress: "Avda. Central, 4",
    companyPhone: "📞 555-123-456",
    companyEmail: "info@cafeuniversal.com",
    companyRuc: "C-91233456",
    footerMessage: "Muchas gracias por su visita",
    promoMessage:
      "Le recordamos que cada mañana ofrecemos desayuno té o café con croissant por 1,40 € o café, té con croissant y zumo por 1,60 €.",
    website: "www.cafeuniversal.com",
    logo: "",
    paperSize: "80mm",
    copies: 1,
    taxRate: 10,
    showTaxInfo: true,
  },
  security: {
    sessionTimeout: 30,
    autoLogout: true,
    requirePasswordForRefund: true,
    maxLoginAttempts: 3,
    twoFactorAuth: false,
  },
  system: {
    currency: "EUR",
    currencySymbol: "€",
    language: "es",
    dateFormat: "DD/MM/YYYY",
    timezone: "Europe/Madrid",
    decimalPlaces: 2,
    thousandsSeparator: ".",
  },
  printer: {
    printerType: "thermal",
    printerPort: "USB",
    printerModel: "Epson TM-T20",
    paperWidth: 80,
    autoCut: true,
  },
});

export default function Configuracion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [settings, setSettings] = useState(getDefaultSettings());
  const [activeTab, setActiveTab] = useState("notifications");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // ✅ Estados para modal de 2FA
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(1);
  const [qrCode, setQrCode] = useState(null);
  const [manualKey, setManualKey] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [user2FAEnabled, setUser2FAEnabled] = useState(false);

  // ✅ Verificar si el usuario es admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/caja");
    }
  }, [user, navigate]);

  // ✅ Cargar configuración desde BD y estado 2FA
  useEffect(() => {
    if (user && user.role === "admin") {
      loadConfiguracionFromBD();
      check2FAStatus();
    }
  }, [user]);

  // ✅ Auto-abrir modal de 2FA si viene el parámetro setup2fa=true
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("setup2fa") === "true" && user?.role === "admin") {
      open2FAModal();
      // Limpiar el parámetro de la URL sin recargar la página
      navigate("/configuracion", { replace: true });
    }
  }, [location, user]);

  const loadConfiguracionFromBD = async () => {
    try {
      setLoading(true);
      const response = await api.get("/configuracion");
      if (response.data.success && response.data.data) {
        const configData = response.data.data;
        const defaultSettings = getDefaultSettings();
        const safeConfig = {
          notifications: {
            ...defaultSettings.notifications,
            ...(configData.notifications || {}),
          },
          appearance: {
            ...defaultSettings.appearance,
            ...(configData.appearance || {}),
          },
          invoice: {
            ...defaultSettings.invoice,
            ...(configData.invoice || {}),
          },
          security: {
            ...defaultSettings.security,
            ...(configData.security || {}),
          },
          system: { ...defaultSettings.system, ...(configData.system || {}) },
          printer: {
            ...defaultSettings.printer,
            ...(configData.printer || {}),
          },
        };
        setSettings(safeConfig);
        applyTheme(safeConfig.appearance?.theme || "light");
      } else {
        setSettings(getDefaultSettings());
      }
    } catch (error) {
      console.error("❌ Error cargando configuración:", error);
      setSettings(getDefaultSettings());
    } finally {
      setLoading(false);
    }
  };

  const check2FAStatus = async () => {
    try {
      const res = await api.get("/auth/2fa/status");
      if (res.data.success) {
        const enabled = res.data.data?.enabled || false;
        setUser2FAEnabled(enabled);
        setSettings((prev) => ({
          ...prev,
          security: { ...prev.security, twoFactorAuth: enabled },
        }));
      }
    } catch (error) {
      console.error("❌ Error verificando estado 2FA:", error);
    }
  };

  const saveConfiguracionToBD = async () => {
    setSaving(true);
    try {
      const response = await api.post("/configuracion", settings);
      if (response.data.success) {
        applyTheme(settings.appearance.theme);
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "configuracion_actualizada",
            newValue: JSON.stringify({ timestamp: Date.now() }),
          }),
        );
        window.dispatchEvent(
          new CustomEvent("configUpdated", { detail: settings }),
        );
        Swal.fire({
          title: "✅ Configuración guardada",
          text: "Los cambios se han guardado en la base de datos",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error("❌ Error guardando en BD:", error);
      Swal.fire(
        "Error",
        "No se pudo guardar la configuración en la BD",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const resetConfiguracion = async () => {
    const result = await Swal.fire({
      title: "¿Resetear configuración?",
      text: "Se perderán todos los cambios personalizados",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, resetear",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        const response = await api.post("/configuracion/reset");
        if (response.data.success) {
          const defaultSettings = response.data.data || getDefaultSettings();
          setSettings(defaultSettings);
          applyTheme(defaultSettings.appearance?.theme || "light");
          window.dispatchEvent(
            new StorageEvent("storage", {
              key: "configuracion_actualizada",
              newValue: JSON.stringify({ timestamp: Date.now() }),
            }),
          );
          window.dispatchEvent(
            new CustomEvent("configUpdated", { detail: defaultSettings }),
          );
          Swal.fire(
            "Reset completado",
            "La configuración ha sido restaurada",
            "success",
          );
        }
      } catch (error) {
        console.error("Error resetando configuración:", error);
        Swal.fire("Error", "No se pudo resetear la configuración", "error");
      }
    }
  };

  // ============================================================================
  // 🔐 FUNCIONES 2FA
  // ============================================================================

  const open2FAModal = () => {
    setTwoFAStep(1);
    setVerificationCode("");
    setQrCode(null);
    setManualKey("");
    setShow2FAModal(true);
  };

  const load2FASetup = async () => {
    try {
      setTwoFALoading(true);
      const res = await api.get("/auth/2fa/setup");
      if (res.data.success) {
        setQrCode(res.data.data.qrCodeUrl);
        setManualKey(res.data.data.secret);
        setTwoFAStep(2);
      }
    } catch (err) {
      console.error("❌ Error cargando 2FA setup:", err);
      Swal.fire(
        "Error",
        err.response?.data?.message || "No se pudo cargar configuración 2FA",
        "error",
      );
    } finally {
      setTwoFALoading(false);
    }
  };

  const activate2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      return Swal.fire("Error", "Ingresa un código de 6 dígitos", "warning");
    }

    try {
      setTwoFALoading(true);
      const res = await api.post("/auth/2fa/verify", {
        token: verificationCode,
        secret: manualKey,
      });

      if (res.data.success) {
        setTwoFAStep(3);
        setUser2FAEnabled(true);

        const currentUser = JSON.parse(
          localStorage.getItem("pos_user") || "{}",
        );
        currentUser.twoFactorEnabled = true;
        localStorage.setItem("pos_user", JSON.stringify(currentUser));

        setSettings((prev) => ({
          ...prev,
          security: { ...prev.security, twoFactorAuth: true },
        }));

        // ✅ Eliminar token temporal después de activar 2FA
        localStorage.removeItem("temp_token");

        await saveConfiguracionToBD();
      }
    } catch (err) {
      console.error("❌ Error activando 2FA:", err);
      Swal.fire(
        "Error",
        err.response?.data?.message || "Código inválido",
        "error",
      );
      setVerificationCode("");
    } finally {
      setTwoFALoading(false);
    }
  };

  const deactivate2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      return Swal.fire(
        "Error",
        "Ingresa el código actual de tu app para confirmar",
        "warning",
      );
    }

    const { isConfirmed } = await Swal.fire({
      title: "¿Desactivar 2FA?",
      text: "Tu cuenta quedará protegida solo con contraseña",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, desactivar",
      confirmButtonColor: "#dc2626",
      cancelButtonText: "Cancelar",
    });

    if (!isConfirmed) return;

    try {
      setTwoFALoading(true);
      const res = await api.post("/auth/2fa/disable", {
        token: verificationCode,
      });

      if (res.data.success) {
        setUser2FAEnabled(false);

        const currentUser = JSON.parse(
          localStorage.getItem("pos_user") || "{}",
        );
        currentUser.twoFactorEnabled = false;
        localStorage.setItem("pos_user", JSON.stringify(currentUser));

        setSettings((prev) => ({
          ...prev,
          security: { ...prev.security, twoFactorAuth: false },
        }));

        await saveConfiguracionToBD();
        setShow2FAModal(false);
        setVerificationCode("");
        setTwoFAStep(1);

        Swal.fire(
          "🔓 Desactivado",
          "2FA ha sido desactivado correctamente",
          "success",
        );
      }
    } catch (err) {
      console.error("❌ Error desactivando 2FA:", err);
      Swal.fire(
        "Error",
        err.response?.data?.message || "No se pudo desactivar 2FA",
        "error",
      );
    } finally {
      setTwoFALoading(false);
    }
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code) ||
      document.execCommand("copy", false, code);
    Swal.fire({
      icon: "success",
      title: "Copiado",
      text: code,
      timer: 1000,
      showConfirmButton: false,
    });
  };

  const handle2FAInput = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setVerificationCode(value);
  };

  // ✅ Componente LicenciaInfo
  const LicenciaInfo = () => {
    const [license, setLicense] = useState(null);
    const [loadingLicense, setLoadingLicense] = useState(true);

    useEffect(() => {
      loadLicenseInfo();
    }, []);

    const loadLicenseInfo = async () => {
      try {
        const res = await api.get("/license/status");
        if (res.data.success) {
          setLicense(res.data.data);
        }
      } catch (err) {
        console.error("Error cargando licencia:", err);
      } finally {
        setLoadingLicense(false);
      }
    };

    if (loadingLicense) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="animate-spin text-blue-600" size={20} />
          <span className="ml-2 text-gray-500">Cargando licencia...</span>
        </div>
      );
    }

    if (!license?.valid) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-red-600" size={18} />
            <span className="font-medium text-red-700 dark:text-red-400">
              No hay licencia activa
            </span>
          </div>
          <p className="text-sm text-red-600 dark:text-red-300">
            {license?.message || "El sistema no tiene una licencia válida."}
          </p>
        </div>
      );
    }

    const licenseData = license.data;
    const daysLeft = licenseData.daysLeft || 0;
    const totalDays =
      licenseData.totalDays ||
      Math.ceil(
        (new Date(licenseData.endDate) - new Date(licenseData.startDate)) /
          (1000 * 60 * 60 * 24),
      );
    const progressPercent = Math.min(
      100,
      Math.max(0, ((totalDays - daysLeft) / totalDays) * 100),
    );

    let progressColor = "bg-green-500";
    let statusColor = "text-green-600 dark:text-green-400";
    let statusText = "Activa";

    if (daysLeft <= 7) {
      progressColor = "bg-red-500";
      statusColor = "text-red-600 dark:text-red-400";
      statusText = "Por expirar";
    } else if (daysLeft <= 30) {
      progressColor = "bg-yellow-500";
      statusColor = "text-yellow-600 dark:text-yellow-400";
      statusText = "Próxima a vencer";
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Cliente</p>
            <p className="font-semibold text-gray-900 dark:text-white">
              {licenseData.customerName}
            </p>
          </div>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor} bg-opacity-10 bg-current`}
          >
            {statusText}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Fecha de inicio
            </p>
            <p className="font-medium text-gray-900 dark:text-white">
              {new Date(licenseData.startDate).toLocaleDateString("es-ES")}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Fecha de vencimiento
            </p>
            <p className="font-medium text-gray-900 dark:text-white">
              {new Date(licenseData.endDate).toLocaleDateString("es-ES")}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500 dark:text-gray-400">
              Días restantes:{" "}
              <strong className="text-gray-900 dark:text-white">
                {daysLeft}
              </strong>{" "}
              de {totalDays}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {Math.round(progressPercent)}% usado
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className={`${progressColor} h-2.5 rounded-full transition-all duration-500`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {daysLeft <= 30 && (
          <div
            className={`p-3 rounded-lg flex items-start gap-2 ${daysLeft <= 7 ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"}`}
          >
            <AlertTriangle
              className={daysLeft <= 7 ? "text-red-600" : "text-yellow-600"}
              size={18}
            />
            <div>
              <p
                className={`text-sm font-medium ${daysLeft <= 7 ? "text-red-700 dark:text-red-400" : "text-yellow-700 dark:text-yellow-400"}`}
              >
                {daysLeft <= 7
                  ? "¡Licencia por expirar!"
                  : "Licencia próxima a vencer"}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {daysLeft <= 7
                  ? `Tu licencia expira en ${daysLeft} días. Contacta a soporte para renovarla.`
                  : `Tu licencia expirará en ${daysLeft} días. Renueva antes de que venza.`}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ✅ Componente Switch reutilizable
  const Switch = ({ checked, onChange }) => (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        checked ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );

  // ✅ Tabs de navegación
  const tabs = [
    { id: "notifications", label: "Notificaciones", icon: Bell },
    { id: "appearance", label: "Apariencia", icon: Monitor },
    { id: "invoice", label: "Factura", icon: Receipt },
    { id: "printer", label: "Impresora", icon: PrinterIcon },
    { id: "security", label: "Seguridad", icon: Shield },
    { id: "system", label: "Sistema", icon: Database },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={32} />
        <p className="text-gray-500 dark:text-gray-400">
          Cargando configuración...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Configuración del Sistema
        </h1>
        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
          BD Sincronizada
        </span>
      </div>

      {/* Tabs de navegación */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition ${
                activeTab === tab.id
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <tab.icon size={18} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Contenedor principal */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {/* ==================== NOTIFICACIONES ==================== */}
        {activeTab === "notifications" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Notificaciones de stock bajo
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Alertas cuando el stock sea bajo
                </p>
              </div>
              <Switch
                checked={settings.notifications.lowStockEnabled}
                onChange={() =>
                  setSettings({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      lowStockEnabled: !settings.notifications.lowStockEnabled,
                    },
                  })
                }
              />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-white mb-2">
                Umbral de stock bajo
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.notifications.lowStockThreshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        lowStockThreshold: parseInt(e.target.value) || 10,
                      },
                    })
                  }
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <span className="text-gray-500 dark:text-gray-400">
                  unidades o menos
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Alertas de productos agotados
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Notificar cuando un producto se agote
                </p>
              </div>
              <Switch
                checked={settings.notifications.outOfStockEnabled}
                onChange={() =>
                  setSettings({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      outOfStockEnabled:
                        !settings.notifications.outOfStockEnabled,
                    },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Sonido de notificaciones
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Reproducir sonido al recibir alertas
                </p>
              </div>
              <Switch
                checked={settings.notifications.soundEnabled}
                onChange={() =>
                  setSettings({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      soundEnabled: !settings.notifications.soundEnabled,
                    },
                  })
                }
              />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-white mb-2">
                Auto-refresh de notificaciones
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="10"
                  max="120"
                  step="5"
                  value={settings.notifications.autoRefresh}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        autoRefresh: parseInt(e.target.value) || 30,
                      },
                    })
                  }
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <span className="text-gray-500 dark:text-gray-400">
                  segundos
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ==================== APARIENCIA ==================== */}
        {activeTab === "appearance" && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { id: "light", label: "Claro", icon: Sun },
                { id: "dark", label: "Oscuro", icon: Moon },
              ].map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    setSettings({
                      ...settings,
                      appearance: { ...settings.appearance, theme: theme.id },
                    });
                    applyTheme(theme.id);
                  }}
                  className={`p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 ${
                    settings.appearance.theme === theme.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <theme.icon
                    size={24}
                    className={
                      settings.appearance.theme === theme.id
                        ? "text-blue-500"
                        : "text-gray-400 dark:text-gray-500"
                    }
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {theme.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Modo compacto
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Mostrar más información en menos espacio
                </p>
              </div>
              <Switch
                checked={settings.appearance.compactMode}
                onChange={() =>
                  setSettings({
                    ...settings,
                    appearance: {
                      ...settings.appearance,
                      compactMode: !settings.appearance.compactMode,
                    },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Mostrar imágenes de productos
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Desactivar para mejorar rendimiento
                </p>
              </div>
              <Switch
                checked={settings.appearance.showProductImages}
                onChange={() =>
                  setSettings({
                    ...settings,
                    appearance: {
                      ...settings.appearance,
                      showProductImages: !settings.appearance.showProductImages,
                    },
                  })
                }
              />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-white mb-2">
                Productos por página
              </p>
              <select
                value={settings.appearance.itemsPerPage}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    appearance: {
                      ...settings.appearance,
                      itemsPerPage: parseInt(e.target.value),
                    },
                  })
                }
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value={6}>6 productos</option>
                <option value={9}>9 productos</option>
                <option value={12}>12 productos</option>
                <option value={18}>18 productos</option>
                <option value={24}>24 productos</option>
              </select>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Afecta la paginación en la caja
              </p>
            </div>
          </div>
        )}

        {/* ==================== FACTURA / TICKET ==================== */}
        {activeTab === "invoice" && (
          <div className="p-6 space-y-4">
            {/* ✅ SECCIÓN LOGO */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Upload size={18} className="text-blue-600" />
                Logo del Ticket
              </p>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {settings.invoice.logo ? (
                    <div className="relative">
                      <img
                        src={settings.invoice.logo}
                        alt="Logo"
                        className="w-20 h-20 object-contain border rounded-lg bg-white dark:bg-gray-800 p-1"
                      />
                      <button
                        onClick={() =>
                          setSettings({
                            ...settings,
                            invoice: { ...settings.invoice, logo: "" },
                          })
                        }
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                        title="Eliminar logo"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-white dark:bg-gray-800">
                      <Upload className="text-gray-400" size={24} />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg cursor-pointer transition">
                    <Upload size={16} />
                    Seleccionar imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            Swal.fire(
                              "Error",
                              "La imagen no debe superar 2MB",
                              "warning",
                            );
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setSettings({
                              ...settings,
                              invoice: {
                                ...settings.invoice,
                                logo: event.target.result,
                              },
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    PNG, JPG o GIF. Máximo 2MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre de la empresa
                </label>
                <input
                  type="text"
                  value={settings.invoice.companyName}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      invoice: {
                        ...settings.invoice,
                        companyName: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  RUC / NIF / CIF
                </label>
                <input
                  type="text"
                  value={settings.invoice.companyRuc}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      invoice: {
                        ...settings.invoice,
                        companyRuc: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  value={settings.invoice.companyAddress}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      invoice: {
                        ...settings.invoice,
                        companyAddress: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={settings.invoice.companyPhone}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      invoice: {
                        ...settings.invoice,
                        companyPhone: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={settings.invoice.companyEmail}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      invoice: {
                        ...settings.invoice,
                        companyEmail: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sitio Web
                </label>
                <input
                  type="text"
                  value={settings.invoice.website || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      invoice: { ...settings.invoice, website: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="www.cafeuniversal.com"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mensaje de pie de página
                </label>
                <input
                  type="text"
                  value={settings.invoice.footerMessage}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      invoice: {
                        ...settings.invoice,
                        footerMessage: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mensaje Promocional
                </label>
                <textarea
                  value={settings.invoice.promoMessage || ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      invoice: {
                        ...settings.invoice,
                        promoMessage: e.target.value,
                      },
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  placeholder="Le recordamos que cada mañana ofrecemos desayuno..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tasa de IVA (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.invoice.taxRate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      invoice: {
                        ...settings.invoice,
                        taxRate: parseInt(e.target.value) || 10,
                      },
                    })
                  }
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Copias a imprimir
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={settings.invoice.copies}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      invoice: {
                        ...settings.invoice,
                        copies: parseInt(e.target.value) || 1,
                      },
                    })
                  }
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg md:col-span-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Mostrar información de impuestos
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Incluir desglose de IVA en el ticket
                  </p>
                </div>
                <Switch
                  checked={settings.invoice.showTaxInfo}
                  onChange={() =>
                    setSettings({
                      ...settings,
                      invoice: {
                        ...settings.invoice,
                        showTaxInfo: !settings.invoice.showTaxInfo,
                      },
                    })
                  }
                />
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  Tamaño del papel
                </p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="58mm"
                      checked={settings.invoice.paperSize === "58mm"}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          invoice: {
                            ...settings.invoice,
                            paperSize: e.target.value,
                          },
                        })
                      }
                      className="text-blue-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      58mm (ticket pequeño)
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="80mm"
                      checked={settings.invoice.paperSize === "80mm"}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          invoice: {
                            ...settings.invoice,
                            paperSize: e.target.value,
                          },
                        })
                      }
                      className="text-blue-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      80mm (ticket estándar)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== IMPRESORA ==================== */}
        {activeTab === "printer" && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  Tipo de impresora
                </p>
                <select
                  value={settings.printer.printerType}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      printer: {
                        ...settings.printer,
                        printerType: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="thermal">Térmica</option>
                  <option value="laser">Láser</option>
                  <option value="inkjet">Inyección de tinta</option>
                </select>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  Puerto de conexión
                </p>
                <select
                  value={settings.printer.printerPort}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      printer: {
                        ...settings.printer,
                        printerPort: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="USB">USB</option>
                  <option value="Ethernet">Ethernet</option>
                  <option value="Bluetooth">Bluetooth</option>
                  <option value="Serial">Puerto serial</option>
                </select>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  Modelo de impresora
                </p>
                <select
                  value={settings.printer.printerModel}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      printer: {
                        ...settings.printer,
                        printerModel: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="Epson TM-T20">Epson TM-T20</option>
                  <option value="Epson TM-T88">Epson TM-T88</option>
                  <option value="Star TSP650">Star TSP650</option>
                  <option value="Bixolon SRP-350">Bixolon SRP-350</option>
                  <option value="Generic">Genérica</option>
                </select>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  Ancho del papel (mm)
                </p>
                <input
                  type="number"
                  min="40"
                  max="112"
                  value={settings.printer.paperWidth}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      printer: {
                        ...settings.printer,
                        paperWidth: parseInt(e.target.value) || 80,
                      },
                    })
                  }
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg md:col-span-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Corte automático
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Cortar el papel automáticamente después de imprimir
                  </p>
                </div>
                <Switch
                  checked={settings.printer.autoCut}
                  onChange={() =>
                    setSettings({
                      ...settings,
                      printer: {
                        ...settings.printer,
                        autoCut: !settings.printer.autoCut,
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {/* ==================== SEGURIDAD ==================== */}
        {activeTab === "security" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Cierre automático de sesión
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {settings.security.autoLogout
                    ? "✅ Activado - Cierra sesión después de inactividad"
                    : "❌ Desactivado - La sesión permanece abierta"}
                </p>
              </div>
              <Switch
                checked={settings.security.autoLogout}
                onChange={() =>
                  setSettings({
                    ...settings,
                    security: {
                      ...settings.security,
                      autoLogout: !settings.security.autoLogout,
                    },
                  })
                }
              />
            </div>

            {settings.security.autoLogout && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-fadeIn">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  Tiempo de inactividad (minutos)
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="5"
                    max="120"
                    step="5"
                    value={settings.security.sessionTimeout}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        security: {
                          ...settings.security,
                          sessionTimeout: parseInt(e.target.value) || 30,
                        },
                      })
                    }
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <span className="text-gray-500 dark:text-gray-400">
                    minutos
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  La sesión se cerrará después de este tiempo sin actividad
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Requerir contraseña para devoluciones
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {settings.security.requirePasswordForRefund
                    ? "✅ Activado - Solicita autenticación para procesar reembolsos"
                    : "❌ Desactivado - No requiere contraseña adicional"}
                </p>
              </div>
              <Switch
                checked={settings.security.requirePasswordForRefund}
                onChange={() =>
                  setSettings({
                    ...settings,
                    security: {
                      ...settings.security,
                      requirePasswordForRefund:
                        !settings.security.requirePasswordForRefund,
                    },
                  })
                }
              />
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="font-medium text-gray-900 dark:text-white mb-2">
                Máximo intentos de inicio de sesión
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.security.maxLoginAttempts}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      security: {
                        ...settings.security,
                        maxLoginAttempts: parseInt(e.target.value) || 3,
                      },
                    })
                  }
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <span className="text-gray-500 dark:text-gray-400">
                  intentos
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Después de {settings.security.maxLoginAttempts} intentos
                fallidos, la cuenta se bloqueará por 15 minutos
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Autenticación de dos factores (2FA)
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {user2FAEnabled
                    ? "✅ Activado - Requiere código adicional al iniciar sesión"
                    : "❌ Desactivado - Solo requiere email y contraseña"}
                </p>
              </div>
              <button
                onClick={open2FAModal}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  user2FAEnabled
                    ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
                    : "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                }`}
              >
                {user2FAEnabled ? "Gestionar" : "Activar"}
              </button>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                📋 Resumen de seguridad
              </h3>
              <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
                <li>
                  • Cierre automático:{" "}
                  {settings.security.autoLogout
                    ? `${settings.security.sessionTimeout} min`
                    : "Desactivado"}
                </li>
                <li>
                  • Contraseña para devoluciones:{" "}
                  {settings.security.requirePasswordForRefund
                    ? "Activado"
                    : "Desactivado"}
                </li>
                <li>
                  • Máximo intentos login: {settings.security.maxLoginAttempts}
                </li>
                <li>• 2FA: {user2FAEnabled ? "Activado" : "Desactivado"}</li>
              </ul>
            </div>
          </div>
        )}

        {/* ==================== SISTEMA ==================== */}
        {activeTab === "system" && (
          <div className="p-6 space-y-4">
            {/* ✅ SECCIÓN DE LICENCIA */}
            <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-4">
                <Shield
                  className="text-blue-600 dark:text-blue-400"
                  size={20}
                />
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Información de Licencia
                </h3>
              </div>
              <LicenciaInfo />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  Moneda
                </p>
                <div className="flex gap-2">
                  <select
                    value={settings.system.currency}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        system: {
                          ...settings.system,
                          currency: e.target.value,
                        },
                      })
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="USD">USD - Dólar Americano</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="CLP">CLP - Peso Chileno</option>
                    <option value="MXN">MXN - Peso Mexicano</option>
                    <option value="COP">COP - Peso Colombiano</option>
                    <option value="ARS">ARS - Peso Argentino</option>
                  </select>
                  <input
                    type="text"
                    value={settings.system.currencySymbol}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        system: {
                          ...settings.system,
                          currencySymbol: e.target.value,
                        },
                      })
                    }
                    placeholder="$"
                    className="w-16 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  Idioma
                </p>
                <select
                  value={settings.system.language}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      system: { ...settings.system, language: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                </select>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  Formato de fecha
                </p>
                <select
                  value={settings.system.dateFormat}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      system: {
                        ...settings.system,
                        dateFormat: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
                </select>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  Zona horaria
                </p>
                <select
                  value={settings.system.timezone}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      system: { ...settings.system, timezone: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="Europe/Madrid">Madrid</option>
                  <option value="America/Santiago">Santiago</option>
                  <option value="America/Mexico_City">Ciudad de México</option>
                  <option value="America/Bogota">Bogotá</option>
                  <option value="America/Buenos_Aires">Buenos Aires</option>
                  <option value="America/Lima">Lima</option>
                </select>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  Decimales en precios
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    max="4"
                    value={settings.system.decimalPlaces}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        system: {
                          ...settings.system,
                          decimalPlaces: parseInt(e.target.value) || 2,
                        },
                      })
                    }
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <span className="text-gray-500 dark:text-gray-400">
                    decimales
                  </span>
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white mb-2">
                  Separador de miles
                </p>
                <select
                  value={settings.system.thousandsSeparator}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      system: {
                        ...settings.system,
                        thousandsSeparator: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value=",">Coma (1,000.00)</option>
                  <option value=".">Punto (1.000,00)</option>
                  <option value=" ">Espacio (1 000.00)</option>
                  <option value="'">Apóstrofe (1'000.00)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between">
          <button
            onClick={resetConfiguracion}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <RotateCcw size={18} /> Resetear configuración
          </button>
          <button
            onClick={saveConfiguracionToBD}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <Save size={18} /> Guardar cambios
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal de 2FA */}
      {show2FAModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div
            className="absolute inset-0"
            onClick={() => setShow2FAModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="text-blue-600" size={20} /> Autenticación de
                Dos Factores (2FA)
              </h2>
              <button
                onClick={() => setShow2FAModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Paso 1 */}
              {twoFAStep === 1 && (
                <div className="text-center space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <AlertTriangle
                      className="mx-auto text-blue-600 mb-2"
                      size={32}
                    />
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      El 2FA añade una capa extra de seguridad. Necesitarás una
                      app como Google Authenticator.
                    </p>
                  </div>
                  <button
                    onClick={load2FASetup}
                    disabled={twoFALoading}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {twoFALoading ? (
                      <RefreshCw className="animate-spin" size={18} />
                    ) : (
                      <Key size={18} />
                    )}{" "}
                    Comenzar configuración
                  </button>
                  {user2FAEnabled && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        Desactivar 2FA
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Ingresa el código actual para desactivar
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={verificationCode}
                        onChange={handle2FAInput}
                        placeholder="Código de 6 dígitos"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 text-center text-lg tracking-widest dark:bg-gray-800 dark:border-gray-600"
                      />
                      <button
                        onClick={deactivate2FA}
                        disabled={twoFALoading || verificationCode.length !== 6}
                        className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                      >
                        {twoFALoading ? "Desactivando..." : "Desactivar 2FA"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Paso 2 */}
              {twoFAStep === 2 && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center">
                    {qrCode && (
                      <img
                        src={qrCode}
                        alt="QR para 2FA"
                        className="w-48 h-48 border rounded-lg p-2 bg-white"
                      />
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      Escanea con Google Authenticator
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      O ingresa manualmente:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white dark:bg-gray-800 px-3 py-2 rounded border text-sm font-mono break-all">
                        {manualKey}
                      </code>
                      <button
                        onClick={() => copyCode(manualKey)}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Código de verificación (6 dígitos)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verificationCode}
                      onChange={handle2FAInput}
                      className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest font-mono dark:bg-gray-800 dark:border-gray-600"
                      placeholder="000000"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setTwoFAStep(1);
                        setVerificationCode("");
                      }}
                      disabled={twoFALoading}
                      className="flex-1 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      Atrás
                    </button>
                    <button
                      onClick={activate2FA}
                      disabled={twoFALoading || verificationCode.length !== 6}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {twoFALoading ? "Verificando..." : "Activar 2FA"}
                    </button>
                  </div>
                </div>
              )}

              {/* Paso 3 */}
              {twoFAStep === 3 && (
                <div className="text-center space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <CheckCircle
                      className="mx-auto text-green-600 mb-2"
                      size={48}
                    />
                    <p className="font-semibold text-green-800 dark:text-green-200 text-lg">
                      ✅ 2FA Activado Correctamente
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-300 mt-2">
                      Necesitarás el código al iniciar sesión.
                    </p>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      ⚠️ Guarda tus códigos de respaldo en un lugar seguro.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShow2FAModal(false);
                      setTwoFAStep(1);
                      setVerificationCode("");
                    }}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Entendido, cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

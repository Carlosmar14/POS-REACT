// frontend/src/context/ConfigContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import api from "../api";
import { useAuth } from "../store/authStore";

const ConfigContext = createContext();

const DEFAULT_CONFIG = {
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
    companyName: "MI TIENDA POS",
    companyAddress: "Av. Principal #123, Ciudad",
    companyPhone: "📞 (555) 123-4567",
    companyEmail: "info@mitienda.com",
    companyRuc: "123456789",
    footerMessage: "¡Gracias por su compra!",
    paperSize: "80mm",
    copies: 1,
    taxRate: 19,
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
    currency: "USD",
    currencySymbol: "$",
    language: "es",
    dateFormat: "DD/MM/YYYY",
    timezone: "America/Santiago",
    decimalPlaces: 2,
    thousandsSeparator: ",",
  },
  printer: {
    printerType: "thermal",
    printerPort: "USB",
    printerModel: "Epson TM-T20",
    paperWidth: 80,
    autoCut: true,
  },
};

export const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadConfig = async () => {
    if (!user) {
      setConfig(DEFAULT_CONFIG);
      setLoading(false);
      return;
    }

    try {
      const response = await api.get("/configuracion");
      if (response.data.success && response.data.data) {
        const configData = response.data.data;
        setConfig({
          notifications: {
            ...DEFAULT_CONFIG.notifications,
            ...(configData.notifications || {}),
          },
          appearance: {
            ...DEFAULT_CONFIG.appearance,
            ...(configData.appearance || {}),
          },
          invoice: { ...DEFAULT_CONFIG.invoice, ...(configData.invoice || {}) },
          security: {
            ...DEFAULT_CONFIG.security,
            ...(configData.security || {}),
          },
          system: { ...DEFAULT_CONFIG.system, ...(configData.system || {}) },
          printer: { ...DEFAULT_CONFIG.printer, ...(configData.printer || {}) },
        });
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    } catch (error) {
      console.error("❌ Error cargando configuración:", error);
      setConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [user]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "configuracion_actualizada") {
        loadConfig();
      }
    };
    window.addEventListener("storage", handleStorageChange);

    const handleConfigUpdate = (e) => {
      if (e.detail) {
        setConfig(e.detail);
      } else {
        loadConfig();
      }
    };
    window.addEventListener("configUpdated", handleConfigUpdate);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("configUpdated", handleConfigUpdate);
    };
  }, []);

  const updateConfig = (newConfig) => {
    setConfig(newConfig);
    window.dispatchEvent(
      new CustomEvent("configUpdated", { detail: newConfig }),
    );
  };

  return (
    <ConfigContext.Provider
      value={{ config, loading, reload: loadConfig, updateConfig }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig debe usarse dentro de ConfigProvider");
  }
  return context;
};

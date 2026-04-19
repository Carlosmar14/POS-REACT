// src/services/licenseMonitor.js
import { checkSystemLicense } from "./licenseService.js";

let licenseStatus = {
  valid: false,
  data: null,
  lastCheck: null,
};

// ✅ Inicializar el estado inmediatamente (sincrónico no, pero se llama en start)
export const initializeLicenseMonitor = async () => {
  await updateLicenseStatus();
};

// ✅ Actualizar estado
export const updateLicenseStatus = async () => {
  try {
    const result = await checkSystemLicense();
    licenseStatus = {
      valid: result.valid,
      data: result.data,
      lastCheck: new Date(),
    };

    if (!result.valid) {
      console.warn(`⚠️ Licencia inválida: ${result.reason}`);
    } else {
      console.log(
        `✅ Licencia activa. Cliente: ${result.data?.customerName}, Días restantes: ${result.data?.daysLeft}`,
      );
    }
  } catch (err) {
    console.error("❌ Error en monitor de licencia:", err);
  }
};

// ✅ Iniciar monitor periódico
export const startLicenseMonitor = () => {
  // Actualizar ya (no esperar al intervalo)
  updateLicenseStatus();
  setInterval(updateLicenseStatus, 5 * 60 * 1000);
};

// ✅ Obtener estado actual (cache)
export const getCurrentLicenseStatus = () => licenseStatus;

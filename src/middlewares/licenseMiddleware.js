// src/middlewares/licenseMiddleware.js
import { getCurrentLicenseStatus } from "../services/licenseMonitor.js";
import { checkSystemLicense } from "../services/licenseService.js";

const PUBLIC_PATHS = [
  "/api/license/status",
  "/api/license/activate",
  "/api/auth/login",
  "/api/auth/me",
  "/api/auth/2fa/setup",
  "/api/auth/2fa/verify",
  "/api/auth/2fa/disable",
  "/api/auth/2fa/status",
  "/api/auth/verify-password",
  "/api/auth/update-activity",
  "/api/health",
  "/api/test",
];

export const requireLicense = async (req, res, next) => {
  // Rutas públicas sin licencia
  if (PUBLIC_PATHS.some((path) => req.path.startsWith(path))) {
    return next();
  }

  // Obtener estado del cache
  let status = getCurrentLicenseStatus();

  // Si el cache dice que no es válido o no tiene datos, verificar directamente la BD
  if (!status.valid || !status.data) {
    const freshCheck = await checkSystemLicense();
    status = {
      valid: freshCheck.valid,
      data: freshCheck.data,
    };
  }

  if (!status.valid) {
    return res.status(403).json({
      success: false,
      message: "Licencia requerida o inválida",
      licenseRequired: true,
    });
  }

  req.license = status.data;
  next();
};

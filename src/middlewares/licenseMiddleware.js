// backend/src/middlewares/licenseMiddleware.js
import { getCurrentLicenseStatus } from "../services/licenseMonitor.js";

// Rutas públicas que no requieren licencia
const PUBLIC_PATHS = [
  "/api/license/status",
  "/api/license/activate",
  "/api/auth/login",
  "/api/auth/me",
  "/api/auth/2fa/setup",
  "/api/auth/2fa/verify",
  "/api/auth/2fa/disable",
  "/api/auth/2fa/status",
  "/api/health",
  "/api/test"
];

export const requireLicense = (req, res, next) => {
  // Verificar si la ruta es pública
  const isPublicPath = PUBLIC_PATHS.some(path => req.path.startsWith(path));
  
  if (isPublicPath) {
    return next();
  }
  
  // Verificar licencia usando cache
  const licenseStatus = getCurrentLicenseStatus();
  
  if (!licenseStatus.valid) {
    return res.status(403).json({
      success: false,
      message: "Licencia requerida",
      licenseRequired: true,
      redirectTo: "/activacion"
    });
  }
  
  // Adjuntar info de licencia al request
  req.license = licenseStatus.data;
  next();
};
// backend/src/middlewares/licenseMiddleware.js
import { checkSystemLicense } from "../services/licenseService.js";

export const requireLicense = async (req, res, next) => {
  // Rutas públicas que no requieren licencia
  const publicPaths = [
    "/api/license/status",
    "/api/license/activate",
    "/api/auth/login"
  ];
  
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  
  const license = await checkSystemLicense();
  
  if (!license.valid) {
    return res.status(403).json({
      success: false,
      message: license.message || "Licencia requerida",
      licenseRequired: true,
      reason: license.reason
    });
  }
  
  req.license = license.data;
  next();
};
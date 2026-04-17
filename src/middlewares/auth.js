// backend/src/middlewares/auth.js
import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Token requerido" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev-secret-key",
    );
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Token inválido o expirado" });
  }
};

export const isAdmin = (req, res, next) => {
  const role = req.user?.role?.trim().toLowerCase();
  if (role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Acceso denegado: requiere rol de administrador",
    });
  }
  next();
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.user?.role?.trim().toLowerCase();
    const validRoles = allowedRoles.map((r) => r.trim().toLowerCase());

    if (!userRole || !validRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Acceso denegado: rol no autorizado",
      });
    }
    next();
  };
};

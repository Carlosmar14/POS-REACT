// backend/src/routes/auth.routes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { verifyToken } from "../middlewares/auth.js";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

const router = express.Router();

// ✅ Obtener configuración de seguridad desde BD
async function getSecurityConfig() {
  try {
    const result = await pool.query(
      "SELECT settings->'security' as security FROM configuraciones WHERE id = 1",
    );
    return (
      result.rows[0]?.security || {
        maxLoginAttempts: 3,
        sessionTimeout: 30,
        autoLogout: true,
        requirePasswordForRefund: true,
      }
    );
  } catch {
    return {
      maxLoginAttempts: 3,
      sessionTimeout: 30,
      autoLogout: true,
      requirePasswordForRefund: true,
    };
  }
}

// ✅ LOGIN CON SEGURIDAD MEJORADA
router.post("/login", async (req, res) => {
  try {
    const { email, password, twoFactorToken } = req.body;
    const securityConfig = await getSecurityConfig();
    const maxAttempts = securityConfig.maxLoginAttempts || 3;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email y contraseña son requeridos",
      });
    }

    const result = await pool.query(
      `SELECT id, name, email, role, password_hash, is_active, 
              two_factor_secret, two_factor_enabled,
              login_attempts, locked_until
       FROM users WHERE email = $1`,
      [email],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas",
      });
    }

    const user = result.rows[0];

    // ✅ Verificar si la cuenta está bloqueada
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const tiempoRestante = Math.ceil(
        (new Date(user.locked_until) - new Date()) / 1000 / 60,
      );
      return res.status(401).json({
        success: false,
        message: `Cuenta bloqueada. Intenta de nuevo en ${tiempoRestante} minutos o contacta a soporte.`,
        locked: true,
        lockedUntil: user.locked_until,
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: "Usuario inactivo. Contacta al administrador",
      });
    }

    const validPass = await bcrypt.compare(password, user.password_hash);

    if (!validPass) {
      // ✅ Incrementar contador de intentos fallidos
      const newAttempts = (user.login_attempts || 0) + 1;
      let lockedUntil = null;

      if (newAttempts >= maxAttempts) {
        // Bloquear por 15 minutos
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await pool.query(
          "UPDATE users SET login_attempts = $1, locked_until = $2 WHERE id = $3",
          [newAttempts, lockedUntil, user.id],
        );

        return res.status(401).json({
          success: false,
          message: `Cuenta bloqueada por ${maxAttempts} intentos fallidos. Contacta a soporte o espera 15 minutos.`,
          locked: true,
        });
      } else {
        await pool.query("UPDATE users SET login_attempts = $1 WHERE id = $2", [
          newAttempts,
          user.id,
        ]);
      }

      return res.status(401).json({
        success: false,
        message: `Credenciales inválidas. Te quedan ${maxAttempts - newAttempts} intentos.`,
      });
    }

    // ✅ Resetear intentos al login exitoso
    await pool.query(
      "UPDATE users SET login_attempts = 0, locked_until = NULL, last_activity = NOW() WHERE id = $1",
      [user.id],
    );

    // ✅ VERIFICACIÓN DE 2FA
    if (user.two_factor_enabled === true) {
      if (!twoFactorToken) {
        return res.json({
          success: true,
          requires2FA: true,
          data: {
            email: user.email,
            userId: user.id,
            tempToken: jwt.sign(
              {
                userId: user.id,
                email: user.email,
                role: user.role,
                requires2FA: true,
              },
              process.env.JWT_SECRET || "dev-secret-key",
              { expiresIn: "5m" },
            ),
          },
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: "base32",
        token: twoFactorToken,
        window: 1,
      });

      if (!verified) {
        return res.status(401).json({
          success: false,
          message: "Código 2FA inválido o expirado",
        });
      }
    }

    // ✅ Login exitoso - Generar JWT
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "dev-secret-key",
      { expiresIn: "8h" },
    );

    res.json({
      success: true,
      message: "Login exitoso",
      data: {
        accessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          twoFactorEnabled: user.two_factor_enabled || false,
        },
      },
    });
  } catch (err) {
    console.error("❌ Error en login:", err);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

// ✅ VERIFICAR CONTRASEÑA PARA DEVOLUCIONES
router.post("/verify-password", verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user?.userId || req.user?.id;

    const securityConfig = await getSecurityConfig();

    if (!securityConfig.requirePasswordForRefund) {
      return res.json({ success: true, verified: true });
    }

    const result = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    }

    const validPass = await bcrypt.compare(
      password,
      result.rows[0].password_hash,
    );

    if (!validPass) {
      return res
        .status(401)
        .json({
          success: false,
          verified: false,
          message: "Contraseña incorrecta",
        });
    }

    res.json({ success: true, verified: true });
  } catch (err) {
    console.error("❌ Error verificando contraseña:", err);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

// ✅ ACTUALIZAR ACTIVIDAD DEL USUARIO
router.post("/update-activity", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    await pool.query("UPDATE users SET last_activity = NOW() WHERE id = $1", [
      userId,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error actualizando actividad:", err);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

// ✅ VERIFICAR SI LA SESIÓN DEBE CERRARSE POR INACTIVIDAD
router.get("/check-session", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const securityConfig = await getSecurityConfig();

    if (!securityConfig.autoLogout) {
      return res.json({ success: true, valid: true });
    }

    const result = await pool.query(
      "SELECT last_activity FROM users WHERE id = $1",
      [userId],
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, valid: false });
    }

    const lastActivity = new Date(result.rows[0].last_activity);
    const timeoutMinutes = securityConfig.sessionTimeout || 30;
    const now = new Date();
    const diffMinutes = (now - lastActivity) / 1000 / 60;

    if (diffMinutes > timeoutMinutes) {
      return res.json({
        success: true,
        valid: false,
        message: `Sesión expirada por inactividad (${timeoutMinutes} minutos)`,
      });
    }

    res.json({ success: true, valid: true });
  } catch (err) {
    console.error("❌ Error verificando sesión:", err);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

// ✅ DESBLOQUEAR USUARIO (SOLO ADMIN)
router.post("/unlock-user", verifyToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUser = req.user;

    // Solo admin puede desbloquear
    if (currentUser.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Acceso denegado" });
    }

    await pool.query(
      "UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = $1",
      [userId],
    );

    res.json({ success: true, message: "Usuario desbloqueado" });
  } catch (err) {
    console.error("❌ Error desbloqueando usuario:", err);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

// ... (resto de rutas: /me, /2fa/setup, /2fa/verify, /2fa/disable, /2fa/status)

// ✅ Obtener información del usuario actual
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Token no proporcionado" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "dev-secret-key",
    );
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, two_factor_enabled, login_attempts, locked_until 
       FROM users WHERE id = $1`,
      [decoded.userId],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    }

    res.json({
      success: true,
      data: { user: result.rows[0], tokenValid: true },
    });
  } catch (err) {
    res
      .status(401)
      .json({ success: false, message: "Token inválido o expirado" });
  }
});

// ✅ CONFIGURAR 2FA - GENERAR QR Y SECRETO
router.get("/2fa/setup", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const userResult = await pool.query(
      "SELECT email FROM users WHERE id = $1",
      [userId],
    );
    const userEmail = userResult.rows[0]?.email || "usuario@pos.com";

    const secret = speakeasy.generateSecret({
      name: `POS System (${userEmail})`,
      length: 32,
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({ success: true, data: { qrCodeUrl, secret: secret.base32 } });
  } catch (err) {
    console.error("❌ Error 2FA setup:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al generar configuración 2FA" });
  }
});

// ✅ VERIFICAR Y ACTIVAR 2FA
router.post("/2fa/verify", verifyToken, async (req, res) => {
  try {
    const { token, secret } = req.body;
    const userId = req.user?.userId || req.user?.id;

    if (!token || !secret) {
      return res
        .status(400)
        .json({ success: false, message: "Token y secreto requeridos" });
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 1,
    });

    if (!verified) {
      return res
        .status(400)
        .json({ success: false, message: "Código inválido o expirado" });
    }

    await pool.query(
      "UPDATE users SET two_factor_secret = $1, two_factor_enabled = true WHERE id = $2",
      [secret, userId],
    );

    res.json({ success: true, message: "✅ 2FA activado correctamente" });
  } catch (err) {
    console.error("❌ Error 2FA verify:", err);
    res.status(500).json({ success: false, message: "Error al activar 2FA" });
  }
});

// ✅ DESACTIVAR 2FA
router.post("/2fa/disable", verifyToken, async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user?.userId || req.user?.id;

    const user = await pool.query(
      "SELECT two_factor_secret FROM users WHERE id = $1",
      [userId],
    );
    const secret = user.rows[0]?.two_factor_secret;

    if (!secret) {
      return res
        .status(400)
        .json({ success: false, message: "2FA no configurado" });
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 1,
    });

    if (!verified) {
      return res
        .status(400)
        .json({ success: false, message: "Código inválido" });
    }

    await pool.query(
      "UPDATE users SET two_factor_secret = NULL, two_factor_enabled = false WHERE id = $1",
      [userId],
    );

    res.json({ success: true, message: "2FA desactivado correctamente" });
  } catch (err) {
    console.error("❌ Error 2FA disable:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al desactivar 2FA" });
  }
});

// ✅ VERIFICAR ESTADO DE 2FA
router.get("/2fa/status", verifyToken, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const result = await pool.query(
      "SELECT two_factor_enabled FROM users WHERE id = $1",
      [userId],
    );

    res.json({
      success: true,
      data: { enabled: result.rows[0]?.two_factor_enabled || false },
    });
  } catch (err) {
    console.error("❌ Error obteniendo estado 2FA:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener estado 2FA" });
  }
});

export default router;

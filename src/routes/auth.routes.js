// backend/src/routes/auth.routes.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { verifyToken } from "../middlewares/auth.js";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { logAction } from "../services/auditService.js";

const router = express.Router();

// ✅ LOGIN CON SOPORTE PARA 2FA (OPCIONAL)
router.post("/login", async (req, res) => {
  try {
    const { email, password, twoFactorToken } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email y contraseña son requeridos" });
    }

    const result = await pool.query(
      `SELECT id, name, email, role, password_hash, is_active, two_factor_secret, two_factor_enabled 
       FROM users WHERE email = $1`,
      [email],
    );

    if (result.rows.length === 0) {
      await logAction("LOGIN_FAILED", null, req, {
        email,
        reason: "user_not_found",
      });
      return res
        .status(401)
        .json({ success: false, message: "Credenciales inválidas" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      await logAction("LOGIN_FAILED", user.id, req, {
        email,
        reason: "user_inactive",
      });
      return res
        .status(401)
        .json({
          success: false,
          message: "Usuario inactivo. Contacta al administrador",
        });
    }

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) {
      await logAction("LOGIN_FAILED", user.id, req, {
        email,
        reason: "invalid_password",
      });
      return res
        .status(401)
        .json({ success: false, message: "Credenciales inválidas" });
    }

    // ✅ VERIFICACIÓN DE 2FA (solo si el usuario lo tiene activado)
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
        await logAction("LOGIN_FAILED", user.id, req, {
          email,
          reason: "invalid_2fa",
        });
        return res
          .status(401)
          .json({ success: false, message: "Código 2FA inválido o expirado" });
      }
    }

    // ✅ Login exitoso - Generar JWT final
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "dev-secret-key",
      { expiresIn: "8h" },
    );

    await logAction("LOGIN_SUCCESS", user.id, req, {
      email: user.email,
      role: user.role,
    });

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
    await logAction("LOGIN_ERROR", null, req, {
      email: req.body.email,
      error: err.message,
    });
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

// ✅ OBTENER INFORMACIÓN DEL USUARIO ACTUAL
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
      `SELECT id, name, email, role, is_active, two_factor_enabled FROM users WHERE id = $1`,
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

    res.json({
      success: true,
      data: { qrCodeUrl, secret: secret.base32 },
    });
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
      await logAction("2FA_SETUP_FAILED", userId, req, {
        reason: "invalid_code",
      });
      return res
        .status(400)
        .json({ success: false, message: "Código inválido o expirado" });
    }

    await pool.query(
      "UPDATE users SET two_factor_secret = $1, two_factor_enabled = true WHERE id = $2",
      [secret, userId],
    );

    await logAction("2FA_ENABLED", userId, req, {});

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
      await logAction("2FA_DISABLE_FAILED", userId, req, {
        reason: "invalid_code",
      });
      return res
        .status(400)
        .json({ success: false, message: "Código inválido" });
    }

    await pool.query(
      "UPDATE users SET two_factor_secret = NULL, two_factor_enabled = false WHERE id = $1",
      [userId],
    );

    await logAction("2FA_DISABLED", userId, req, {});

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

// ✅ VERIFICAR CONTRASEÑA PARA DEVOLUCIONES
router.post("/verify-password", verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user?.userId || req.user?.id;

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
      await logAction("PASSWORD_VERIFY_FAILED", userId, req, {});
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

// ✅ DESBLOQUEAR USUARIO (SOLO ADMIN)
router.post("/unlock-user", verifyToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const currentUser = req.user;

    if (currentUser.role !== "admin") {
      await logAction("UNLOCK_USER_DENIED", currentUser.userId, req, {
        targetUserId: userId,
      });
      return res
        .status(403)
        .json({ success: false, message: "Acceso denegado" });
    }

    await pool.query(
      "UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = $1",
      [userId],
    );

    await logAction("USER_UNLOCKED", currentUser.userId, req, {
      targetUserId: userId,
    });

    res.json({ success: true, message: "Usuario desbloqueado" });
  } catch (err) {
    console.error("❌ Error desbloqueando usuario:", err);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

export default router;

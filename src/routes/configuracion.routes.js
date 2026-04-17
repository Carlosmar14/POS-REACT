// backend/src/routes/configuracion.routes.js
import express from "express";
import { verifyToken, isAdmin } from "../middlewares/auth.js";
import { pool } from "../config/db.js";

const router = express.Router();

// ✅ Configuración por defecto
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

// ✅ Obtener configuración (público para lectura, autenticado)
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT settings FROM configuraciones WHERE id = 1",
    );

    if (result.rows.length === 0) {
      // Si no existe, crear con valores por defecto
      await pool.query(
        `INSERT INTO configuraciones (id, settings) 
         VALUES (1, $1::jsonb)`,
        [JSON.stringify(DEFAULT_CONFIG)],
      );
      return res.json({ success: true, data: DEFAULT_CONFIG });
    }

    const settings = result.rows[0].settings;
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error("❌ Error obteniendo configuración:", err);
    // En caso de error, devolver defaults
    res.json({ success: true, data: DEFAULT_CONFIG });
  }
});

// ✅ Guardar configuración (solo admin)
router.post("/", verifyToken, isAdmin, async (req, res) => {
  try {
    const settings = req.body;
    const userId = req.user?.userId || req.user?.id;

    console.log("💾 Guardando configuración en BD...");

    // Verificar si existe
    const existing = await pool.query(
      "SELECT id FROM configuraciones WHERE id = 1",
    );

    if (existing.rows.length > 0) {
      // Actualizar existente
      await pool.query(
        `UPDATE configuraciones 
         SET settings = $1::jsonb, 
             updated_at = NOW(), 
             updated_by = $2 
         WHERE id = 1`,
        [JSON.stringify(settings), userId],
      );
      console.log("✅ Configuración ACTUALIZADA en BD");
    } else {
      // Crear nuevo
      await pool.query(
        `INSERT INTO configuraciones (id, settings, updated_by, updated_at) 
         VALUES (1, $1::jsonb, $2, NOW())`,
        [JSON.stringify(settings), userId],
      );
      console.log("✅ Configuración CREADA en BD");
    }

    res.json({
      success: true,
      message: "Configuración guardada correctamente",
    });
  } catch (err) {
    console.error("❌ Error guardando configuración:", err);
    res.status(500).json({
      success: false,
      message: "Error al guardar configuración: " + err.message,
    });
  }
});

// ✅ Resetear configuración (solo admin)
router.post("/reset", verifyToken, isAdmin, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    await pool.query(
      `UPDATE configuraciones 
       SET settings = $1::jsonb, 
           updated_at = NOW(), 
           updated_by = $2 
       WHERE id = 1`,
      [JSON.stringify(DEFAULT_CONFIG), userId],
    );

    console.log("🔄 Configuración reseteada a valores por defecto");

    res.json({
      success: true,
      data: DEFAULT_CONFIG,
      message: "Configuración restaurada a valores por defecto",
    });
  } catch (err) {
    console.error("❌ Error reseteando configuración:", err);
    res.status(500).json({
      success: false,
      message: "Error al resetear configuración",
    });
  }
});

export default router;

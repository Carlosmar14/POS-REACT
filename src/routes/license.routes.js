// backend/src/routes/license.routes.js
import express from "express";
import {
  checkSystemLicense,
  activateSystemLicense,
} from "../services/licenseService.js";
import { logAction } from "../services/auditService.js";
import { updateLicenseStatus } from "../services/licenseMonitor.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";
import { pool } from "../config/db.js";

const router = express.Router();

// GET /api/license/status
router.get("/status", async (req, res) => {
  try {
    const result = await checkSystemLicense();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ Error en /status:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// POST /api/license/activate
router.post("/activate", async (req, res) => {
  try {
    let { licenseToken, customerName } = req.body;

    if (licenseToken) {
      licenseToken = licenseToken.replace(/[\s\n\r\t\u00A0]/g, "").trim();
    }

    console.log(
      "📦 [LICENSE ROUTE] Token recibido:",
      licenseToken?.substring(0, 30) + "...",
    );

    if (!licenseToken) {
      await logAction("LICENSE_ACTIVATE_FAILED", null, req, {
        reason: "missing_token",
      });
      return res
        .status(400)
        .json({ success: false, message: "Token requerido" });
    }

    const result = await activateSystemLicense(licenseToken, customerName);

    if (result.success) {
      await updateLicenseStatus();

      await logAction("LICENSE_ACTIVATED", null, req, {
        customerName: result.data.customerName,
        plan: result.data.plan,
        startDate: result.data.startDate,
        endDate: result.data.endDate,
      });
      res.json({ success: true, data: result.data });
    } else {
      await logAction("LICENSE_ACTIVATE_FAILED", null, req, {
        reason: result.message,
        tokenPrefix: licenseToken.substring(0, 10) + "...",
      });
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (err) {
    console.error("❌ Error en /activate:", err);
    await logAction("LICENSE_ACTIVATE_ERROR", null, req, {
      error: err.message,
    });
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// ─── GESTIÓN DE MÁQUINAS REGISTRADAS (solo admin) ───

// GET /api/license/machines – listar máquinas registradas
router.get("/machines", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, machine_hash, machine_id, activated_at, last_seen
       FROM license_machines
       ORDER BY last_seen DESC`,
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Error al obtener máquinas:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// DELETE /api/license/machines/:id – eliminar una máquina
router.delete(
  "/machines/:id",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query(
        "DELETE FROM license_machines WHERE id = $1",
        [id],
      );
      if (result.rowCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Máquina no encontrada" });
      }

      // 🔁 Refrescar la caché de la licencia inmediatamente
      await updateLicenseStatus();

      res.json({
        success: true,
        message:
          "Máquina eliminada. La licencia ahora puede activarse en otro equipo.",
      });
    } catch (err) {
      console.error("Error al eliminar máquina:", err);
      res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  },
);

export default router;

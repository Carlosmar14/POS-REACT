// src/routes/license.routes.js
import express from "express";
import {
  checkSystemLicense,
  activateSystemLicense,
} from "../services/licenseService.js";
import { logAction } from "../services/auditService.js";
import { updateLicenseStatus } from "../services/licenseMonitor.js";

const router = express.Router();

// ✅ Verificar estado de licencia
router.get("/status", async (req, res) => {
  try {
    const result = await checkSystemLicense();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("❌ Error en /status:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Activar licencia
router.post("/activate", async (req, res) => {
  try {
    const { licenseToken, customerName } = req.body;

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
      // Forzar actualización del monitor inmediatamente después de activar
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Obtener información detallada de la licencia (protegido por middleware de licencia)
router.get("/info", async (req, res) => {
  try {
    const result = await checkSystemLicense();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

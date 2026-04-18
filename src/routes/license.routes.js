// backend/src/routes/license.routes.js
import express from "express";
import {
  checkSystemLicense,
  activateSystemLicense,
} from "../services/licenseService.js";

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

    console.log("📦 Token recibido:", licenseToken?.substring(0, 30) + "...");

    if (!licenseToken) {
      return res
        .status(400)
        .json({ success: false, message: "Token requerido" });
    }

    const result = await activateSystemLicense(licenseToken, customerName);

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (err) {
    console.error("❌ Error en /activate:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

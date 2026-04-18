// backend/src/services/licenseService.js
import { pool } from "../config/db.js";
import { getMachineId } from "../utils/hardwareId.js";
import crypto from "crypto";

const SECRET_KEY = "POS-SYSTEM-SECRET-KEY-2024";

// ✅ Decodificar y validar token
const decodeAndValidateToken = (token) => {
  try {
    console.log("🔍 Token recibido:", token?.substring(0, 50) + "...");

    // Dividir token en data y firma
    const parts = token.split(".");
    if (parts.length !== 2) {
      console.log("❌ Token no tiene formato data.firma");
      return { valid: false, reason: "invalid_format" };
    }

    // Decodificar la parte Base64
    const decoded = Buffer.from(parts[0], "base64").toString("utf-8");
    console.log("📦 Token decodificado:", decoded);

    // Separar los datos
    const segments = decoded.split("|");
    if (segments.length !== 3) {
      console.log("❌ Token no tiene 3 partes (fechaInicio|fechaFin|nombre)");
      return { valid: false, reason: "invalid_data" };
    }

    const [startDate, endDate, customerName] = segments;

    // Validar firma
    const expectedSignature = crypto
      .createHmac("sha256", SECRET_KEY)
      .update(decoded)
      .digest("hex")
      .substring(0, 16);

    console.log("🔐 Firma esperada:", expectedSignature);
    console.log("🔐 Firma recibida:", parts[1]);

    if (parts[1].toLowerCase() !== expectedSignature.toLowerCase()) {
      console.log("❌ Firma inválida");
      return { valid: false, reason: "invalid_signature" };
    }

    // Validar fechas
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);

    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
      console.log("❌ Fechas inválidas");
      return { valid: false, reason: "invalid_dates" };
    }

    console.log("✅ Token válido. Cliente:", customerName);
    console.log("   Inicio:", startDate, "Fin:", endDate);

    return {
      valid: true,
      data: { startDate, endDate, customerName },
    };
  } catch (err) {
    console.error("❌ Error decodificando:", err.message);
    return { valid: false, reason: "decode_error" };
  }
};

// ✅ Activar licencia
export const activateSystemLicense = async (
  licenseToken,
  customerNameInput,
) => {
  try {
    const currentMachineId = getMachineId();

    // Decodificar token para obtener fechas
    const decoded = decodeAndValidateToken(licenseToken);
    if (!decoded.valid) {
      return {
        success: false,
        message: `Token inválido: ${decoded.reason}`,
      };
    }

    const {
      startDate,
      endDate,
      customerName: tokenCustomerName,
    } = decoded.data;
    const finalCustomerName =
      customerNameInput || tokenCustomerName || "Cliente";

    console.log("💾 Guardando en BD:", {
      finalCustomerName,
      startDate,
      endDate,
    });

    // Guardar en BD
    await pool.query(
      `UPDATE system_license 
       SET license_token = $1,
           machine_id = $2,
           customer_name = $3,
           start_date = $4,
           end_date = $5,
           activated_at = NOW(),
           updated_at = NOW()
       WHERE id = 1`,
      [licenseToken, currentMachineId, finalCustomerName, startDate, endDate],
    );

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const endObj = new Date(endDate);
    endObj.setHours(23, 59, 59, 999);
    const daysLeft = Math.ceil((endObj - now) / (1000 * 60 * 60 * 24));

    return {
      success: true,
      message: "Licencia activada correctamente",
      data: {
        startDate,
        endDate,
        daysLeft: Math.max(0, daysLeft),
        customerName: finalCustomerName,
      },
    };
  } catch (err) {
    console.error("❌ Error activando licencia:", err);
    return {
      success: false,
      message: "Error al activar licencia: " + err.message,
    };
  }
};

// ✅ Verificar licencia
export const checkSystemLicense = async () => {
  try {
    const result = await pool.query(
      `SELECT * FROM system_license WHERE id = 1`,
    );

    if (
      result.rows.length === 0 ||
      !result.rows[0].license_token ||
      result.rows[0].license_token === ""
    ) {
      return { hasLicense: false, valid: false, reason: "no_license" };
    }

    const license = result.rows[0];
    const currentMachineId = getMachineId();

    if (license.machine_id && license.machine_id !== currentMachineId) {
      return {
        hasLicense: true,
        valid: false,
        reason: "machine_mismatch",
        message: "Esta licencia está vinculada a otro equipo",
      };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const startObj = new Date(license.start_date);
    const endObj = new Date(license.end_date);
    startObj.setHours(0, 0, 0, 0);
    endObj.setHours(23, 59, 59, 999);

    if (now < startObj) {
      return {
        hasLicense: true,
        valid: false,
        reason: "not_started",
        startDate: license.start_date,
        message: `La licencia comienza el ${license.start_date}`,
      };
    }

    if (now > endObj) {
      return {
        hasLicense: true,
        valid: false,
        reason: "expired",
        endDate: license.end_date,
        message: `La licencia expiró el ${license.end_date}`,
      };
    }

    const daysLeft = Math.ceil((endObj - now) / (1000 * 60 * 60 * 24));
    const totalDays = Math.ceil((endObj - startObj) / (1000 * 60 * 60 * 24));

    return {
      hasLicense: true,
      valid: true,
      data: {
        customerName: license.customer_name,
        startDate: license.start_date,
        endDate: license.end_date,
        daysLeft,
        totalDays,
      },
    };
  } catch (err) {
    console.error("❌ Error verificando licencia:", err);
    return { hasLicense: false, valid: false, reason: "error" };
  }
};

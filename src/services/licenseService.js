// backend/src/services/licenseService.js
import { pool } from "../config/db.js";
import { getMachineId, getMachineHash } from "../utils/hardwareId.js";
import { decryptData, verifySignature } from "../utils/cryptoUtils.js";

// ✅ Decodificar y validar token profesional
const decodeAndValidateToken = (token) => {
  try {
    console.log("🔍 [LICENSE] Token recibido:", token.substring(0, 40) + "...");
    const cleanToken = token.replace(/[\s\n\r\t]/g, "");
    const parts = cleanToken.split(".");
    if (parts.length !== 2) {
      console.log("❌ [LICENSE] Formato inválido, partes:", parts.length);
      return { valid: false, reason: "invalid_format" };
    }

    const [encryptedData, signature] = parts;

    console.log("🔐 [LICENSE] Verificando firma...");
    if (!verifySignature(encryptedData, signature)) {
      console.log("❌ [LICENSE] Firma inválida");
      return { valid: false, reason: "invalid_signature" };
    }

    console.log("🔓 [LICENSE] Desencriptando datos...");
    const decrypted = decryptData(encryptedData);
    if (!decrypted) {
      console.log("❌ [LICENSE] Fallo al desencriptar");
      return { valid: false, reason: "decrypt_failed" };
    }

    console.log("📦 [LICENSE] Datos desencriptados:", decrypted);
    let licenseData;
    try {
      licenseData = JSON.parse(decrypted);
    } catch (e) {
      console.log("❌ [LICENSE] JSON inválido:", e.message);
      return { valid: false, reason: "invalid_json" };
    }

    if (
      !licenseData.startDate ||
      !licenseData.endDate ||
      !licenseData.customerName
    ) {
      console.log("❌ [LICENSE] Campos requeridos faltantes");
      return { valid: false, reason: "missing_fields" };
    }

    const startObj = new Date(licenseData.startDate);
    const endObj = new Date(licenseData.endDate);
    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
      console.log("❌ [LICENSE] Fechas inválidas");
      return { valid: false, reason: "invalid_dates" };
    }

    console.log(
      "✅ [LICENSE] Token válido. Cliente:",
      licenseData.customerName,
    );
    return { valid: true, data: licenseData };
  } catch (err) {
    console.error("❌ [LICENSE] Error decodificando:", err.message);
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
    const currentMachineHash = getMachineHash();

    console.log("🖥️ [LICENSE] Machine ID:", currentMachineId);
    console.log("🖥️ [LICENSE] Machine Hash:", currentMachineHash);

    // Validar token
    const decoded = decodeAndValidateToken(licenseToken);
    if (!decoded.valid) {
      return { success: false, message: `Token inválido: ${decoded.reason}` };
    }

    const licenseData = decoded.data;
    const finalCustomerName =
      customerNameInput || licenseData.customerName || "Cliente";

    console.log("💾 [LICENSE] Guardando en BD...");

    // Verificar qué columnas existen en la tabla
    const columnsRes = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'system_license'
    `);
    const existingColumns = columnsRes.rows.map((r) => r.column_name);
    console.log("📋 [LICENSE] Columnas existentes:", existingColumns);

    // Construir UPDATE dinámicamente
    const updates = [];
    const values = [];
    let idx = 1;

    updates.push(`license_token = $${idx++}`);
    values.push(licenseToken);
    updates.push(`machine_id = $${idx++}`);
    values.push(currentMachineId);
    updates.push(`customer_name = $${idx++}`);
    values.push(finalCustomerName);
    updates.push(`start_date = $${idx++}`);
    values.push(licenseData.startDate);
    updates.push(`end_date = $${idx++}`);
    values.push(licenseData.endDate);
    updates.push(`activated_at = NOW()`);
    updates.push(`updated_at = NOW()`);
    updates.push(`last_verified_at = NOW()`);

    if (existingColumns.includes("license_data")) {
      updates.push(`license_data = $${idx++}`);
      values.push(JSON.stringify(licenseData));
    }
    if (existingColumns.includes("machine_hash")) {
      updates.push(`machine_hash = $${idx++}`);
      values.push(currentMachineHash);
    }
    if (existingColumns.includes("plan")) {
      updates.push(`plan = $${idx++}`);
      values.push(licenseData.plan || "pro");
    }
    if (existingColumns.includes("max_users")) {
      updates.push(`max_users = $${idx++}`);
      values.push(licenseData.maxUsers || 10);
    }
    if (existingColumns.includes("max_products")) {
      updates.push(`max_products = $${idx++}`);
      values.push(licenseData.maxProducts || 1000);
    }

    const sql = `UPDATE system_license SET ${updates.join(", ")} WHERE id = 1`;
    console.log("📝 [LICENSE] SQL:", sql);

    await pool.query(sql, values);
    console.log("✅ [LICENSE] Licencia guardada en BD");

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const endObj = new Date(licenseData.endDate);
    endObj.setHours(23, 59, 59, 999);
    const daysLeft = Math.ceil((endObj - now) / (1000 * 60 * 60 * 24));

    return {
      success: true,
      message: "Licencia activada correctamente",
      data: {
        startDate: licenseData.startDate,
        endDate: licenseData.endDate,
        daysLeft: Math.max(0, daysLeft),
        customerName: finalCustomerName,
        plan: licenseData.plan || "pro",
      },
    };
  } catch (err) {
    console.error("❌ [LICENSE] Error activando licencia:", err);
    return {
      success: false,
      message: "Error al activar licencia: " + err.message,
    };
  }
};

// ✅ Verificar licencia (con protección anti-retroceso del reloj)
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
    const currentMachineHash = getMachineHash();

    // Verificar máquina
    if (license.machine_hash && license.machine_hash !== currentMachineHash) {
      const currentMachineId = getMachineId();
      if (license.machine_id !== currentMachineId) {
        return {
          hasLicense: true,
          valid: false,
          reason: "machine_mismatch",
          message: "Esta licencia está vinculada a otro equipo",
        };
      }
    }

    const now = new Date();

    // ✅ Protección anti-retroceso del reloj
    if (license.last_verified_at) {
      const lastVerified = new Date(license.last_verified_at);
      if (now < lastVerified) {
        console.warn(
          `⚠️ [LICENSE] Retroceso del reloj detectado: último ${lastVerified.toISOString()}, actual ${now.toISOString()}`,
        );
        return {
          hasLicense: true,
          valid: false,
          reason: "clock_tampered",
          message:
            "Se detectó un cambio en la fecha del sistema. La licencia ha sido bloqueada por seguridad.",
        };
      }
    }

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

    // Actualizar última verificación
    await pool.query(
      `UPDATE system_license SET last_verified_at = NOW() WHERE id = 1`,
    );

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
        plan: license.plan || "pro",
        maxUsers: license.max_users,
        maxProducts: license.max_products,
      },
    };
  } catch (err) {
    console.error("❌ [LICENSE] Error verificando licencia:", err);
    return { hasLicense: false, valid: false, reason: "error" };
  }
};

export const getLicenseLimits = async () => {
  const license = await checkSystemLicense();
  if (!license.valid) return null;
  return {
    maxUsers: license.data.maxUsers || 10,
    maxProducts: license.data.maxProducts || 1000,
  };
};

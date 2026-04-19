// src/services/licenseService.js
import { pool } from "../config/db.js";
import { getMachineId, getMachineHash } from "../utils/hardwareId.js";
import { decryptData, verifySignature } from "../utils/cryptoUtils.js";

const decodeAndValidateToken = (token) => {
  try {
    const cleanToken = token.replace(/\s+/g, "");
    const parts = cleanToken.split(".");
    if (parts.length !== 2) return { valid: false, reason: "invalid_format" };
    const [encryptedData, signature] = parts;
    if (!verifySignature(encryptedData, signature))
      return { valid: false, reason: "invalid_signature" };
    const decrypted = decryptData(encryptedData);
    if (!decrypted) return { valid: false, reason: "decrypt_failed" };
    const licenseData = JSON.parse(decrypted);
    if (
      !licenseData.startDate ||
      !licenseData.endDate ||
      !licenseData.customerName
    ) {
      return { valid: false, reason: "missing_fields" };
    }
    const startObj = new Date(licenseData.startDate);
    const endObj = new Date(licenseData.endDate);
    if (isNaN(startObj) || isNaN(endObj))
      return { valid: false, reason: "invalid_dates" };
    return { valid: true, data: licenseData };
  } catch (err) {
    console.error("❌ Error decodificando token:", err.message);
    return { valid: false, reason: "decode_error" };
  }
};

export const activateSystemLicense = async (
  licenseToken,
  customerNameInput,
) => {
  try {
    const currentMachineId = getMachineId();
    const currentMachineHash = getMachineHash();
    const decoded = decodeAndValidateToken(licenseToken);
    if (!decoded.valid)
      return { success: false, message: `Token inválido: ${decoded.reason}` };
    const licenseData = decoded.data;
    const finalCustomerName =
      customerNameInput || licenseData.customerName || "Cliente";

    await pool.query(
      `UPDATE system_license 
       SET license_token = $1, license_data = $2, machine_id = $3, machine_hash = $4,
           customer_name = $5, start_date = $6, end_date = $7, plan = $8,
           max_users = $9, max_products = $10, activated_at = NOW(), updated_at = NOW()
       WHERE id = 1`,
      [
        licenseToken,
        JSON.stringify(licenseData),
        currentMachineId,
        currentMachineHash,
        finalCustomerName,
        licenseData.startDate,
        licenseData.endDate,
        licenseData.plan || "pro",
        licenseData.maxUsers || 10,
        licenseData.maxProducts || 1000,
      ],
    );

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
    console.error("❌ Error activando licencia:", err);
    return {
      success: false,
      message: "Error al activar licencia: " + err.message,
    };
  }
};

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
    now.setHours(0, 0, 0, 0);
    const startObj = new Date(license.start_date);
    startObj.setHours(0, 0, 0, 0);
    const endObj = new Date(license.end_date);
    endObj.setHours(23, 59, 59, 999);
    if (now < startObj)
      return {
        hasLicense: true,
        valid: false,
        reason: "not_started",
        startDate: license.start_date,
        message: `La licencia comienza el ${license.start_date}`,
      };
    if (now > endObj)
      return {
        hasLicense: true,
        valid: false,
        reason: "expired",
        endDate: license.end_date,
        message: `La licencia expiró el ${license.end_date}`,
      };

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
    console.error("❌ Error verificando licencia:", err);
    return { hasLicense: false, valid: false, reason: "error" };
  }
};

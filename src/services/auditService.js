// src/services/auditService.js
import { pool } from "../config/db.js";

/**
 * Registra una acción en el log de auditoría
 * @param {string} action - Tipo de acción (LOGIN_SUCCESS, LOGIN_FAILED, LICENSE_ACTIVATED, etc.)
 * @param {string|null} userId - ID del usuario relacionado (puede ser null)
 * @param {object} req - Objeto request de Express
 * @param {object} details - Detalles adicionales en formato JSON
 */
export const logAction = async (action, userId, req, details = {}) => {
  try {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      null;
    const userAgent = req.headers["user-agent"] || null;

    await pool.query(
      `INSERT INTO audit_logs (action, user_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [action, userId, ip, userAgent, JSON.stringify(details)]
    );
  } catch (err) {
    console.error("❌ Error registrando auditoría:", err.message);
    // No lanzamos error para no interrumpir el flujo principal
  }
};

/**
 * Obtiene los logs de auditoría (para panel de administración)
 * @param {number} limit - Cantidad máxima de registros
 * @param {number} offset - Desplazamiento para paginación
 */
export const getAuditLogs = async (limit = 100, offset = 0) => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  } catch (err) {
    console.error("❌ Error obteniendo logs de auditoría:", err.message);
    return [];
  }
};

/**
 * Elimina logs antiguos (más de X días)
 * @param {number} days - Días de antigüedad máxima
 */
export const cleanOldLogs = async (days = 90) => {
  try {
    const result = await pool.query(
      `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '${days} days'`
    );
    return result.rowCount;
  } catch (err) {
    console.error("❌ Error limpiando logs antiguos:", err.message);
    return 0;
  }
};
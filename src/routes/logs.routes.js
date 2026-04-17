import express from 'express';
import { pool } from '../config/db.js';
import { verifyToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();
router.get('/', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const r = await pool.query(`SELECT l.id, u.name as user_name, u.role as user_role, l.action, l.details, l.created_at FROM activity_logs l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.created_at DESC LIMIT 200`);
    res.json({ success: true, data: r.rows });
  } catch { res.status(500).json({ success: false, message: 'Error cargando logs' }); }
});
export default router;
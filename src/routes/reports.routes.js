import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

// Helper para rangos de fecha
const getDateRange = (period) => {
  const now = new Date();
  let start, end;
  if (period === "weekly") {
    start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === "monthly") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    // daily
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
  }
  return { start: start.toISOString(), end: end.toISOString() };
};

// GET: Reporte Global (Admin)
router.get(
  "/dashboard",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { period = "daily" } = req.query;
      const { start, end } = getDateRange(period);

      // 1. Totales globales del período
      const global = await pool.query(
        `
      SELECT COUNT(*)::int as total_sales, 
             COALESCE(SUM(total),0)::float as total_revenue,
             COALESCE(SUM(CASE WHEN payment_method='cash' THEN total ELSE 0 END),0)::float as cash_total,
             COALESCE(SUM(CASE WHEN payment_method='card' THEN total ELSE 0 END),0)::float as card_total
      FROM sales WHERE created_at >= $1::timestamp AND created_at <= $2::timestamp AND status = 'completed'
    `,
        [start, end],
      );

      // 2. Desempeño por cajera
      const byCashier = await pool.query(
        `
      SELECT u.name as cashier_name, u.email,
             COUNT(s.id)::int as total_sales,
             COALESCE(SUM(s.total),0)::float as total_collected
      FROM users u JOIN sales s ON u.id = s.user_id
      WHERE s.created_at >= $1::timestamp AND s.created_at <= $2::timestamp AND s.status = 'completed'
      GROUP BY u.id, u.name, u.email ORDER BY total_collected DESC
    `,
        [start, end],
      );

      // 3. Últimas 10 ventas
      const last10 = await pool.query(`
      SELECT s.id, s.total::float, s.payment_method, s.created_at, u.name as cashier_name,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id)::int as items_count
      FROM sales s LEFT JOIN users u ON s.user_id = u.id
      WHERE s.status = 'completed' ORDER BY s.created_at DESC LIMIT 10
    `);

      // ✅ CORREGIDO: Se agregó explícitamente la clave "data:"
      res.json({
        success: true,
        data: {
          period,
          range: { start, end },
          summary: global.rows[0],
          by_cashier: byCashier.rows,
          last_10: last10.rows,
        },
      });
    } catch (err) {
      console.error("❌ Error dashboard:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// GET: Stats personales de la cajera (HOY)
router.get("/my-stats", verifyToken, async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const stats = await pool.query(
      `
      SELECT COUNT(*)::int as total_sales, COALESCE(SUM(total),0)::float as total_collected
      FROM sales
      WHERE user_id = $1 AND created_at >= $2::timestamp AND created_at <= $3::timestamp AND status = 'completed'
    `,
      [req.user.id, todayStart.toISOString(), todayEnd.toISOString()],
    );

    // ✅ CORREGIDO: Se agregó explícitamente la clave "data:"
    res.json({ success: true, data: stats.rows[0] });
  } catch (err) {
    console.error("❌ Error stats cajera:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

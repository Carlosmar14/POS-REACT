// backend/src/routes/refunds.routes.js
import express from "express";
import { z } from "zod";
import { pool } from "../config/db.js";
import { verifyToken } from "../middlewares/auth.js";
import { logAction } from "../services/auditService.js";

const router = express.Router();

const refundSchema = z.object({
  sale_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
  reason: z.string().optional().default("Devolución del cliente"),
  credit_note_number: z.string().max(50).optional(),
  customer_name: z.string().max(255).optional(),
  cf: z.boolean().optional(),
  fe: z.string().max(50).optional(),
});

const approveRefundSchema = z.object({});

// Helper
const getAuthUser = (req) => ({
  id: req.user?.id || req.user?.sub || req.user?.userId,
  role: (req.user?.role || req.user?.rol || "").trim().toLowerCase(),
});

// GET /api/refunds/pending – devoluciones pendientes de aprobación
router.get("/pending", verifyToken, async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (user.role !== "admin" && user.role !== "warehouse") {
      return res
        .status(403)
        .json({ success: false, message: "Acceso denegado" });
    }
    const result = await pool.query(
      `SELECT r.id, r.sale_id, r.reason, r.total_refunded, r.status, r.created_at,
              u.name as cashier_name, s.total as original_total,
              COUNT(ri.id) as items_count
       FROM refunds r
       JOIN users u ON r.user_id = u.id
       JOIN sales s ON r.sale_id = s.id
       LEFT JOIN refund_items ri ON r.id = ri.refund_id
       WHERE r.status = 'pending'
       GROUP BY r.id, u.name, s.total
       ORDER BY r.created_at ASC`,
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Error pending refunds:", err);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});

// GET /api/refunds – listar todas (admin)
router.get("/", verifyToken, async (req, res) => {
  try {
    const user = getAuthUser(req);
    if (user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Acceso denegado" });
    }
    const result = await pool.query(`
      SELECT r.*, u.name AS cashier_name, s.total AS original_total,
             COUNT(ri.id) AS items_count
      FROM refunds r
      JOIN users u ON r.user_id = u.id
      JOIN sales s ON r.sale_id = s.id
      LEFT JOIN refund_items ri ON r.id = ri.refund_id
      GROUP BY r.id, u.name, s.total
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Error cargando devoluciones:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// GET /api/refunds/:id – detalle de una devolución
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ri.product_id, p.name AS product_name, p.sku, ri.quantity, ri.unit_price, ri.subtotal
       FROM refund_items ri
       JOIN products p ON ri.product_id = p.id
       WHERE ri.refund_id = $1::uuid ORDER BY ri.created_at`,
      [req.params.id],
    );
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Devolución no encontrada" });
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Error detalle devolución:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  }
});

// POST /api/refunds - Crear devolución (PENDIENTE para cajero/warehouse, COMPLETADA solo admin)
router.post("/", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const parsed = refundSchema.parse(req.body);
    const {
      sale_id,
      items,
      reason,
      credit_note_number,
      customer_name,
      cf,
      fe,
    } = parsed;
    const userId = req.user?.id || req.user?.userId;
    const userRole = req.user?.role || "";

    await client.query("BEGIN");

    // Solo permitir devolver ventas completadas
    const saleRes = await client.query(
      "SELECT id, total, payment_method, cash_session_id, status FROM sales WHERE id = $1::uuid AND status = 'completed'",
      [sale_id],
    );
    if (saleRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Venta no encontrada o no puede ser devuelta",
      });
    }

    let totalRefunded = 0;
    const refundItemsData = [];

    // Validar items y calcular total
    for (const item of items) {
      const saleItem = await client.query(
        `SELECT si.quantity, si.unit_price, si.subtotal 
         FROM sale_items si 
         WHERE si.sale_id = $1::uuid AND si.product_id = $2::uuid`,
        [sale_id, item.product_id],
      );
      if (saleItem.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "El producto no pertenece a la venta",
        });
      }

      const originalQty = parseInt(saleItem.rows[0].quantity);
      if (item.quantity > originalQty) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Cantidad a devolver excede la cantidad vendida",
        });
      }

      const unitPrice = parseFloat(saleItem.rows[0].unit_price);
      const subtotal = item.quantity * unitPrice;
      totalRefunded += subtotal;
      refundItemsData.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal,
      });
    }

    // Estado: completado solo para admin, el resto pendiente
    const status = userRole === "admin" ? "completed" : "pending";

    // Insertar refund
    const refundRes = await client.query(
      `INSERT INTO refunds (sale_id, cash_session_id, user_id, reason, total_refunded, status,
                            credit_note_number, customer_name, cf, fe)
       VALUES ($1::uuid, $2::integer, $3::uuid, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        sale_id,
        saleRes.rows[0].cash_session_id || null,
        userId,
        reason,
        totalRefunded,
        status,
        credit_note_number || null,
        customer_name || null,
        cf || false,
        fe || null,
      ],
    );
    const refundId = refundRes.rows[0].id;

    // Insertar items
    for (const item of refundItemsData) {
      await client.query(
        `INSERT INTO refund_items (refund_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
        [
          refundId,
          item.product_id,
          item.quantity,
          item.unit_price,
          item.subtotal,
        ],
      );
    }

    // Si fue creada por admin, se procesa directamente (stock y estado de venta)
    if (status === "completed") {
      for (const item of refundItemsData) {
        await client.query(
          "UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2::uuid",
          [item.quantity, item.product_id],
        );
        await client.query(
          `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by)
           VALUES ($1::uuid, $2, 'increase', $3, $4::uuid)`,
          [
            item.product_id,
            item.quantity,
            `Devolución venta #${refundId.slice(0, 8)}`,
            userId,
          ],
        );
      }
      // Marcar venta como refunded
      await client.query(
        "UPDATE sales SET status = 'refunded' WHERE id = $1::uuid",
        [sale_id],
      );
    }

    await client.query("COMMIT");

    const event = status === "completed" ? "REFUND_CREATED" : "REFUND_PENDING";
    await logAction(event, userId, req, {
      refundId,
      saleId: sale_id,
      totalRefunded,
      reason,
      creditNote: credit_note_number || null,
    });

    res.status(201).json({
      success: true,
      message:
        status === "completed"
          ? "Devolución procesada"
          : "Solicitud de devolución creada y pendiente de aprobación",
      data: { refundId, totalRefunded, itemsCount: items.length, status },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: err.errors.map((e) => e.message),
      });
    }
    console.error("Error creando devolución:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

// PUT /api/refunds/:id/approve - Aprobar devolución pendiente (warehouse/admin)
router.put("/:id/approve", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const user = getAuthUser(req);
    if (user.role !== "admin" && user.role !== "warehouse") {
      return res
        .status(403)
        .json({ success: false, message: "Acceso denegado" });
    }

    const { id } = req.params;

    const refundRes = await client.query(
      "SELECT * FROM refunds WHERE id = $1::uuid AND status = 'pending' FOR UPDATE",
      [id],
    );
    if (refundRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({
          success: false,
          message: "Devolución pendiente no encontrada",
        });
    }

    // Obtener items de la devolución
    const itemsRes = await client.query(
      "SELECT ri.product_id, ri.quantity FROM refund_items ri WHERE ri.refund_id = $1::uuid",
      [id],
    );

    for (const item of itemsRes.rows) {
      // Devolver stock
      await client.query(
        "UPDATE products SET stock = stock + $1, updated_at = NOW() WHERE id = $2::uuid",
        [item.quantity, item.product_id],
      );
      // Registrar movimiento
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by)
         VALUES ($1::uuid, $2, 'increase', $3, $4::uuid)`,
        [
          item.product_id,
          item.quantity,
          `Devolución aprobada #${id.slice(0, 8)}`,
          user.id,
        ],
      );
    }

    // Marcar la venta original como refunded
    const saleId = refundRes.rows[0].sale_id;
    await client.query(
      "UPDATE sales SET status = 'refunded' WHERE id = $1::uuid AND status = 'completed'",
      [saleId],
    );

    // Marcar la devolución como completada
    await client.query(
      "UPDATE refunds SET status = 'completed' WHERE id = $1::uuid",
      [id],
    );

    await client.query("COMMIT");

    await logAction("REFUND_APPROVED", user.id, req, { refundId: id, saleId });

    res.json({ success: true, message: "Devolución aprobada" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error al aprobar devolución:", err);
    res
      .status(500)
      .json({ success: false, message: "Error interno del servidor" });
  } finally {
    client.release();
  }
});

export default router;

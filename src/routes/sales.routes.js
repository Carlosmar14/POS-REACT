import express from "express";
import { pool } from "../config/db.js";
import { verifyToken } from "../middlewares/auth.js";
import z from "zod";

const router = express.Router();

// 🔐 Helper robusto para extraer usuario sin importar cómo venga el JWT
// Limpia espacios, convierte a minúsculas y busca el ID en múltiples campos posibles
const getAuthUser = (req) => ({
  id: req.user?.id || req.user?.sub || req.user?.userId,
  role: (req.user?.role || req.user?.rol || "").trim().toLowerCase(),
});

const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().positive().max(9999),
      }),
    )
    .min(1),
  paymentMethod: z.enum(["cash", "card", "transfer"]).default("cash"),
});

// ============================================================================
// ✅ GET /stats - Estadísticas
// ============================================================================
router.get("/stats", verifyToken, async (req, res) => {
  try {
    const user = getAuthUser(req);
    const { start, end, status } = req.query;
    const conditions = [];
    const values = [];

    // 🔒 Si NO es admin, solo ve sus propios stats
    if (user.role !== "admin") {
      conditions.push(`s.user_id = $${values.length + 1}::uuid`);
      values.push(user.id);
    }

    if (start)
      (conditions.push(`s.created_at >= $${values.length + 1}`),
        values.push(new Date(start)));
    if (end)
      (conditions.push(`s.created_at <= $${values.length + 1}`),
        values.push(new Date(end + "T23:59:59")));
    if (status)
      (conditions.push(`s.status = $${values.length + 1}`),
        values.push(status));

    const colRes = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'sales' AND column_name IN ('total_amount', 'total')
    `);
    const totalColumn = colRes.rows[0]?.column_name || "total_amount";

    let sql = `
      SELECT 
        COUNT(*) as total_transacciones,
        COALESCE(SUM(${totalColumn}), 0) as total_ingresos,
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN ${totalColumn} ELSE 0 END), 0) as total_efectivo,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN ${totalColumn} ELSE 0 END), 0) as total_tarjeta,
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN ${totalColumn} ELSE 0 END), 0) as total_transferencia
      FROM sales s
    `;
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;

    const result = await pool.query(sql, values);
    const stats = result.rows[0];

    return res.json({
      success: true,
      data: {
        totalTransacciones: parseInt(stats.total_transacciones),
        totalVentas: parseFloat(stats.total_ingresos),
        porMetodo: {
          efectivo: parseFloat(stats.total_efectivo),
          tarjeta: parseFloat(stats.total_tarjeta),
          transferencia: parseFloat(stats.total_transferencia),
        },
      },
    });
  } catch (err) {
    console.error("❌ Error GET /sales/stats:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error al cargar estadísticas" });
  }
});

// ============================================================================
// 📦 GET /stock-movements - Historial de Stock
// ============================================================================
router.get("/stock-movements", verifyToken, async (req, res) => {
  try {
    const user = getAuthUser(req);

    // ✅ Permiso: Solo warehouse/admin pueden ver historial de stock
    if (!["warehouse", "admin"].includes(user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Acceso denegado" });
    }

    const { start, end, page = 1, limit = 20, productId } = req.query;
    const offset = (parseInt(page) - 1) * Math.max(parseInt(limit), 1);
    const conditions = [];
    const values = [];

    // 🔒 AISLAMIENTO: Si NO es admin, solo ve SUS movimientos
    if (user.role !== "admin") {
      conditions.push(`sm.created_by = $${values.length + 1}::uuid`);
      values.push(user.id);
    }

    if (productId) {
      conditions.push(`sm.product_id = $${values.length + 1}::uuid`);
      values.push(productId);
    }
    if (start) {
      conditions.push(`sm.created_at >= $${values.length + 1}`);
      values.push(new Date(start));
    }
    if (end) {
      conditions.push(`sm.created_at <= $${values.length + 1}`);
      values.push(new Date(end + "T23:59:59"));
    }

    let sql = `
      SELECT sm.id, sm.product_id, sm.quantity, sm.movement_type, sm.reason,
             sm.created_at, sm.created_by,
             p.name AS product_name, p.sku,
             COALESCE(u.name, 'Sistema') AS user_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN users u ON sm.created_by = u.id
    `;
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;

    sql += ` ORDER BY sm.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(parseInt(limit), offset);

    const result = await pool.query(sql, values);

    let countSql = `SELECT COUNT(*) FROM stock_movements sm`;
    if (conditions.length > 0) countSql += ` WHERE ${conditions.join(" AND ")}`;
    const countResult = await pool.query(countSql, values.slice(0, -2));
    const totalRecords = parseInt(countResult.rows[0].count);

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / parseInt(limit)) || 1,
      },
    });
  } catch (err) {
    console.error("❌ Error GET /stock-movements:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error al cargar movimientos" });
  }
});

// ============================================================================
// 📦 POST /stock-movements - Registrar Movimiento Manual
// ============================================================================
router.post("/stock-movements", verifyToken, async (req, res) => {
  try {
    const user = getAuthUser(req);

    // ✅ Permiso: Solo warehouse/admin pueden crear movimientos
    if (!["warehouse", "admin"].includes(user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Acceso denegado" });
    }

    const {
      productId,
      quantity,
      reason,
      movementType = "adjustment",
    } = req.body;
    const qty = parseInt(quantity);

    if (!productId || !qty) {
      return res
        .status(400)
        .json({ success: false, message: "Producto y cantidad requeridos" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const productRes = await client.query(
        "SELECT id, name, stock FROM products WHERE id = $1::uuid AND is_active = true",
        [productId],
      );
      if (productRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ success: false, message: "Producto no encontrado" });
      }
      const product = productRes.rows[0];
      const newStock = parseInt(product.stock) + qty;

      await client.query(
        "UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2::uuid",
        [newStock, productId],
      );

      // ✅ Se guarda el user.id del creador para que el filtro funcione después
      await client.query(
        `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) 
         VALUES ($1::uuid, $2, $3, $4, $5::uuid) RETURNING id, created_at`,
        [
          productId,
          qty,
          movementType,
          reason || `${movementType} manual`,
          user.id,
        ],
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: `Stock actualizado: ${qty > 0 ? "+" : ""}${qty} unidades`,
        data: {
          movementId: product.id,
          productName: product.name,
          newStock,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ Error POST /stock-movements:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================================
// ✅ POST / - Procesar Venta
// ============================================================================
router.post("/", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const validated = saleSchema.parse(req.body);
    const { items, paymentMethod } = validated;
    const user = getAuthUser(req);
    if (!user.id)
      return res
        .status(401)
        .json({ success: false, message: "Usuario no autenticado" });

    await client.query("BEGIN");

    let total = 0;
    const saleItemsData = [];

    for (const item of items) {
      const productRes = await client.query(
        "SELECT id, sale_price, stock, name FROM products WHERE id = $1::uuid AND is_active = true FOR UPDATE",
        [item.productId],
      );

      if (productRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({
            success: false,
            message: `Producto no encontrado: ${item.productId}`,
          });
      }

      const product = productRes.rows[0];
      const stock = parseInt(product.stock);
      const price = parseFloat(product.sale_price);

      if (stock < item.quantity) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({
            success: false,
            message: `Stock insuficiente para "${product.name}"`,
          });
      }

      await client.query(
        "UPDATE products SET stock = stock - $1, updated_at = NOW() WHERE id = $2::uuid",
        [item.quantity, item.productId],
      );

      saleItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: price,
        subtotal: item.quantity * price,
      });

      total += item.quantity * price;
    }

    const colRes = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'sales' AND column_name IN ('total_amount', 'total')
    `);
    const totalColumn = colRes.rows[0]?.column_name || "total_amount";

    const saleRes = await client.query(
      `INSERT INTO sales (user_id, payment_method, ${totalColumn}, status, created_at) 
       VALUES ($1::uuid, $2, $3, 'completed', NOW()) 
       RETURNING id, user_id, created_at`,
      [user.id, paymentMethod, total],
    );

    const saleId = saleRes.rows[0].id;

    for (const itemData of saleItemsData) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal) 
         VALUES ($1, $2::uuid, $3, $4, $5)`,
        [
          saleId,
          itemData.productId,
          itemData.quantity,
          itemData.unitPrice,
          itemData.subtotal,
        ],
      );
    }

    // Registrar movimiento de stock automáticamente
    try {
      for (const item of items) {
        await client.query(
          `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by, sale_id) 
           VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6)`,
          [
            item.productId,
            -item.quantity,
            "sale",
            "Venta en POS",
            user.id,
            saleId,
          ],
        );
      }
    } catch (stockErr) {
      console.warn(
        "⚠️ Tabla stock_movements no existe o error:",
        stockErr.message,
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Venta procesada exitosamente",
      data: {
        saleId,
        total,
        createdAt: saleRes.rows[0].created_at,
        paymentMethod,
        itemsCount: items.length,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error en venta:", err);
    if (err.name === "ZodError") {
      return res
        .status(400)
        .json({
          success: false,
          message: err.errors.map((e) => e.message).join(", "),
        });
    }
    return res
      .status(500)
      .json({ success: false, message: err.message || "Error interno" });
  } finally {
    client.release();
  }
});

// ============================================================================
// ✅ GET / - Historial de Ventas (Paginado)
// ============================================================================
router.get("/", verifyToken, async (req, res) => {
  try {
    const user = getAuthUser(req);
    const { start, end, page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * Math.max(parseInt(limit), 1);
    const conditions = [];
    const values = [];

    // 🔒 Si NO es admin, solo ve SUS ventas
    if (user.role !== "admin") {
      conditions.push(`s.user_id = $${values.length + 1}::uuid`);
      values.push(user.id);
    }

    if (start)
      (conditions.push(`s.created_at >= $${values.length + 1}`),
        values.push(new Date(start)));
    if (end)
      (conditions.push(`s.created_at <= $${values.length + 1}`),
        values.push(new Date(end + "T23:59:59")));
    if (status)
      (conditions.push(`s.status = $${values.length + 1}`),
        values.push(status));

    const colRes = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'sales' AND column_name IN ('total_amount', 'total')
    `);
    const totalColumn = colRes.rows[0]?.column_name || "total_amount";

    let sql = `
      SELECT s.id, s.${totalColumn} as total, s.payment_method, s.status, s.created_at, s.user_id,
             COALESCE(u.name, 'Cajera') AS cashier_name, u.email AS cashier_email,
             COUNT(si.id) as items_count
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
    `;
    if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;

    sql += ` GROUP BY s.id, s.${totalColumn}, s.payment_method, s.status, s.created_at, s.user_id, u.name, u.email ORDER BY s.created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(parseInt(limit), offset);

    const result = await pool.query(sql, values);

    let countSql = `SELECT COUNT(DISTINCT s.id) FROM sales s`;
    if (conditions.length > 0) countSql += ` WHERE ${conditions.join(" AND ")}`;
    const countResult = await pool.query(countSql, values.slice(0, -2));
    const totalRecords = parseInt(countResult.rows[0].count);

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / parseInt(limit)) || 1,
      },
    });
  } catch (err) {
    console.error("❌ Error GET /sales:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error al cargar historial" });
  }
});

// ============================================================================
// ✅ GET /:id - Detalles de venta
// ============================================================================
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id))
      return res.status(400).json({ success: false, message: "ID no válido" });

    const user = getAuthUser(req);
    if (user.role !== "admin") {
      const saleCheck = await pool.query(
        "SELECT user_id FROM sales WHERE id = $1::uuid",
        [id],
      );
      if (
        saleCheck.rows.length === 0 ||
        String(saleCheck.rows[0].user_id) !== String(user.id)
      ) {
        return res
          .status(403)
          .json({ success: false, message: "Acceso denegado" });
      }
    }

    const colRes = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'sales' AND column_name IN ('total_amount', 'total') 
    `);
    const totalColumn = colRes.rows[0]?.column_name || "total_amount";

    const sql = `
      SELECT s.id, s.${totalColumn} as total, s.payment_method, s.status, s.created_at, s.user_id,
             COALESCE(u.name, 'Cajera') AS cashier_name, u.email AS cashier_email,
             si.id AS sale_item_id, si.quantity, si.unit_price, si.subtotal, 
             p.id AS product_id, p.name AS product_name, p.sku AS product_sku, p.image_url AS product_image
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE s.id = $1::uuid
      ORDER BY si.id ASC
    `;

    const result = await pool.query(sql, [id]);
    if (result.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Venta no encontrada" });

    const sale = result.rows[0];
    const items = result.rows
      .filter((r) => r.product_id !== null)
      .map((r) => ({
        saleItemId: r.sale_item_id,
        productId: r.product_id,
        name: r.product_name,
        sku: r.product_sku,
        image: r.product_image,
        quantity: parseInt(r.quantity),
        unitPrice: parseFloat(r.unit_price),
        subtotal: parseFloat(r.subtotal),
      }));

    return res.json({
      success: true,
      data: {
        id: sale.id,
        total: parseFloat(sale.total),
        paymentMethod: sale.payment_method,
        status: sale.status,
        createdAt: sale.created_at,
        cashier: {
          id: sale.user_id,
          name: sale.cashier_name,
          email: sale.cashier_email,
        },
        items,
      },
    });
  } catch (err) {
    console.error("❌ Error GET /sales/:id:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error al cargar detalles" });
  }
});

export default router;

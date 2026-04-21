// backend/routes/products.routes.js
import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";
import { upload } from "../config/multer.js";

const router = express.Router();

// ✅ 1. GET: Listar productos
router.get("/", verifyToken, async (req, res) => {
  try {
    const tableExists = await pool.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories')`,
    );
    const hasCategories = tableExists.rows[0].exists;

    const sql = hasCategories
      ? `SELECT p.id, p.sku, p.name, p.cost_price, p.sale_price, p.stock, p.category_id, p.image_url, p.is_active, p.created_at, COALESCE(c.name, 'Sin categoría') AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.is_active = true ORDER BY p.name ASC`
      : `SELECT p.id, p.sku, p.name, p.cost_price, p.sale_price, p.stock, p.category_id, p.image_url, p.is_active, p.created_at, 'Sin categoría' AS category_name FROM products p WHERE p.is_active = true ORDER BY p.name ASC`;

    const result = await pool.query(sql);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("❌ Error GET /products:", err.message);
    res
      .status(500)
      .json({
        success: false,
        message: "Error al cargar productos",
        detail: err.message,
      });
  }
});

// ✅ 2. POST: Crear producto
router.post(
  "/",
  verifyToken,
  requireRole("admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      const { sku, name, cost_price, sale_price, stock, category_id } =
        req.body;
      const image_url = req.file ? "/uploads/" + req.file.filename : null;
      const userId = req.user?.id || req.user?.userId;

      const columns = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'user_id'`,
      );
      const hasUserId = columns.rows.length > 0;

      let sql, values;
      if (hasUserId) {
        sql = `INSERT INTO products (sku, name, cost_price, sale_price, stock, category_id, image_url, user_id, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING *`;
        values = [
          sku?.trim(),
          name?.trim(),
          parseFloat(cost_price) || 0,
          parseFloat(sale_price) || 0,
          parseInt(stock) || 0,
          category_id || null,
          image_url,
          userId,
        ];
      } else {
        sql = `INSERT INTO products (sku, name, cost_price, sale_price, stock, category_id, image_url, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`;
        values = [
          sku?.trim(),
          name?.trim(),
          parseFloat(cost_price) || 0,
          parseFloat(sale_price) || 0,
          parseInt(stock) || 0,
          category_id || null,
          image_url,
        ];
      }

      const result = await pool.query(sql, values);
      res
        .status(201)
        .json({
          success: true,
          data: result.rows[0],
          message: "Producto creado",
        });
    } catch (err) {
      console.error("❌ Error POST /products:", err);
      if (err.code === "23505")
        return res
          .status(409)
          .json({ success: false, message: "SKU duplicado" });
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ✅ 3. PUT /:id/stock: Ajustar stock (entrada/salida) - VERSIÓN CON DIAGNÓSTICO
router.put(
  "/:id/stock",
  verifyToken,
  requireRole("warehouse", "admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { quantity, action, reason } = req.body;

      console.log("📦 [STOCK] Datos recibidos:", {
        id,
        quantity,
        action,
        reason,
      });

      // Validación estricta de cantidad
      const qty = parseInt(quantity);
      if (isNaN(qty) || qty <= 0) {
        console.log("❌ [STOCK] Cantidad inválida:", quantity);
        return res
          .status(400)
          .json({
            success: false,
            message: "Cantidad debe ser un número mayor a 0",
          });
      }

      // Validación de acción
      if (action !== "increase" && action !== "decrease") {
        console.log("❌ [STOCK] Acción inválida:", action);
        return res
          .status(400)
          .json({
            success: false,
            message: "Acción inválida (debe ser increase o decrease)",
          });
      }

      // Obtener producto actual
      const productRes = await pool.query(
        "SELECT id, name, sku, stock FROM products WHERE id = $1::uuid AND is_active = true",
        [id],
      );

      if (productRes.rows.length === 0) {
        console.log("❌ [STOCK] Producto no encontrado:", id);
        return res
          .status(404)
          .json({
            success: false,
            message: "Producto no encontrado o inactivo",
          });
      }

      const product = productRes.rows[0];
      const currentStock = parseInt(product.stock);
      console.log(
        `📊 [STOCK] Stock actual de ${product.name}: ${currentStock}`,
      );

      // Calcular nuevo stock
      let newStock;
      if (action === "increase") {
        newStock = currentStock + qty;
      } else {
        if (currentStock < qty) {
          console.log(
            `❌ [STOCK] Stock insuficiente: actual ${currentStock}, solicitado ${qty}`,
          );
          return res
            .status(400)
            .json({
              success: false,
              message: "Stock insuficiente para realizar la salida",
            });
        }
        newStock = currentStock - qty;
      }

      console.log(`✅ [STOCK] Nuevo stock calculado: ${newStock}`);

      // Actualizar stock en la base de datos
      const updateRes = await pool.query(
        "UPDATE products SET stock = $1, updated_at = NOW() WHERE id = $2::uuid RETURNING stock",
        [newStock, id],
      );

      console.log(
        `💾 [STOCK] Stock actualizado en BD. Nuevo valor: ${updateRes.rows[0].stock}`,
      );

      // Intentar registrar movimiento sin que falle si la tabla no existe
      try {
        await pool.query(
          `INSERT INTO stock_movements (product_id, quantity, movement_type, reason, created_by) 
         VALUES ($1::uuid, $2, $3, $4, $5::uuid)`,
          [
            id,
            qty,
            action,
            reason || "Ajuste manual",
            req.user?.id || req.user?.userId,
          ],
        );
        console.log("📝 [STOCK] Movimiento registrado en stock_movements");
      } catch (movErr) {
        console.warn(
          "⚠️ [STOCK] No se pudo registrar movimiento (posiblemente falta la tabla):",
          movErr.message,
        );
      }

      const actionText = action === "increase" ? "agregaron" : "retiraron";
      res.json({
        success: true,
        message: `Se ${actionText} ${qty} unidades`,
        data: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          stock: newStock,
        },
      });
    } catch (err) {
      console.error("🔥 [STOCK] Error inesperado:", err);
      res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }
  },
);

// ✅ 4. PUT: Actualizar producto completo
router.put(
  "/:id",
  verifyToken,
  requireRole("admin"),
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { sku, name, cost_price, sale_price, stock, category_id } =
        req.body;
      const updates = [];
      const values = [];
      let idx = 1;
      const push = (field, value) => {
        if (value !== undefined && value !== null && value !== "") {
          updates.push(`${field} = $${idx}`);
          values.push(value);
          idx++;
        }
      };

      if (sku) push("sku", sku.trim());
      if (name) push("name", name.trim());
      if (cost_price) push("cost_price", parseFloat(cost_price));
      if (sale_price) push("sale_price", parseFloat(sale_price));
      if (stock !== undefined && stock !== "") push("stock", parseInt(stock));
      if (category_id !== undefined) {
        if (category_id === "" || category_id === "null") {
          updates.push(`category_id = $${idx}`);
          values.push(null);
          idx++;
        } else push("category_id", category_id);
      }
      if (req.file) push("image_url", "/uploads/" + req.file.filename);
      updates.push("updated_at = NOW()");

      if (updates.length === 1)
        return res
          .status(400)
          .json({ success: false, message: "No hay datos para actualizar" });

      values.push(id);
      const sql = `UPDATE products SET ${updates.join(", ")} WHERE id = $${idx} AND is_active = true RETURNING *`;
      const result = await pool.query(sql, values);

      if (result.rows.length === 0)
        return res
          .status(404)
          .json({ success: false, message: "Producto no encontrado" });
      res.json({
        success: true,
        data: result.rows[0],
        message: "Producto actualizado",
      });
    } catch (err) {
      console.error("❌ Error PUT /:id:", err);
      if (err.code === "23505")
        return res.status(409).json({ success: false, message: "SKU en uso" });
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ✅ 5. DELETE: Desactivar producto
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1",
      [id],
    );
    res.json({ success: true, message: "Producto desactivado" });
  } catch (err) {
    console.error("❌ Error DELETE /:id:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

// ✅ GET: Obtener categorías activas
router.get("/", verifyToken, async (req, res) => {
  try {
    const sql =
      "SELECT id, name, COALESCE(description, '') as description, COALESCE(is_active, true) as is_active, created_at FROM categories WHERE COALESCE(is_active, true) = true ORDER BY name ASC";

    const result = await pool.query(sql);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("❌ Error GET categories:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ POST: Crear categoría (MEJORADO - permite reactivar)
router.post("/", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const name = req.body.name;
    const description = req.body.description || null;

    if (!name || name.trim().length < 2) {
      return res
        .status(400)
        .json({ success: false, message: "Nombre muy corto" });
    }

    const cleanName = name.trim();

    // Verificar si ya existe una categoría con ese nombre (activa o inactiva)
    const existingCategory = await pool.query(
      "SELECT id, is_active FROM categories WHERE name = $1",
      [cleanName],
    );

    if (existingCategory.rows.length > 0) {
      const category = existingCategory.rows[0];

      if (category.is_active) {
        // Si existe y está activa, error
        return res.status(409).json({
          success: false,
          message: "Ya existe una categoría activa con ese nombre",
        });
      } else {
        // Si existe pero está inactiva, la reactivamos
        console.log(`🔄 Reactivando categoría existente: ${cleanName}`);
        const result = await pool.query(
          "UPDATE categories SET description = $1, is_active = true WHERE id = $2 RETURNING id, name, COALESCE(description, '') as description, is_active, created_at",
          [description, category.id],
        );

        return res.status(200).json({
          success: true,
          data: result.rows[0],
          message: "Categoría reactivada exitosamente",
        });
      }
    }

    // Si no existe, crear nueva
    const sql =
      "INSERT INTO categories (name, description, is_active) VALUES ($1, $2, true) RETURNING id, name, COALESCE(description, '') as description, is_active, created_at";

    const result = await pool.query(sql, [cleanName, description]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Categoría creada exitosamente",
    });
  } catch (err) {
    console.error("❌ Error POST categories:", err);
    res.status(500).json({
      success: false,
      message: "Error al crear categoría",
      error: err.message,
    });
  }
});

// ✅ PUT: Actualizar categoría
router.put("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description } = req.body;

    console.log(`🔄 Actualizando categoría UUID: ${id}`, { name, description });

    if (!id || id.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "ID de categoría inválido",
      });
    }

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "El nombre debe tener al menos 2 caracteres",
      });
    }

    const cleanName = name.trim();

    // Verificar si el nuevo nombre ya existe en otra categoría activa
    const nameExists = await pool.query(
      "SELECT id FROM categories WHERE name = $1 AND is_active = true AND id != $2",
      [cleanName, id],
    );

    if (nameExists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Ya existe otra categoría activa con ese nombre",
      });
    }

    const sql = `
      UPDATE categories 
      SET 
        name = $1, 
        description = $2
      WHERE id = $3 AND is_active = true 
      RETURNING id, name, COALESCE(description, '') as description, is_active, created_at
    `;

    const result = await pool.query(sql, [cleanName, description || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Categoría no encontrada o ya está desactivada",
      });
    }

    console.log(`✅ Categoría actualizada:`, result.rows[0]);

    res.json({
      success: true,
      data: result.rows[0],
      message: "Categoría actualizada exitosamente",
    });
  } catch (err) {
    console.error("❌ Error PUT categories:", err);
    res.status(500).json({
      success: false,
      message: "Error al actualizar categoría",
      error: err.message,
    });
  }
});

// ✅ DELETE: Desactivar categoría
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;

    console.log(`🗑️ Desactivando categoría UUID: ${id}`);

    if (!id || id.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "ID de categoría inválido",
      });
    }

    // Verificar si la categoría existe y está activa
    const checkCategory = await pool.query(
      "SELECT id, name FROM categories WHERE id = $1 AND is_active = true",
      [id],
    );

    if (checkCategory.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Categoría no encontrada o ya está desactivada",
      });
    }

    // Contar productos asociados
    const checkProducts = await pool.query(
      "SELECT COUNT(*) as total FROM products WHERE category_id = $1 AND is_active = true",
      [id],
    );

    const productCount = parseInt(checkProducts.rows[0].total);
    console.log(`📦 Productos asociados activos: ${productCount}`);

    // Si hay productos, actualizarlos a NULL (sin categoría)
    if (productCount > 0) {
      console.log(
        `🔄 Actualizando ${productCount} productos a "sin categoría"...`,
      );
      await pool.query(
        "UPDATE products SET category_id = NULL WHERE category_id = $1 AND is_active = true",
        [id],
      );
      console.log(`✅ ${productCount} productos actualizados a sin categoría`);
    }

    // Desactivar la categoría
    await pool.query(
      "UPDATE categories SET is_active = false WHERE id = $1 AND is_active = true",
      [id],
    );

    const message =
      productCount > 0
        ? `Categoría desactivada exitosamente. ${productCount} producto(s) quedaron sin categoría.`
        : "Categoría desactivada exitosamente";

    console.log(`✅ Categoría UUID ${id} desactivada`);

    res.json({
      success: true,
      message: message,
      productsUpdated: productCount,
    });
  } catch (err) {
    console.error("❌ Error DELETE categories:", err);
    res.status(500).json({
      success: false,
      message: "Error al desactivar categoría",
      error: err.message,
    });
  }
});

export default router;

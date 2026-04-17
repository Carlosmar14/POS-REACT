import express from "express";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

// GET: Obtener categorías activas
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, description, is_active, created_at FROM categories WHERE is_active = true ORDER BY name ASC",
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error categories GET:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al obtener categorías" });
  }
});

// POST: Crear categoría
router.post("/", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length < 2) {
      return res
        .status(400)
        .json({ success: false, message: "Nombre muy corto" });
    }

    const result = await pool.query(
      "INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id, name, description, is_active, created_at",
      [name.trim(), description ? description.trim() : null],
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Categoría creada",
    });
  } catch (error) {
    console.error("Error categories POST:", error);
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ success: false, message: "Nombre ya existe" });
    }
    res
      .status(500)
      .json({ success: false, message: "Error al crear categoría" });
  }
});

// PUT: Actualizar categoría
router.put("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || name.trim().length < 2) {
      return res
        .status(400)
        .json({ success: false, message: "Nombre muy corto" });
    }

    const result = await pool.query(
      "UPDATE categories SET name = $1, description = $2, updated_at = NOW() WHERE id = $3 AND is_active = true RETURNING id, name, description, is_active, updated_at",
      [name.trim(), description ? description.trim() : null, id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Categoría no encontrada" });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: "Categoría actualizada",
    });
  } catch (error) {
    console.error("Error categories PUT:", error);
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ success: false, message: "Nombre ya existe" });
    }
    res
      .status(500)
      .json({ success: false, message: "Error al actualizar categoría" });
  }
});

// DELETE: Desactivar categoría
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si hay productos asociados
    const check = await pool.query(
      "SELECT COUNT(*) as total FROM products WHERE category_id = $1 AND is_active = true",
      [id],
    );
    if (parseInt(check.rows[0].total) > 0) {
      return res
        .status(400)
        .json({ success: false, message: "Hay productos asociados" });
    }

    const result = await pool.query(
      "UPDATE categories SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id",
      [id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Categoría no encontrada" });
    }

    res.json({ success: true, message: "Categoría desactivada" });
  } catch (error) {
    console.error("Error categories DELETE:", error);
    res
      .status(500)
      .json({ success: false, message: "Error al desactivar categoría" });
  }
});

export default router;

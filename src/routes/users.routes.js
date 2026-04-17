// backend/src/routes/users.routes.js
import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { verifyToken, requireRole } from "../middlewares/auth.js";

const router = express.Router();

// ✅ GET - Listar todos los usuarios (INCLUYE login_attempts y locked_until)
router.get("/", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, created_at, 
              login_attempts, locked_until 
       FROM users 
       ORDER BY created_at DESC`,
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("❌ Error en GET /users:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al cargar usuarios" });
  }
});

// ✅ GET - Obtener un usuario por ID
router.get("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id, name, email, role, is_active, created_at, 
              login_attempts, locked_until 
       FROM users WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("❌ Error en GET /users/:id:", err);
    res
      .status(500)
      .json({ success: false, message: "Error al cargar usuario" });
  }
});

// ✅ POST - Crear usuario
router.post("/", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name?.trim() || !email?.trim() || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Todos los campos son requeridos",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "La contraseña debe tener al menos 6 caracteres",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, login_attempts, created_at) 
       VALUES (gen_random_uuid(), $1, $2, $3, $4, true, 0, NOW()) 
       RETURNING id, name, email, role, is_active, login_attempts, locked_until, created_at`,
      [name.trim(), email.trim(), hashedPassword, role],
    );

    res.status(201).json({
      success: true,
      message: "Usuario creado exitosamente",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error al crear usuario:", err);
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "El email ya está registrado",
      });
    }
    res
      .status(500)
      .json({ success: false, message: "Error interno al crear usuario" });
  }
});

// ✅ PUT - Editar usuario (Nombre, Email, Rol)
router.put("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    if (!name?.trim() || !email?.trim() || !role) {
      return res.status(400).json({
        success: false,
        message: "Nombre, email y rol son obligatorios",
      });
    }

    const result = await pool.query(
      `UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4 
       RETURNING id, name, email, role, is_active, login_attempts, locked_until`,
      [name.trim(), email.trim(), role, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    res.json({
      success: true,
      message: "Usuario actualizado correctamente",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error al editar usuario:", err);
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "El email ya está en uso por otro usuario",
      });
    }
    res
      .status(500)
      .json({ success: false, message: "Error al actualizar usuario" });
  }
});

// ✅ PUT - Cambiar contraseña
router.put(
  "/:id/password",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "La contraseña debe tener al menos 6 caracteres",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id`,
        [hashedPassword, id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        message: "Contraseña actualizada correctamente",
      });
    } catch (err) {
      console.error("❌ Error al cambiar contraseña:", err);
      res.status(500).json({
        success: false,
        message: "Error al actualizar contraseña",
      });
    }
  },
);

// ✅ PUT - Activar/Desactivar usuario
router.put(
  "/:id/status",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { is_active } = req.body;

      if (typeof is_active !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "El estado debe ser true o false",
        });
      }

      const result = await pool.query(
        `UPDATE users SET is_active = $1 WHERE id = $2 
       RETURNING id, name, email, role, is_active, login_attempts, locked_until`,
        [is_active, id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        message: `Usuario ${is_active ? "activado" : "desactivado"} correctamente`,
        data: result.rows[0],
      });
    } catch (err) {
      console.error("❌ Error al cambiar estado:", err);
      res.status(500).json({
        success: false,
        message: "Error al cambiar estado del usuario",
      });
    }
  },
);

// ✅ POST - Desbloquear usuario (resetear intentos y locked_until)
router.post(
  "/:id/unlock",
  verifyToken,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `UPDATE users 
       SET login_attempts = 0, locked_until = NULL 
       WHERE id = $1 
       RETURNING id, name, email, login_attempts, locked_until`,
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        message: `Usuario "${result.rows[0].name}" desbloqueado correctamente`,
        data: result.rows[0],
      });
    } catch (err) {
      console.error("❌ Error al desbloquear usuario:", err);
      res.status(500).json({
        success: false,
        message: "Error al desbloquear usuario",
      });
    }
  },
);

// ✅ DELETE - Eliminar usuario
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el usuario existe
    const userCheck = await pool.query(
      `SELECT id, name, email FROM users WHERE id = $1`,
      [id],
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    // Verificar que no sea el último admin
    const adminCount = await pool.query(
      `SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = true`,
    );

    const userToDelete = userCheck.rows[0];
    const userRole = await pool.query(`SELECT role FROM users WHERE id = $1`, [
      id,
    ]);

    if (
      userRole.rows[0]?.role === "admin" &&
      parseInt(adminCount.rows[0].count) <= 1
    ) {
      return res.status(400).json({
        success: false,
        message: "No se puede eliminar el último administrador del sistema",
      });
    }

    const result = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING id, name, email`,
      [id],
    );

    res.json({
      success: true,
      message: `Usuario "${result.rows[0].name}" eliminado correctamente`,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error al eliminar usuario:", err);
    if (err.code === "23503") {
      return res.status(409).json({
        success: false,
        message:
          "No se puede eliminar: tiene registros asociados (ventas, etc.)",
      });
    }
    res.status(500).json({
      success: false,
      message: "Error al eliminar usuario",
    });
  }
});

export default router;

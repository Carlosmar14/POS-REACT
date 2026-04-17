// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ============================================================================
// 📦 MIDDLEWARE
// ============================================================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ============================================================================
// 📁 CONFIGURACIÓN DE MULTER PARA UPLOADS
// ============================================================================
const uploadDir = path.join(__dirname, "public/uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "img-" + unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const ok = /jpe?g|png|webp/i.test(file.mimetype);
  cb(ok ? null : new Error("Solo imágenes JPG, PNG o WEBP"), ok);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// ============================================================================
// 🏥 HEALTH CHECK
// ============================================================================
app.get("/api/health", (req, res) =>
  res.json({
    success: true,
    message: "API OK",
    time: new Date().toISOString(),
    version: "2.0.0",
  }),
);

// ============================================================================
// 📦 IMPORTAR RUTAS DINÁMICAMENTE
// ============================================================================
const importRoute = async (routePath, routeName) => {
  try {
    console.log(`🔄 Cargando ruta: ${routePath}`);
    const mod = await import(routePath);

    if (!mod?.default) {
      throw new Error("El módulo no exporta un router por defecto");
    }

    console.log(`✅ Ruta cargada: ${routeName}`);
    return mod.default;
  } catch (err) {
    console.error(`❌ ERROR CRÍTICO al cargar ${routeName}:`, {
      message: err.message,
      code: err.code,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });

    const router = express.Router();
    router.use((req, res) =>
      res.status(503).json({
        success: false,
        message: `${routeName} no disponible`,
        error: err.message,
        hint: "Revisa la consola del servidor para más detalles",
      }),
    );
    return router;
  }
};

// ============================================================================
// 🚀 INICIALIZACIÓN ASÍNCRONA DEL SERVIDOR
// ============================================================================
(async () => {
  try {
    const [
      authRoutes,
      productRoutes,
      categoryRoutes,
      saleRoutes,
      userRoutes,
      reportRoutes,
      logRoutes,
      configuracionRoutes,
    ] = await Promise.all([
      importRoute("./src/routes/auth.routes.js", "auth"),
      importRoute("./src/routes/products.routes.js", "products"),
      importRoute("./src/routes/categories.routes.js", "categories"),
      importRoute("./src/routes/sales.routes.js", "sales"),
      importRoute("./src/routes/users.routes.js", "users"),
      importRoute("./src/routes/reports.routes.js", "reports"),
      importRoute("./src/routes/logs.routes.js", "logs"),
      importRoute("./src/routes/configuracion.routes.js", "configuracion"),
    ]);

    // ============================================================================
    // 🗂️ REGISTRO DE RUTAS
    // ============================================================================
    app.use("/api/auth", authRoutes);
    app.use("/api/configuracion", configuracionRoutes);
    app.use("/api/products", productRoutes);
    app.use("/api/categories", categoryRoutes);
    app.use("/api/sales", saleRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/reports", reportRoutes);
    app.use("/api/logs", logRoutes);

    app.get("/api/test", (req, res) => {
      res.json({
        success: true,
        message: "Backend funcionando correctamente",
        timestamp: new Date().toISOString(),
        routes: {
          auth: "/api/auth/login",
          configuracion: "/api/configuracion",
          products: "/api/products",
          sales: "/api/sales",
        },
      });
    });

    // ============================================================================
    // ❌ 404 Handler
    // ============================================================================
    app.use((req, res) => {
      console.log(`❌ Ruta no encontrada: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        success: false,
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
        availableRoutes: [
          "/api/auth/login",
          "/api/auth/me",
          "/api/auth/2fa/setup",
          "/api/auth/2fa/verify",
          "/api/configuracion",
          "/api/configuracion/reset",
          "/api/products",
          "/api/sales",
          "/api/sales/stats",
          "/api/test",
          "/api/health",
        ],
      });
    });

    // ============================================================================
    // ⚠️ Error Handler Global
    // ============================================================================
    app.use((err, req, res, next) => {
      console.error("❌ Error global:", err.name, err.message);

      if (err instanceof multer.MulterError) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Error de archivo: ${err.message}`,
          });
      }

      if (err.name === "ZodError") {
        return res.status(400).json({
          success: false,
          message: "Error de validación",
          errors: err.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
        });
      }

      if (
        err.name === "JsonWebTokenError" ||
        err.name === "TokenExpiredError"
      ) {
        return res.status(401).json({
          success: false,
          message: "Token de autenticación inválido o expirado",
        });
      }

      res.status(err.status || 500).json({
        success: false,
        message: err.message || "Error interno del servidor",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
      });
    });

    // ============================================================================
    // 🎧 INICIAR SERVIDOR
    // ============================================================================
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`\n✅ POS Backend corriendo en http://localhost:${PORT}`);
      console.log(`📁 Uploads: http://localhost:${PORT}/uploads/`);
      console.log(
        `🔧 Configuración: http://localhost:${PORT}/api/configuracion`,
      );
      console.log(`🔐 2FA: http://localhost:${PORT}/api/auth/2fa/setup`);
      console.log(`🏥 Health: http://localhost:${PORT}/api/health\n`);
    });
  } catch (err) {
    console.error("❌ ERROR FATAL al iniciar servidor:", err);
    process.exit(1);
  }
})();

export default app;

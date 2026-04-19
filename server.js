// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ============================================================================
// 🛡️ 1. SEGURIDAD: HELMET (CSP CONFIGURADA PARA IMÁGENES LOCALES)
// ============================================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "http://localhost:3000"],
        connectSrc: [
          "'self'",
          "http://localhost:3000",
          "http://localhost:5173",
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// ============================================================================
// 🌐 2. CORS (DESPUÉS DE HELMET)
// ============================================================================
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
// 🚦 3. RATE LIMITING (RELAJADO PARA DESARROLLO)
// ============================================================================
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 1000, // 1000 peticiones por minuto
  message: {
    success: false,
    message: "Demasiadas peticiones desde esta IP, intenta más tarde.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const skipPaths = [
      "/api/license/status",
      "/api/health",
      "/api/auth/update-activity",
      "/api/products",
      "/uploads", // Excluir imágenes del límite
    ];
    return skipPaths.some((p) => req.path.startsWith(p));
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
});

app.use("/api/", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/license/activate", authLimiter);

// ============================================================================
// 📦 4. MIDDLEWARE GENERAL (PARSERS)
// ============================================================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============================================================================
// 📁 5. CONFIGURACIÓN DE MULTER Y ARCHIVOS ESTÁTICOS (CON CABECERAS CORRECTAS)
// ============================================================================
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`📁 Carpeta creada: ${uploadDir}`);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "img-" + unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const ok = /jpe?g|png|webp|gif/i.test(file.mimetype);
  cb(ok ? null : new Error("Solo imágenes JPG, PNG, WEBP o GIF"), ok);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ✅ MIDDLEWARE PARA SERVIR IMÁGENES CON CABECERAS CORS Y CORP CORRECTAS
app.use(
  "/uploads",
  (req, res, next) => {
    // Permite que la imagen sea cargada desde cualquier origen (necesario para localhost:5173 -> localhost:3000)
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    // Cache de 1 día para mejorar rendimiento
    res.setHeader("Cache-Control", "public, max-age=86400");
    next();
  },
  express.static(uploadDir),
);

console.log(`📁 Sirviendo archivos estáticos desde: ${uploadDir}`);

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
    // ✅ Cargar todas las rutas
    const [
      authRoutes,
      productRoutes,
      categoryRoutes,
      saleRoutes,
      userRoutes,
      reportRoutes,
      logRoutes,
      configuracionRoutes,
      licenseRoutes,
    ] = await Promise.all([
      importRoute("./src/routes/auth.routes.js", "auth"),
      importRoute("./src/routes/products.routes.js", "products"),
      importRoute("./src/routes/categories.routes.js", "categories"),
      importRoute("./src/routes/sales.routes.js", "sales"),
      importRoute("./src/routes/users.routes.js", "users"),
      importRoute("./src/routes/reports.routes.js", "reports"),
      importRoute("./src/routes/logs.routes.js", "logs"),
      importRoute("./src/routes/configuracion.routes.js", "configuracion"),
      importRoute("./src/routes/license.routes.js", "license"),
    ]);

    // ✅ Cargar middleware de licencia
    const { requireLicense } =
      await import("./src/middlewares/licenseMiddleware.js");
    console.log("✅ Middleware de licencia cargado");

    // ✅ Cargar monitor de licencia
    const { startLicenseMonitor } =
      await import("./src/services/licenseMonitor.js");
    console.log("✅ Monitor de licencia cargado");

    // ============================================================================
    // 🗂️ REGISTRO DE RUTAS
    // ============================================================================

    // ✅ Rutas PÚBLICAS (no requieren licencia)
    app.use("/api/auth", authRoutes);
    app.use("/api/license", licenseRoutes);

    // ✅ Middleware de licencia - Protege TODAS las rutas siguientes
    app.use("/api", requireLicense);

    // ✅ Rutas PROTEGIDAS (requieren licencia válida)
    app.use("/api/configuracion", configuracionRoutes);
    app.use("/api/products", productRoutes);
    app.use("/api/categories", categoryRoutes);
    app.use("/api/sales", saleRoutes);
    app.use("/api/users", userRoutes);
    app.use("/api/reports", reportRoutes);
    app.use("/api/logs", logRoutes);

    // ============================================================================
    // 🧪 RUTA DE PRUEBA
    // ============================================================================
    app.get("/api/test", (req, res) => {
      res.json({
        success: true,
        message: "Backend funcionando correctamente",
        timestamp: new Date().toISOString(),
        license: req.license || null,
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
      });
    });

    // ============================================================================
    // ⚠️ Error Handler Global
    // ============================================================================
    app.use((err, req, res, next) => {
      console.error("❌ Error global:", err.name, err.message);

      if (err instanceof multer.MulterError) {
        return res.status(400).json({
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
      console.log(`📁 Uploads servidos desde: ${uploadDir}`);
      console.log(
        `🔧 Configuración: http://localhost:${PORT}/api/configuracion`,
      );
      console.log(`🔐 2FA: http://localhost:${PORT}/api/auth/2fa/setup`);
      console.log(`🔑 Licencia: http://localhost:${PORT}/api/license/status`);
      console.log(`🏥 Health: http://localhost:${PORT}/api/health\n`);

      // ✅ Iniciar monitor de licencia DESPUÉS de que el servidor esté corriendo
      startLicenseMonitor();
      console.log("🔐 Monitor de licencia iniciado\n");
    });
  } catch (err) {
    console.error("❌ ERROR FATAL al iniciar servidor:", err);
    process.exit(1);
  }
})();

export default app;

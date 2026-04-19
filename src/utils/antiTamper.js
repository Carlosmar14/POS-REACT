// backend/src/utils/antiTamper.js

// ✅ Detectar si hay un debugger adjunto
export const detectDebugger = () => {
  const start = Date.now();
  debugger; // Solo pausa si hay debugger
  const diff = Date.now() - start;
  return diff > 50;
};

// ✅ Verificar integridad básica (anti-tampering simple)
export const verifyEnvironment = () => {
  const checks = [];
  
  // Verificar que no estamos en modo debug de Node
  if (process.env.NODE_OPTIONS?.includes('--inspect') || 
      process.env.NODE_OPTIONS?.includes('--debug')) {
    checks.push("Debug mode detected");
  }
  
  // Verificar variables de entorno críticas
  if (!process.env.LICENSE_SECRET) {
    checks.push("Missing LICENSE_SECRET");
  }
  
  return checks;
};

// ✅ Iniciar monitor anti-tampering
export const startAntiTamperMonitor = () => {
  // Verificar al inicio
  const issues = verifyEnvironment();
  if (issues.length > 0) {
    console.warn("⚠️ Advertencias de seguridad:", issues.join(", "));
  }
  
  // Verificar periódicamente (cada 10 minutos)
  setInterval(() => {
    if (detectDebugger()) {
      console.error("🔴 DEBUGGER DETECTADO - Posible intento de manipulación");
      // Opcional: Cerrar el sistema después de un tiempo
    }
  }, 10 * 60 * 1000);
};
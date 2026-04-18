// backend/src/utils/hardwareId.js
import os from "os";
import crypto from "crypto";

export const getMachineId = () => {
  const parts = [];
  
  // MAC Address
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
        parts.push(iface.mac.replace(/:/g, ""));
        break;
      }
    }
    if (parts.length > 0) break;
  }
  
  // Hostname
  parts.push(os.hostname());
  
  // CPU Model
  const cpus = os.cpus();
  if (cpus.length > 0) {
    parts.push(cpus[0].model.replace(/\s+/g, ""));
  }
  
  // Total Memory
  parts.push(os.totalmem().toString());
  
  // Si no se pudo obtener nada, usar un fallback
  if (parts.length === 0) {
    parts.push(os.platform() + os.arch() + os.homedir());
  }
  
  const combined = parts.join("|");
  return crypto.createHash("sha256").update(combined).digest("hex").substring(0, 32);
};
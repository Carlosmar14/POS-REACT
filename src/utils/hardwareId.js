// backend/src/utils/hardwareId.js
import os from "os";
import crypto from "crypto";
import { execSync } from "child_process";
import fs from "fs";

const getMotherboardUUID = () => {
  try {
    if (process.platform === "win32") {
      const output = execSync("wmic csproduct get uuid", {
        encoding: "utf8",
        windowsHide: true,
      });
      const lines = output.split("\n").filter((l) => l.trim());
      return lines[1]?.trim() || "UNKNOWN_MB";
    } else {
      // Linux: leer /sys/class/dmi/id/product_uuid
      const uuid = fs
        .readFileSync("/sys/class/dmi/id/product_uuid", "utf8")
        .trim();
      if (uuid && uuid.length > 10) return uuid;
      return "UNKNOWN_MB";
    }
  } catch {
    return "UNKNOWN_MB";
  }
};

const getMacAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    if (
      name.toLowerCase().includes("virtual") ||
      name.toLowerCase().includes("loopback")
    )
      continue;
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
        return iface.mac.replace(/[:-]/g, "").toUpperCase();
      }
    }
  }
  return "UNKNOWN_MAC";
};

export const getMachineId = () => {
  const factors = [getMotherboardUUID(), getMacAddress()];
  const combined = factors.join("|");
  return crypto
    .createHash("sha512")
    .update(combined)
    .digest("hex")
    .substring(0, 48);
};

export const getMachineHash = () => {
  return crypto.createHash("md5").update(getMachineId()).digest("hex");
};

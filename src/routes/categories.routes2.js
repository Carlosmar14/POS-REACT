import express from "express";
const router = express.Router();
router.get("/", (req, res) => res.json({ success: true, data: [] }));
router.post("/", (req, res) =>
  res.status(201).json({ success: true, message: "Creado" }),
);
router.put("/:id", (req, res) =>
  res.json({ success: true, message: "Actualizado" }),
);
router.delete("/:id", (req, res) =>
  res.json({ success: true, message: "Eliminado" }),
);
export default router;

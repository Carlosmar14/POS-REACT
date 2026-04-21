import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import api from "../api";
import Swal from "sweetalert2";
import Barcode from "react-barcode";
import LoaderPOS from "../components/LoaderPOS";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Upload,
  Search,
  Package,
  Image as ImageIcon,
  Download,
} from "lucide-react";

export default function Productos() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState(null);

  const [form, setForm] = useState({
    sku: "",
    name: "",
    cost_price: "",
    sale_price: "",
    stock: "",
    category_id: "",
    image: null,
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get("/products");
      if (res.data?.success && Array.isArray(res.data.data)) {
        setProducts(res.data.data);
      }
    } catch (err) {
      console.error("❌ Error fetching products:", err);
      if (err.response?.status === 401) {
        Swal.fire({
          title: "⚠️ Sesión expirada",
          text: "Por favor, inicia sesión nuevamente",
          icon: "warning",
          confirmButtonText: "Ir al login",
          customClass: { popup: "rounded-2xl shadow-2xl" },
        }).then(() => (window.location.href = "/login"));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/categories");
      if (res.data?.success && Array.isArray(res.data.data)) {
        setCategories(res.data.data);
      }
    } catch (err) {
      console.error("❌ Error fetching categories:", err);
    }
  };

  const openModal = (product = null) => {
    if (product) {
      setEditing(product);
      setForm({
        sku: product.sku,
        name: product.name,
        cost_price: product.cost_price,
        sale_price: product.sale_price,
        stock: product.stock,
        category_id: product.category_id || "",
        image: null,
      });
      setPreview(
        product.image_url ? `http://localhost:3000${product.image_url}` : null,
      );
    } else {
      setEditing(null);
      setForm({
        sku: "",
        name: "",
        cost_price: "",
        sale_price: "",
        stock: "",
        category_id: "",
        image: null,
      });
      setPreview(null);
    }
    setModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, image: file });
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !form.sku ||
      !form.name ||
      !form.cost_price ||
      !form.sale_price ||
      !form.stock
    ) {
      Swal.fire(
        "⚠️ Campos requeridos",
        "Completa todos los campos obligatorios",
        "warning",
      );
      return;
    }

    setLoading(true);
    const fd = new FormData();
    fd.append("sku", form.sku);
    fd.append("name", form.name);
    fd.append("cost_price", form.cost_price);
    fd.append("sale_price", form.sale_price);
    fd.append("stock", form.stock);
    if (form.category_id) fd.append("category_id", form.category_id);
    if (form.image) fd.append("image", form.image);

    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        Swal.fire(
          "Actualizado",
          "Producto actualizado correctamente",
          "success",
        );
      } else {
        await api.post("/products", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        Swal.fire("Creado", "Producto creado correctamente", "success");
      }
      setModal(false);
      fetchProducts();
    } catch (err) {
      Swal.fire(
        "❌ Error",
        err.response?.data?.message || "Error al guardar",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ FUNCIÓN PARA DESCARGAR CÓDIGO DE BARRAS COMO PNG
  const downloadBarcode = async (value, productName) => {
    try {
      // Usar API pública para generar PNG del código de barras
      const url = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(value)}&scale=3&width=2&height=50&includetext=true&textxalign=center`;

      // Fetch de la imagen como blob
      const response = await fetch(url);
      const blob = await response.blob();

      // Crear enlace de descarga
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `barcode-${value}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      // Feedback visual
      Swal.fire({
        title: "Descargado",
        text: `Código de barras de "${productName}" guardado`,
        icon: "success",
        timer: 1500,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("❌ Error descargando barcode:", err);
      Swal.fire(
        "❌ Error",
        "No se pudo descargar el código de barras",
        "error",
      );
    }
  };

  const handleDelete = async (id, productName) => {
    const result = await Swal.fire({
      title: "¿Desactivar producto?",
      html: `¿Estás seguro de desactivar <strong>"${productName}"</strong>?<br><br><span style="color:#6b7280;font-size:14px">Esta acción no se puede deshacer.</span>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, desactivar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#f3f4f6",
      cancelButtonTextColor: "#374151",
      reverseButtons: true,
      focusCancel: true,
      customClass: {
        popup: "rounded-2xl shadow-2xl border border-gray-200 p-6",
        title: "text-xl font-bold text-gray-900 mb-2",
        htmlContainer: "text-gray-600",
        confirmButton:
          "px-6 py-3 rounded-xl font-semibold transition-all hover:opacity-90",
        cancelButton:
          "px-6 py-3 rounded-xl font-semibold transition-all hover:bg-gray-200",
      },
      didOpen: () => {
        const confirmBtn = Swal.getConfirmButton();
        const cancelBtn = Swal.getCancelButton();
        if (confirmBtn)
          confirmBtn.style.cssText =
            "background: #dc2626; color: white; padding: 12px 24px; border-radius: 12px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2);";
        if (cancelBtn)
          cancelBtn.style.cssText =
            "background: #f3f4f6; color: #374151; padding: 12px 24px; border-radius: 12px; font-weight: 600; border: 1px solid #d1d5db; box-shadow: 0 1px 3px rgba(0,0,0,0.05);";
      },
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/products/${id}`);
      Swal.fire(
        "✅ Desactivado",
        "Producto desactivado correctamente",
        "success",
      );
      fetchProducts();
    } catch (err) {
      Swal.fire(
        "❌ Error",
        err.response?.data?.message || "Error al desactivar",
        "error",
      );
    }
  };

  const filtered = products.filter(
    (p) =>
      p?.name?.toLowerCase().includes(search.toLowerCase()) ||
      p?.sku?.toLowerCase().includes(search),
  );

  // ✅ Reemplazamos el spinner manual por LoaderPOS
  if (loading && products.length === 0) {
    return <LoaderPOS message="Cargando productos..." />;
  }

  // ✅ MODAL ESTILO SWEETALERT2
  const ModalContent = (
    <>
      <div
        className="fixed inset-0 z-[9999] bg-black/40 animate-fadeIn"
        onClick={() => setModal(false)}
      />
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="relative bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col animate-scaleIn overflow-hidden pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">
              {editing ? "✏️ Editar Producto" : "➕ Nuevo Producto"}
            </h2>
            <button
              onClick={() => setModal(false)}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
          <div className="overflow-y-auto p-5 flex-1">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="input-group">
                  <label className="label">SKU *</label>
                  <input
                    required
                    className="input"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="Ej: SKU-001"
                  />
                </div>
                <div className="input-group">
                  <label className="label">Nombre *</label>
                  <input
                    required
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Coca-Cola 500ml"
                  />
                </div>
                <div className="input-group">
                  <label className="label">Costo *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input"
                    value={form.cost_price}
                    onChange={(e) =>
                      setForm({ ...form, cost_price: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="input-group">
                  <label className="label">Precio Venta *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input"
                    value={form.sale_price}
                    onChange={(e) =>
                      setForm({ ...form, sale_price: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="input-group">
                  <label className="label">Stock *</label>
                  <input
                    type="number"
                    required
                    className="input"
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="input-group">
                  <label className="label">Categoría</label>
                  <select
                    className="input"
                    value={form.category_id}
                    onChange={(e) =>
                      setForm({ ...form, category_id: e.target.value })
                    }
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 input-group">
                  <label className="label">Imagen del Producto</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all flex-1">
                      <Upload className="text-gray-400" size={20} />
                      <span className="text-sm text-gray-600">
                        {form.image ? form.image.name : "Seleccionar imagen"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    {preview && (
                      <div className="w-20 h-20 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0 shadow-sm">
                        <img
                          src={preview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? "Guardando..."
                    : editing
                      ? "Actualizar"
                      : "Guardar Producto"}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="btn-secondary px-6"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gestión de Productos
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Administra inventario, precios y códigos de barras
          </p>
        </div>
        <button onClick={() => openModal()} className="btn-primary">
          <Plus size={18} /> Nuevo Producto
        </button>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-icon"
          />
        </div>
      </div>

      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Categoría</th>
                <th>Precio</th>
                <th>Stock</th>
                {/* ✅ CÓDIGO DE BARRAS ANTES DE ACCIONES */}
                <th>Código de Barras</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-blue-50/40 transition-colors"
                  >
                    <td className="font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                          {p.image_url ? (
                            <img
                              src={`http://localhost:3000${p.image_url}`}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => (e.target.style.display = "none")}
                            />
                          ) : (
                            <ImageIcon className="text-gray-400" size={18} />
                          )}
                        </div>
                        <span className="truncate max-w-[150px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-gray-500">{p.sku}</td>
                    <td>
                      <span className="badge badge-info">
                        {p.category_name || "Sin categoría"}
                      </span>
                    </td>
                    <td className="text-green-700 font-semibold">
                      ${parseFloat(p.sale_price).toFixed(2)}
                    </td>
                    <td>
                      <span
                        className={`badge ${p.stock > 10 ? "badge-success" : p.stock > 0 ? "badge-warning" : "badge-danger"}`}
                      >
                        {p.stock}
                      </span>
                    </td>

                    {/* ✅ COLUMNA DE CÓDIGO DE BARRAS CON BOTÓN DE DESCARGA */}
                    <td>
                      <div className="flex flex-col items-center gap-2">
                        {/* Código de barras visual */}
                        <div className="bg-white p-1.5 rounded border border-gray-200 shadow-sm">
                          <Barcode
                            value={p.barcode || p.sku}
                            format="CODE128"
                            width={1.5}
                            height={35}
                            displayValue={true}
                            fontSize={10}
                            background="transparent"
                            margin={0}
                          />
                        </div>

                        {/* ✅ Botón de descarga */}
                        <button
                          onClick={() =>
                            downloadBarcode(p.barcode || p.sku, p.name)
                          }
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-[10px] font-medium hover:bg-green-100 transition-colors cursor-pointer"
                          title="Descargar código de barras como PNG"
                        >
                          <Download size={12} />
                          <span>Descargar</span>
                        </button>
                      </div>
                    </td>

                    {/* ✅ Botones de acción */}
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal(p)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-105 transition-all duration-200 cursor-pointer shadow-sm"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:scale-105 transition-all duration-200 cursor-pointer shadow-sm"
                          title="Desactivar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-gray-500">
                    <Package className="mx-auto mb-3 opacity-40" size={40} />
                    <p>
                      {search
                        ? "No se encontraron resultados"
                        : "Sin productos registrados"}
                    </p>
                    {!search && (
                      <button
                        onClick={() => openModal()}
                        className="btn-primary mt-4 btn-sm"
                      >
                        <Plus size={14} /> Agregar primero
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ PORTAL: Modal renderizado fuera del Layout */}
      {modal && createPortal(ModalContent, document.body)}
    </div>
  );
}

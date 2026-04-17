// frontend/src/pages/HistorialStock.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../store/authStore";
import api from "../api";
import Swal from "sweetalert2";
import {
  Package,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  User,
  Filter,
  X,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

// ✅ SEPARAR URL de API y URL de UPLOADS para imágenes
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || "http://localhost:3000";

export default function HistorialStock() {
  const { user } = useAuth();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  // ✅ CORREGIDO: "pagination" sin espacio
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(false);
  // ✅ CORREGIDO: "filters" y "setFilters" sin espacios
  const [filters, setFilters] = useState({ start: "", end: "", productId: "" });
  const [summaryStats, setSummaryStats] = useState(null);
  const [form, setForm] = useState({
    productId: "",
    quantity: "",
    reason: "",
    movementType: "purchase",
  });

  const getTodayDate = () => new Date().toISOString().split("T")[0];

  // ✅ Función helper para construir URL de imágenes correctamente
  const getProductImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    // ✅ Usar UPLOADS_URL, no API_URL
    return `${UPLOADS_URL}${imageUrl.startsWith("/") ? imageUrl : "/" + imageUrl}`;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pagination.page, limit: 20 });
      if (filters.start) params.append("start", filters.start);
      if (filters.end) params.append("end", filters.end);
      if (filters.productId) params.append("productId", filters.productId);
      const res = await api.get(`/sales/stock-movements?${params.toString()}`);
      setMovements(res.data.data || []);
      setPagination(
        res.data.pagination || { page: 1, totalPages: 1, total: 0 },
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await api.get("/products");
      setProducts(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
      loadProducts();
    }
  }, [pagination.page, filters.start, filters.end, filters.productId]);

  useEffect(() => {
    if (movements.length > 0) {
      const entradas = movements
        .filter((m) => m.quantity > 0)
        .reduce((s, m) => s + m.quantity, 0);
      const salidas = movements
        .filter((m) => m.quantity < 0)
        .reduce((s, m) => s + Math.abs(m.quantity), 0);
      setSummaryStats({ entradas, salidas });
    }
  }, [movements]);

  // ✅ CORREGIDO: "=>" sin espacio
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  // ✅ CORREGIDO: "=>" sin espacio
  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(form.quantity);
    if (!form.productId || !qty)
      return Swal.fire("Error", "Selecciona producto y cantidad", "warning");
    try {
      await api.post("/sales/stock-movements", {
        productId: form.productId,
        quantity: form.movementType === "sale" ? -Math.abs(qty) : Math.abs(qty), // ✅ "sale" sin espacio
        reason: form.reason,
        movementType: form.movementType,
      });
      setModal(false);
      setForm({
        productId: "",
        quantity: "",
        reason: "",
        movementType: "purchase",
      });
      await loadData();
      Swal.fire({
        title: "✅ Movimiento registrado",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire("Error", "Error al registrar movimiento", "error");
    }
  };

  // Helpers para imágenes
  const getProductColor = (name) => {
    const colors = [
      "from-blue-500 to-blue-600",
      "from-green-500 to-green-600",
      "from-purple-500 to-purple-600",
      "from-pink-500 to-pink-600",
    ];
    return colors[(name?.length || 0) % colors.length];
  };

  const ProductImage = ({ imageUrl, productName }) => {
    const [imgError, setImgError] = useState(false);
    const colorClass = getProductColor(productName);
    const firstLetter = productName?.charAt(0).toUpperCase() || "?";
    if (!imageUrl || imgError)
      return (
        <div
          className={`w-12 h-12 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md`}
        >
          {firstLetter}
        </div>
      );
    return (
      <img
        // ✅ CORREGIDO: Usar getProductImageUrl con UPLOADS_URL
        src={getProductImageUrl(imageUrl)}
        alt={productName}
        className="w-12 h-12 object-cover rounded-xl border-2 border-gray-200"
        onError={() => setImgError(true)}
      />
    );
  };

  if (loading && movements.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={32} />
        <p className="text-gray-600">Cargando movimientos...</p>
      </div>
    );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-blue-600" size={28} /> Historial de Stock
          </h1>
          <p className="text-gray-500 mt-1">
            {user?.role === "admin"
              ? "Movimientos globales de inventario"
              : "Tus movimientos de stock"}
          </p>
        </div>
        <button
          onClick={() => {
            setModal(true);
            loadProducts();
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={16} /> Nuevo Movimiento
        </button>
      </div>

      {/* Paneles de resumen */}
      {summaryStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-green-100 text-sm font-medium">ENTRADAS</p>
                <p className="text-4xl font-bold mt-2">
                  {summaryStats.entradas}
                </p>
                <div className="flex items-center gap-1 mt-3 text-green-100">
                  <ArrowUpRight size={16} />
                  <span className="text-sm">Unidades ingresadas</span>
                </div>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <TrendingUp size={28} />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-red-100 text-sm font-medium">SALIDAS</p>
                <p className="text-4xl font-bold mt-2">
                  {summaryStats.salidas}
                </p>
                <div className="flex items-center gap-1 mt-3 text-red-100">
                  <ArrowDownRight size={16} />
                  <span className="text-sm">Unidades salidas</span>
                </div>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <TrendingDown size={28} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.start}
              // ✅ CORREGIDO: "=>" sin espacio
              onChange={(e) =>
                setFilters({ ...filters, start: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.end}
              onChange={(e) => setFilters({ ...filters, end: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Producto
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.productId}
              onChange={(e) =>
                setFilters({ ...filters, productId: e.target.value })
              }
            >
              <option value="">Todos los productos</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setPagination({ ...pagination, page: 1 });
                loadData();
              }}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <Search size={16} /> Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {movements.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 font-medium">
              No hay movimientos registrados
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-6 py-3">Producto</th>
                  <th className="px-6 py-3">Cantidad</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Motivo</th>
                  {user?.role === "admin" && (
                    <th className="px-6 py-3">Usuario</th>
                  )}
                  <th className="px-6 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map((m) => {
                  const product = products.find(
                    // ✅ CORREGIDO: Comparar UUIDs como strings
                    (p) => String(p.id) === String(m.product_id),
                  );
                  const imageUrl = product?.image_url || null;
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <ProductImage
                            imageUrl={imageUrl}
                            productName={m.product_name}
                          />
                          <span className="font-medium text-gray-900">
                            {m.product_name}
                          </span>
                        </div>
                      </td>
                      <td
                        className={`px-6 py-4 font-bold ${m.quantity > 0 ? "text-green-700" : "text-red-700"}`}
                      >
                        {m.quantity > 0 ? "+" : ""}
                        {m.quantity}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${m.movement_type === "sale" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}
                        >
                          {m.movement_type === "sale" ? "Salida" : "Entrada"}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 text-sm text-gray-600 truncate max-w-[200px]"
                        title={m.reason}
                      >
                        {m.reason || "-"}
                      </td>
                      {user?.role === "admin" && (
                        <td className="px-6 py-4 text-sm flex items-center gap-1 text-gray-700">
                          <User size={12} className="text-gray-400" />{" "}
                          {m.user_name || "Sistema"}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(m.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
          <div className="text-sm text-gray-600">
            Mostrando {movements.length} de {pagination.total} registros
          </div>
          <div className="flex items-center gap-4">
            <button
              disabled={pagination.page === 1}
              onClick={() =>
                setPagination({ ...pagination, page: pagination.page - 1 })
              }
              className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={18} /> Anterior
            </button>
            <span className="text-sm text-gray-600">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page === pagination.totalPages}
              onClick={() =>
                setPagination({ ...pagination, page: pagination.page + 1 })
              }
              className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
            >
              Siguiente <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Nuevo Movimiento */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                Nuevo Movimiento de Stock
              </h2>
              <button
                onClick={() => setModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Producto *
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.productId}
                  onChange={(e) =>
                    setForm({ ...form, productId: e.target.value })
                  }
                >
                  <option value="">Seleccionar...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Movimiento *
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.movementType}
                  onChange={(e) =>
                    setForm({ ...form, movementType: e.target.value })
                  }
                >
                  <option value="purchase">Entrada (Compra)</option>
                  <option value="sale">Salida (Venta)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                  placeholder="Ej: 50"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {form.movementType === "sale"
                    ? "⚠️ Se restará del stock"
                    : "✅ Se sumará al stock"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo / Observaciones
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Ej: Reposición semanal"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Registrar Movimiento
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

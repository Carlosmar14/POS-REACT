// frontend/src/pages/Categorias.jsx
import { useState, useEffect, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Package,
  AlertTriangle,
  Search,
  Tag,
  Layers,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

export default function Categorias() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // ✅ Cargar categorías y productos para contar
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Cargar categorías
      const [catRes, prodRes] = await Promise.all([
        api.get("/categories"),
        api.get("/products"),
      ]);
      setCategories(catRes.data.data || []);
      setProducts(prodRes.data.data || []);
    } catch (err) {
      console.error("❌ Error cargando datos:", err);
      setError("No se pudieron cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Calcular productos por categoría (memoizado para rendimiento)
  const productsByCategory = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      if (p.is_active !== false) {
        const catId = p.category_id || "uncategorized";
        counts[catId] = (counts[catId] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  // ✅ Filtrar categorías por búsqueda
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(term) ||
        cat.description?.toLowerCase().includes(term),
    );
  }, [categories, searchTerm]);

  // ✅ Colores dinámicos para categorías
  const getCategoryColor = (index) => {
    const colors = [
      "from-blue-500 to-blue-600",
      "from-emerald-500 to-emerald-600",
      "from-violet-500 to-violet-600",
      "from-amber-500 to-amber-600",
      "from-rose-500 to-rose-600",
      "from-cyan-500 to-cyan-600",
      "from-fuchsia-500 to-fuchsia-600",
      "from-lime-500 to-lime-600",
    ];
    return colors[index % colors.length];
  };

  const openModal = (cat = null) => {
    setEditing(cat);
    setForm(
      cat
        ? { name: cat.name, description: cat.description || "" }
        : { name: "", description: "" },
    );
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      if (editing) {
        await api.put(`/categories/${editing.id}`, form);
        setModal(false);
        await loadData();
        Swal.fire({
          title: "¡Categoría actualizada!",
          text: `"${form.name}" se ha actualizado correctamente.`,
          icon: "success",
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
        });
      } else {
        await api.post("/categories", form);
        setModal(false);
        await loadData();
        Swal.fire({
          title: "¡Categoría creada!",
          text: `"${form.name}" se ha creado correctamente.`,
          icon: "success",
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error al guardar categoría");
    }
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: "¿Desactivar categoría?",
      text: `¿Estás seguro de que deseas desactivar "${name}"? Los productos asociados quedarán sin categoría.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, desactivar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/categories/${id}`);
      await loadData();
      Swal.fire({
        title: "¡Categoría desactivada!",
        text: `"${name}" ha sido desactivada correctamente.`,
        icon: "success",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (err) {
      Swal.fire({
        title: "Error",
        text: err.response?.data?.message || "Error al desactivar categoría",
        icon: "error",
        confirmButtonColor: "#dc3545",
        confirmButtonText: "Aceptar",
      });
    }
  };

  // ✅ Componente de tarjeta de categoría mejorada
  const CategoryCard = ({ cat, index }) => {
    const productCount = productsByCategory[cat.id] || 0;
    const colorClass = getCategoryColor(index);
    const firstLetter = cat.name?.charAt(0).toUpperCase() || "?";

    return (
      <div className="group relative bg-white rounded-2xl border-2 border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden">
        {/* Barra de color superior */}
        <div className={`h-1.5 bg-gradient-to-r ${colorClass}`} />

        <div className="p-5">
          {/* Header con icono y nombre */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:scale-110 transition-transform`}
              >
                {firstLetter}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg leading-tight">
                  {cat.name}
                </h3>
                {cat.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {cat.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Stats: Productos */}
          <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Package size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Productos activos</p>
              <p className="text-lg font-bold text-gray-900">
                {productCount}{" "}
                <span className="text-xs font-normal text-gray-400">
                  {productCount === 1 ? "producto" : "productos"}
                </span>
              </p>
            </div>
          </div>

          {/* Badge de estado */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                cat.is_active !== false
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {cat.is_active !== false ? "● Activa" : "○ Inactiva"}
            </span>
            <span className="text-xs text-gray-400 font-mono">
              ID: {cat.id?.slice(0, 6)}...
            </span>
          </div>

          {/* Acciones */}
          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button
              onClick={() => openModal(cat)}
              className="flex-1 py-2.5 px-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
            >
              <Edit size={14} /> Editar
            </button>
            <button
              onClick={() => handleDelete(cat.id, cat.name)}
              className="flex-1 py-2.5 px-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </div>

        {/* Hover indicator */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight
            size={16}
            className="text-gray-400 group-hover:text-blue-500"
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          <Layers
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-500"
            size={20}
          />
        </div>
        <span className="text-gray-500 mt-4 font-medium">
          Cargando categorías...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header mejorado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tag className="text-blue-600" size={28} />
            Gestión de Categorías
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Organiza tus productos por grupos •{" "}
            <span className="font-medium text-blue-600">
              {categories.length} categorías
            </span>
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
        >
          <Plus size={18} /> Nueva Categoría
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Buscar categoría por nombre o descripción..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Error global */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700">
          <AlertTriangle size={20} />
          <span className="text-sm font-medium">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Stats resumen */}
      {categories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <Layers size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600 font-medium">Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {categories.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <TrendingUp size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium">Activas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {categories.filter((c) => c.is_active !== false).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <Package size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-purple-600 font-medium">
                  Productos totales
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {products.filter((p) => p.is_active !== false).length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Categorías */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="text-gray-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {searchTerm
              ? "No se encontraron categorías"
              : "No hay categorías registradas"}
          </h3>
          <p className="text-gray-500 mt-1 mb-6">
            {searchTerm
              ? "Intenta con otro término de búsqueda"
              : "Crea tu primera categoría para organizar tus productos"}
          </p>
          {!searchTerm && (
            <button
              onClick={() => openModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 mx-auto"
            >
              <Plus size={18} /> Crear Categoría
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat, index) => (
            <CategoryCard key={cat.id} cat={cat} index={index} />
          ))}
        </div>
      )}

      {/* Modal Crear/Editar - Diseño mejorado */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header del modal */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 text-white">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Tag size={20} />
                  {editing ? "Editar Categoría" : "Nueva Categoría"}
                </h2>
                <button
                  onClick={() => setModal(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nombre de la categoría *
                </label>
                <input
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Bebidas, Limpieza, Electrónica..."
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Descripción (opcional)
                </label>
                <textarea
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  rows="3"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Breve descripción para identificar esta categoría..."
                />
              </div>

              {/* Preview del badge */}
              {form.name && (
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-2">Vista previa:</p>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    <Tag size={14} />
                    {form.name}
                  </span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition-colors shadow-lg hover:shadow-xl"
                >
                  {editing ? "Actualizar" : "Guardar Categoría"}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
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

// frontend/src/pages/Reportes.jsx
import { useState, useEffect } from "react";
import api from "../api";
import { useConfig } from "../context/ConfigContext";
import LoaderPOS from "../components/LoaderPOS";
import {
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  CreditCard,
  Landmark,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Package,
  AlertCircle,
  Banknote,
} from "lucide-react";

const DEFAULT_ITEMS_PER_PAGE = 20;

// Componente de tarjeta de estadística
function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
    green:
      "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
    amber:
      "bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300",
    purple:
      "bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300",
    emerald:
      "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
  };

  const iconBg = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    amber: "bg-amber-500",
    purple: "bg-purple-500",
    emerald: "bg-emerald-500",
  };

  return (
    <div
      className={`rounded-2xl border shadow-sm p-5 hover:shadow-md transition-all duration-300 ${colors[color]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80 mb-1">{label}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg[color]} text-white shadow-md`}
        >
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

export default function Reportes() {
  const { config, loading: configLoading } = useConfig();
  const [period, setPeriod] = useState("daily");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    paymentMethod: "",
    cashierId: "",
  });

  const [salesPage, setSalesPage] = useState(1);
  const [salesPagination, setSalesPagination] = useState({
    totalPages: 1,
    total: 0,
  });
  const [recentSales, setRecentSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);

  const itemsPerPage =
    config?.appearance?.itemsPerPage || DEFAULT_ITEMS_PER_PAGE;

  const getDateRangeFromPeriod = (p) => {
    const today = new Date();
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const start = new Date(today);
    if (p === "daily") {
      start.setHours(0, 0, 0, 0);
    } else if (p === "weekly") {
      start.setDate(today.getDate() - 7);
    } else if (p === "monthly") {
      start.setMonth(today.getMonth() - 1);
    }
    return { start: formatDate(start), end: formatDate(today) };
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const dateRange =
        filters.startDate && filters.endDate
          ? { start: filters.startDate, end: filters.endDate }
          : getDateRangeFromPeriod(period);

      params.append("start", dateRange.start);
      params.append("end", dateRange.end);
      if (filters.paymentMethod)
        params.append("paymentMethod", filters.paymentMethod);
      if (filters.cashierId) params.append("cashierId", filters.cashierId);

      const res = await api.get(`/reports/dashboard?${params.toString()}`);
      setData(res.data.data);
    } catch (err) {
      console.error("Error cargando reportes:", err);
      setError(
        err.response?.data?.message || "No se pudieron cargar los reportes",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadRecentSales = async () => {
    setLoadingSales(true);
    try {
      const params = new URLSearchParams();
      const dateRange =
        filters.startDate && filters.endDate
          ? { start: filters.startDate, end: filters.endDate }
          : getDateRangeFromPeriod(period);

      params.append("start", dateRange.start);
      params.append("end", dateRange.end);
      if (filters.paymentMethod)
        params.append("paymentMethod", filters.paymentMethod);
      if (filters.cashierId) params.append("cashierId", filters.cashierId);
      params.append("page", salesPage);
      params.append("limit", itemsPerPage);

      const res = await api.get(`/sales?${params.toString()}`);
      setRecentSales(res.data.data || []);
      setSalesPagination(res.data.pagination || { totalPages: 1, total: 0 });
    } catch (err) {
      console.error("Error cargando ventas recientes:", err);
    } finally {
      setLoadingSales(false);
    }
  };

  useEffect(() => {
    if (!configLoading) {
      loadDashboard();
    }
  }, [period, filters, configLoading]);

  useEffect(() => {
    if (!configLoading) {
      loadRecentSales();
    }
  }, [period, filters, salesPage, itemsPerPage, configLoading]);

  useEffect(() => {
    setSalesPage(1);
  }, [filters, period]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    setFilters((prev) => ({ ...prev, startDate: "", endDate: "" }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      paymentMethod: "",
      cashierId: "",
    });
    setPeriod("daily");
  };

  const hasActiveFilters =
    filters.startDate ||
    filters.endDate ||
    filters.paymentMethod ||
    filters.cashierId;

  // ✅ Carga principal: solo tu LoaderPOS
  if (loading && !data) {
    return <LoaderPOS message="Cargando reportes" />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-4">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
          Error al cargar reportes
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={loadDashboard}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const s = data?.summary || {};
  const cashiers = data?.by_cashier || [];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp
              className="text-blue-600 dark:text-blue-400"
              size={28}
            />
            Centro de Reportes
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Análisis de ventas y desempeño
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              loadDashboard();
              loadRecentSales();
            }}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            title="Actualizar"
          >
            <RefreshCw size={18} />
          </button>
          {Object.entries({
            daily: "Hoy",
            weekly: "Semana",
            monthly: "Mes",
          }).map(([k, v]) => (
            <button
              key={k}
              onClick={() => handlePeriodChange(k)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === k && !filters.startDate
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Panel de filtros avanzados */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <SlidersHorizontal size={16} />
            Filtros avanzados
            {hasActiveFilters && (
              <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Desde
              </label>
              <input
                type="date"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={filters.startDate}
                onChange={(e) => {
                  setFilters({ ...filters, startDate: e.target.value });
                  setPeriod("");
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Hasta
              </label>
              <input
                type="date"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={filters.endDate}
                onChange={(e) => {
                  setFilters({ ...filters, endDate: e.target.value });
                  setPeriod("");
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Método de pago
              </label>
              <select
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={filters.paymentMethod}
                onChange={(e) =>
                  setFilters({ ...filters, paymentMethod: e.target.value })
                }
              >
                <option value="">Todos</option>
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Cajero
              </label>
              <select
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={filters.cashierId}
                onChange={(e) =>
                  setFilters({ ...filters, cashierId: e.target.value })
                }
              >
                <option value="">Todos</option>
                {cashiers.map((c, idx) => (
                  <option key={idx} value={c.cashier_id}>
                    {c.cashier_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Ventas"
          value={s.total_sales || 0}
          color="blue"
        />
        <StatCard
          icon={DollarSign}
          label="Ingresos"
          value={`$${(s.total_revenue || 0).toFixed(2)}`}
          color="green"
        />
        <StatCard
          icon={Banknote}
          label="Efectivo"
          value={`$${(s.cash_total || 0).toFixed(2)}`}
          color="amber"
        />
        <StatCard
          icon={CreditCard}
          label="Tarjeta"
          value={`$${(s.card_total || 0).toFixed(2)}`}
          color="purple"
        />
        <StatCard
          icon={Landmark}
          label="Transferencia"
          value={`$${(s.transfer_total || 0).toFixed(2)}`}
          color="emerald"
        />
      </div>

      {/* Desempeño por Cajero */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <Users className="text-blue-600 dark:text-blue-400" size={18} />
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Desempeño por Cajero
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                <th className="px-6 py-3">Cajero</th>
                <th className="px-6 py-3">Ventas</th>
                <th className="px-6 py-3">Recaudado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {cashiers.length ? (
                cashiers.map((c, i) => (
                  <tr
                    key={i}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {c.cashier_name}
                    </td>
                    <td className="px-6 py-4">{c.total_sales}</td>
                    <td className="px-6 py-4 text-green-600 dark:text-green-400 font-semibold">
                      ${c.total_collected.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="3"
                    className="text-center py-8 text-gray-500 dark:text-gray-400"
                  >
                    Sin datos para el período seleccionado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Últimas Ventas con paginación */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="text-blue-600 dark:text-blue-400" size={18} />
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Últimas Ventas
            </h2>
          </div>
          {salesPagination.total > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Total: {salesPagination.total} ventas
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          {loadingSales ? (
            // ✅ Carga de ventas: solo tu LoaderPOS (sin ningún otro spinner)
            <div className="flex justify-center py-8">
              <LoaderPOS message="Cargando ventas..." />
            </div>
          ) : recentSales.length ? (
            <>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">Cajero</th>
                    <th className="px-6 py-3">Items</th>
                    <th className="px-6 py-3">Total</th>
                    <th className="px-6 py-3">Método</th>
                    <th className="px-6 py-3">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {recentSales.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {s.id?.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                        {s.cashier_name || "Sistema"}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {s.items_count || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-green-600 dark:text-green-400 font-semibold">
                        ${parseFloat(s.total || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            s.payment_method === "cash"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                              : s.payment_method === "card"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          }`}
                        >
                          {s.payment_method === "cash"
                            ? "Efectivo"
                            : s.payment_method === "card"
                              ? "Tarjeta"
                              : "Transferencia"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">
                        {new Date(s.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {salesPagination.totalPages > 1 && (
                <div className="flex justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Mostrando {recentSales.length} de {salesPagination.total}{" "}
                    registros
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      disabled={salesPage === 1}
                      onClick={() => setSalesPage((prev) => prev - 1)}
                      className="px-4 py-2 text-gray-600 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft size={18} /> Anterior
                    </button>
                    <div className="flex gap-1">
                      {[...Array(Math.min(5, salesPagination.totalPages))].map(
                        (_, i) => {
                          let pageNum;
                          if (salesPagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (salesPage <= 3) {
                            pageNum = i + 1;
                          } else if (
                            salesPage >=
                            salesPagination.totalPages - 2
                          ) {
                            pageNum = salesPagination.totalPages - 4 + i;
                          } else {
                            pageNum = salesPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setSalesPage(pageNum)}
                              className={`px-3 py-1 rounded-lg transition-colors ${
                                salesPage === pageNum
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        },
                      )}
                    </div>
                    <button
                      disabled={salesPage === salesPagination.totalPages}
                      onClick={() => setSalesPage((prev) => prev + 1)}
                      className="px-4 py-2 text-gray-600 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-1"
                    >
                      Siguiente <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Package className="mx-auto mb-2" size={32} />
              No hay ventas en el período seleccionado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

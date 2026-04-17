import { useState, useEffect } from "react";
import api from "../api";
import {
  Calendar,
  TrendingUp,
  Users,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";

export default function Reportes() {
  const [period, setPeriod] = useState("daily");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/reports/dashboard?period=${period}`)
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
        <span className="ml-3 text-gray-500">Cargando reportes...</span>
      </div>
    );

  const s = data?.summary || {};
  const cashiers = data?.by_cashier || [];
  const last = data?.last_10 || [];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Centro de Reportes
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Análisis de ventas y desempeño
          </p>
        </div>
        <div className="flex gap-2">
          {Object.entries({
            daily: "Hoy",
            weekly: "Semana",
            monthly: "Mes",
          }).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setPeriod(k)}
              className={`btn ${period === k ? "btn-primary" : "btn-secondary"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          icon={DollarSign}
          label="Efectivo"
          value={`$${(s.cash_total || 0).toFixed(2)}`}
          color="amber"
        />
        <StatCard
          icon={DollarSign}
          label="Tarjeta"
          value={`$${(s.card_total || 0).toFixed(2)}`}
          color="purple"
        />
      </div>

      <div className="table-container">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="text-blue-600" size={18} />
          <h2 className="font-semibold">Desempeño por Cajera</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Cajera</th>
                <th>Ventas</th>
                <th>Recaudado</th>
                <th>Promedio</th>
              </tr>
            </thead>
            <tbody>
              {cashiers.length ? (
                cashiers.map((c, i) => (
                  <tr key={i}>
                    <td className="font-medium">{c.cashier_name}</td>
                    <td>{c.total_sales}</td>
                    <td className="text-green-600 font-semibold">
                      ${c.total_collected.toFixed(2)}
                    </td>
                    <td className="text-gray-500">
                      $
                      {(c.total_sales
                        ? c.total_collected / c.total_sales
                        : 0
                      ).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-gray-500">
                    Sin datos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-container">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Calendar className="text-blue-600" size={18} />
          <h2 className="font-semibold">Últimas 10 Ventas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cajera</th>
                <th>Items</th>
                <th>Total</th>
                <th>Método</th>
                <th>Hora</th>
              </tr>
            </thead>
            <tbody>
              {last.length ? (
                last.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs text-gray-500">
                      {s.id?.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="font-medium">
                      {s.cashier_name || "Sistema"}
                    </td>
                    <td>
                      <span className="badge badge-info">
                        {s.items_count || 0}
                      </span>
                    </td>
                    <td className="text-green-600 font-semibold">
                      ${s.total.toFixed(2)}
                    </td>
                    <td>
                      <span
                        className={`badge ${s.payment_method === "cash" ? "badge-success" : s.payment_method === "card" ? "badge-info" : "badge-warning"}`}
                      >
                        {s.payment_method}
                      </span>
                    </td>
                    <td className="text-gray-500 text-sm">
                      {new Date(s.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    Sin ventas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    amber: "bg-amber-100 text-amber-600",
    purple: "bg-purple-100 text-purple-600",
  };
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
          <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
            <ArrowUpRight size={14} />
            <span>+12%</span>
          </div>
        </div>
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import api from "../api";
import { FileText, Clock, Search } from "lucide-react";
import LoaderPOS from "../components/LoaderPOS";

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .get("/logs")
      .then((r) => setLogs(r.data.data || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.action?.toLowerCase().includes(search.toLowerCase()),
  );

  const formatDetail = (detail) => {
    if (!detail) return "-";
    const str =
      typeof detail === "object" ? JSON.stringify(detail) : String(detail);
    return str.length > 60 ? str.slice(0, 60) + "..." : str;
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <LoaderPOS message="Cargando registros..." />
      </div>
    );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Registro de Actividad
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Historial de acciones del sistema
          </p>
        </div>
        <span className="badge badge-info">{filtered.length} registros</span>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Filtrar..."
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
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Acción</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((log) => (
                  <tr key={log.id || log.created_at}>
                    <td className="text-gray-600 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-gray-400" />
                        {new Date(log.created_at).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className="font-medium">
                      {log.user_name || "Sistema"}
                    </td>
                    <td>
                      <span className="badge badge-info">
                        {log.user_role || "-"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${log.action?.includes("CREATE") ? "badge-success" : log.action?.includes("UPDATE") ? "badge-warning" : "badge-danger"}`}
                      >
                        {log.action?.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="text-gray-500 text-xs font-mono bg-gray-50 px-3 py-1.5 rounded-lg max-w-xs truncate">
                      {formatDetail(log.details)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-gray-500">
                    Sin registros
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

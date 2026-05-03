// frontend/src/pages/PedidosPendientes.jsx
import { useState, useEffect } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { useAuth } from "../store/authStore";
import MoneyDisplay from "../components/MoneyDisplay";
import LoaderPOS from "../components/LoaderPOS";
import { useConfig } from "../context/ConfigContext";
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  RotateCcw,
  Eye,
  History,
  DollarSign,
  CreditCard,
  Landmark,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";

export default function PedidosPendientes() {
  const { user } = useAuth();
  const { config } = useConfig();
  const [pendingSales, setPendingSales] = useState([]);
  const [pendingRefunds, setPendingRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saleDetails, setSaleDetails] = useState(null);
  const [editItems, setEditItems] = useState({});

  // Estado para el historial de aprobaciones
  const [activeTab, setActiveTab] = useState("pending");
  const [historySales, setHistorySales] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [approverFilter, setApproverFilter] = useState(""); // "" = todos (solo admin), para warehouse es su propio id
  const [approversList, setApproversList] = useState([]); // lista de posibles aprobadores

  const itemsPerPageHistory = config?.appearance?.itemsPerPage || 20;

  // Cargar lista de aprobadores solo si es admin
  const loadApprovers = async () => {
    if (user.role === "admin") {
      try {
        const res = await api.get("/users/approvers");
        setApproversList(res.data.data || []);
      } catch (err) {
        console.error("Error cargando aprobadores:", err);
      }
    }
  };

  useEffect(() => {
    loadData();
    loadApprovers();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesRes, refundsRes] = await Promise.all([
        api.get("/sales/pending"),
        api.get("/refunds/pending"),
      ]);
      setPendingSales(salesRes.data.data || []);
      setPendingRefunds(refundsRes.data.data || []);
    } catch (err) {
      console.error(err);
      Swal.fire(
        "Error",
        "No se pudieron cargar los pedidos pendientes",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      // Si es admin y no eligió "Todos", pasa el filtro; si warehouse, siempre su propio id
      if (user.role === "admin" && approverFilter) {
        params.append("approvedBy", approverFilter);
      } else if (user.role === "warehouse") {
        params.append("approvedBy", user.id);
      }
      params.append("page", historyPage);
      params.append("limit", itemsPerPageHistory);
      const res = await api.get(`/sales?${params.toString()}`);
      const salesData = res.data.data || [];
      setHistorySales(salesData);
      setHistoryTotalPages(res.data.pagination?.totalPages || 1);
      setHistoryTotal(res.data.pagination?.total || 0);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "No se pudo cargar el historial", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") loadHistory();
  }, [activeTab, historyPage, itemsPerPageHistory, approverFilter]);

  const approveSale = async (saleId, items) => {
    const result = await Swal.fire({
      title: "¿Aprobar venta?",
      text: "Se descontará el stock de los productos.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, aprobar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;

    try {
      const payload = { reason: "Aprobado por almacén" };
      if (items && items.length > 0) {
        payload.items = items;
      }
      await api.put(`/sales/${saleId}/approve`, payload);
      Swal.fire("Aprobada", "Venta aprobada y stock actualizado", "success");
      loadData();
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Error al aprobar",
        "error",
      );
    }
  };

  const rejectSale = async (saleId) => {
    const result = await Swal.fire({
      title: "¿Rechazar venta?",
      text: "La venta se marcará como rechazada.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Rechazar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;

    try {
      await api.put(`/sales/${saleId}/reject`);
      Swal.fire("Rechazada", "Venta rechazada", "info");
      loadData();
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Error al rechazar",
        "error",
      );
    }
  };

  const approveRefund = async (refundId) => {
    const result = await Swal.fire({
      title: "¿Aprobar devolución?",
      text: "Se devolverá el stock de los productos.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Aprobar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;

    try {
      await api.put(`/refunds/${refundId}/approve`);
      Swal.fire("Aprobada", "Devolución aprobada", "success");
      loadData();
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Error al aprobar",
        "error",
      );
    }
  };

  const openEditModal = async (sale) => {
    setSelectedSale(sale);
    setShowEditModal(true);
    try {
      const res = await api.get(`/sales/${sale.id}`);
      if (res.data.success) {
        const details = res.data.data;
        setSaleDetails(details);
        const initial = {};
        details.items.forEach((item) => {
          initial[item.productId] = item.quantity;
        });
        setEditItems(initial);
      }
    } catch (err) {
      Swal.fire("Error", "No se pudo cargar el detalle", "error");
      setShowEditModal(false);
    }
  };

  const handleEditSubmit = () => {
    if (!selectedSale) return;
    const itemsArray = Object.entries(editItems)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        productId,
        quantity: parseInt(quantity),
      }));
    if (itemsArray.length === 0) {
      Swal.fire("Error", "Debe seleccionar al menos un producto", "warning");
      return;
    }
    approveSale(selectedSale.id, itemsArray);
    setShowEditModal(false);
  };

  const getPaymentIcon = (method) => {
    switch (method) {
      case "cash":
        return <DollarSign size={16} />;
      case "card":
        return <CreditCard size={16} />;
      case "transfer":
        return <Landmark size={16} />;
      default:
        return <DollarSign size={16} />;
    }
  };

  if (loading) return <LoaderPOS message="Cargando pedidos pendientes..." />;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ClipboardList className="text-blue-600" /> Pedidos Pendientes de
        Aprobación
      </h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 font-medium text-sm transition-colors ${activeTab === "pending" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
        >
          Pendientes
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 font-medium text-sm transition-colors flex items-center gap-1 ${activeTab === "history" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
        >
          <History size={16} /> Historial de aprobaciones
        </button>
      </div>

      {activeTab === "pending" && (
        <>
          {/* Ventas Pendientes (sin cambios) */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-lg font-semibold mb-3">
              Ventas Pendientes ({pendingSales.length})
            </h2>
            {pendingSales.length === 0 ? (
              <p className="text-gray-500">No hay ventas pendientes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">ID</th>
                      <th className="py-2">Cajero</th>
                      <th className="py-2">Total</th>
                      <th className="py-2">Método</th>
                      <th className="py-2">Fecha</th>
                      <th className="py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingSales.map((sale) => (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 font-mono text-xs">
                          {sale.id.slice(0, 8)}...
                        </td>
                        <td className="py-2">{sale.cashier_name}</td>
                        <td className="py-2 font-bold">
                          <MoneyDisplay amount={sale.total} />
                        </td>
                        <td className="py-2 flex items-center gap-1">
                          {getPaymentIcon(sale.payment_method)}
                          {sale.payment_method === "cash"
                            ? "Efectivo"
                            : sale.payment_method === "card"
                              ? "Tarjeta"
                              : "Transferencia"}
                        </td>
                        <td className="py-2 text-gray-500">
                          {new Date(sale.created_at).toLocaleString("es-ES")}
                        </td>
                        <td className="py-2 flex gap-2">
                          <button
                            onClick={() => openEditModal(sale)}
                            className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 flex items-center gap-1"
                          >
                            <Eye size={14} /> Revisar
                          </button>
                          <button
                            onClick={() => approveSale(sale.id)}
                            className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 flex items-center gap-1"
                          >
                            <CheckCircle size={14} /> Aprobar
                          </button>
                          <button
                            onClick={() => rejectSale(sale.id)}
                            className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 flex items-center gap-1"
                          >
                            <XCircle size={14} /> Rechazar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Devoluciones Pendientes (sin cambios) */}
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="text-lg font-semibold mb-3">
              Devoluciones Pendientes ({pendingRefunds.length})
            </h2>
            {pendingRefunds.length === 0 ? (
              <p className="text-gray-500">No hay devoluciones pendientes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">ID</th>
                      <th className="py-2">Cajero</th>
                      <th className="py-2">Total</th>
                      <th className="py-2">Motivo</th>
                      <th className="py-2">Fecha</th>
                      <th className="py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRefunds.map((refund) => (
                      <tr key={refund.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 font-mono text-xs">
                          {refund.id.slice(0, 8)}...
                        </td>
                        <td className="py-2">{refund.cashier_name}</td>
                        <td className="py-2 font-bold">
                          <MoneyDisplay amount={refund.total_refunded} />
                        </td>
                        <td className="py-2">{refund.reason}</td>
                        <td className="py-2 text-gray-500">
                          {new Date(refund.created_at).toLocaleString("es-ES")}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => approveRefund(refund.id)}
                            className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 flex items-center gap-1"
                          >
                            <RotateCcw size={14} /> Aprobar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "history" && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Historial de aprobaciones/rechazos
            </h2>
            {/* Filtro de aprobador (solo admin) */}
            {user.role === "admin" && (
              <div className="flex items-center gap-2">
                <User size={16} className="text-gray-500" />
                <select
                  value={approverFilter}
                  onChange={(e) => {
                    setApproverFilter(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="border rounded-lg px-3 py-1.5 text-sm bg-white"
                >
                  <option value="">Todos los aprobadores</option>
                  {approversList.map((ap) => (
                    <option key={ap.id} value={ap.id}>
                      {ap.name} ({ap.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loadingHistory ? (
            <LoaderPOS message="Cargando historial..." />
          ) : historySales.length === 0 ? (
            <p className="text-gray-500">No hay registros de aprobaciones.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">ID Venta</th>
                      <th className="py-2">Estado</th>
                      <th className="py-2">Cajero</th>
                      <th className="py-2">Total</th>
                      <th className="py-2">Método</th>
                      <th className="py-2">Fecha creación</th>
                      <th className="py-2">Procesado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historySales.map((sale) => (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 font-mono text-xs">
                          {sale.id.slice(0, 8)}...
                        </td>
                        <td className="py-2">
                          <span
                            className={`badge ${sale.status === "completed" ? "badge-success" : "badge-danger"}`}
                          >
                            {sale.status === "completed"
                              ? "Aprobada"
                              : "Rechazada"}
                          </span>
                        </td>
                        <td className="py-2">{sale.cashier_name}</td>
                        <td className="py-2 font-bold">
                          <MoneyDisplay amount={sale.total} />
                        </td>
                        <td className="py-2">{sale.payment_method}</td>
                        <td className="py-2 text-gray-500">
                          {new Date(sale.created_at).toLocaleString("es-ES")}
                        </td>
                        <td className="py-2 text-gray-500">
                          {sale.modified_at
                            ? new Date(sale.modified_at).toLocaleString("es-ES")
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Paginación del historial */}
              {historyTotalPages > 1 && (
                <div className="flex justify-between items-center gap-4 mt-4">
                  <div className="text-sm text-gray-600">
                    Mostrando {historySales.length} de {historyTotal} resultados
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage((p) => p - 1)}
                      className="px-3 py-1.5 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm">
                      {historyPage} de {historyTotalPages}
                    </span>
                    <button
                      disabled={historyPage === historyTotalPages}
                      onClick={() => setHistoryPage((p) => p + 1)}
                      className="px-3 py-1.5 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal de edición (sin cambios) */}
      {showEditModal && saleDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">
              Editar Venta #{selectedSale?.id.slice(0, 8)}
            </h2>
            <div className="space-y-3">
              {saleDetails.items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between border p-2 rounded"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      <MoneyDisplay amount={item.unitPrice} /> x {item.quantity}{" "}
                      (original)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Cantidad:</label>
                    <input
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={editItems[item.productId] || 0}
                      onChange={(e) =>
                        setEditItems((prev) => ({
                          ...prev,
                          [item.productId]: Math.min(
                            Math.max(0, parseInt(e.target.value) || 0),
                            item.quantity,
                          ),
                        }))
                      }
                      className="w-16 border rounded px-2 py-1 text-center"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
              >
                <CheckCircle size={16} /> Aprobar con cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

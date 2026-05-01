// frontend/src/pages/Facturacion.jsx
import { useState, useEffect } from "react";
import api from "../api";
import Swal from "sweetalert2";
import LoaderPOS from "../components/LoaderPOS";
import MoneyDisplay from "../components/MoneyDisplay";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertCircle,
  Plus,
  X,
} from "lucide-react";

export default function Facturacion() {
  // Facturas
  const [invoiceStart, setInvoiceStart] = useState("");
  const [invoiceEnd, setInvoiceEnd] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invPage, setInvPage] = useState(1);
  const [invTotalPages, setInvTotalPages] = useState(1);

  // Notas de crédito
  const [creditStart, setCreditStart] = useState("");
  const [creditEnd, setCreditEnd] = useState("");
  const [creditNotes, setCreditNotes] = useState([]);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditPage, setCreditPage] = useState(1);
  const [creditTotalPages, setCreditTotalPages] = useState(1);

  // Modal para generar factura desde venta
  const [showModal, setShowModal] = useState(false);
  const [salesWithoutInvoice, setSalesWithoutInvoice] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [selectedSale, setSelectedSale] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [cf, setCf] = useState(false);
  const [fe, setFe] = useState("");
  const [saving, setSaving] = useState(false);

  const itemsPerPage = 15;

  const fetchInvoices = async () => {
    setInvLoading(true);
    try {
      const params = new URLSearchParams();
      if (invoiceStart) params.append("start", invoiceStart);
      if (invoiceEnd) params.append("end", invoiceEnd);
      params.append("page", invPage);
      params.append("limit", itemsPerPage);
      const res = await api.get(`/invoices?${params.toString()}`);
      setInvoices(res.data.data || []);
      setInvTotalPages(res.data.pagination.totalPages);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las facturas", "error");
    } finally {
      setInvLoading(false);
    }
  };

  const fetchCreditNotes = async () => {
    setCreditLoading(true);
    try {
      const params = new URLSearchParams();
      if (creditStart) params.append("start", creditStart);
      if (creditEnd) params.append("end", creditEnd);
      params.append("page", creditPage);
      params.append("limit", itemsPerPage);
      const res = await api.get(`/credit-notes?${params.toString()}`);
      setCreditNotes(res.data.data || []);
      setCreditTotalPages(res.data.pagination.totalPages);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las notas de crédito", "error");
    } finally {
      setCreditLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [invPage]);
  useEffect(() => {
    fetchCreditNotes();
  }, [creditPage]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  const Pagination = ({ page, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return (
      <div className="flex justify-end items-center gap-2 mt-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-2 py-1 rounded text-sm ${p === page ? "bg-blue-600 text-white" : "hover:bg-gray-200"}`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  // Cargar ventas sin factura (para modal)
  const loadSalesWithoutInvoice = async () => {
    setLoadingSales(true);
    try {
      const res = await api.get("/sales?limit=100&status=completed");
      const all = res.data.data || [];
      const noInvoice = all.filter((s) => !s.invoice_number);
      setSalesWithoutInvoice(noInvoice);
    } catch {
      Swal.fire("Error", "No se pudieron cargar las ventas", "error");
    } finally {
      setLoadingSales(false);
    }
  };

  const openModal = () => {
    setSelectedSale("");
    setInvoiceNumber("");
    setCustomerName("");
    setCf(false);
    setFe("");
    loadSalesWithoutInvoice();
    setShowModal(true);
  };

  const handleSubmitInvoice = async (e) => {
    e.preventDefault();
    if (!selectedSale || !invoiceNumber.trim() || !customerName.trim()) {
      Swal.fire(
        "Error",
        "Seleccione la venta y complete los datos de la factura",
        "warning",
      );
      return;
    }
    setSaving(true);
    try {
      await api.put(`/sales/${selectedSale}/assign-invoice`, {
        invoice_number: invoiceNumber.trim(),
        customer_name: customerName.trim(),
        cf,
        fe: fe.trim() || null,
      });
      Swal.fire({
        icon: "success",
        title: "Factura generada",
        text: "Los datos se han asignado correctamente",
      });
      setShowModal(false);
      fetchInvoices();
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Error al generar factura",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="text-blue-600" size={28} /> Facturación
        </h1>
        <button
          onClick={openModal}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> Nueva Factura
        </button>
      </div>

      {/* SECCIÓN FACTURAS */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Search size={20} /> Buscar Factura Venta
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500">
              Entre
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={invoiceStart}
                onChange={(e) => setInvoiceStart(e.target.value)}
                className="input text-sm"
              />
              <span className="text-sm text-gray-500">y</span>
              <input
                type="date"
                value={invoiceEnd}
                onChange={(e) => setInvoiceEnd(e.target.value)}
                className="input text-sm"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setInvPage(1);
              fetchInvoices();
            }}
            className="btn-primary text-sm"
          >
            Buscar
          </button>
        </div>

        {invLoading ? (
          <LoaderPOS message="Cargando facturas..." />
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>C.F.</th>
                  <th>FE</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length > 0 ? (
                  invoices.map((inv, idx) => (
                    <tr key={idx}>
                      <td>{inv.Factura || "—"}</td>
                      <td>{formatDate(inv.Fecha)}</td>
                      <td>{inv.Cliente}</td>
                      <td>{inv["C.F."]}</td>
                      <td>{inv.FE}</td>
                      <td>
                        <MoneyDisplay amount={inv.Importe} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-gray-500">
                      <AlertCircle className="mx-auto mb-2" size={24} /> No se
                      encontraron facturas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Pagination
              page={invPage}
              totalPages={invTotalPages}
              onPageChange={setInvPage}
            />
          </div>
        )}
      </div>

      {/* SECCIÓN NOTAS DE CRÉDITO (AHORA CON PRODUCTOS Y MOTIVO) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText size={20} /> Buscar Notas de Crédito
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500">
              Entre
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={creditStart}
                onChange={(e) => setCreditStart(e.target.value)}
                className="input text-sm"
              />
              <span className="text-sm text-gray-500">y</span>
              <input
                type="date"
                value={creditEnd}
                onChange={(e) => setCreditEnd(e.target.value)}
                className="input text-sm"
              />
            </div>
          </div>
          <button
            onClick={() => {
              setCreditPage(1);
              fetchCreditNotes();
            }}
            className="btn-primary text-sm"
          >
            Buscar
          </button>
        </div>

        {creditLoading ? (
          <LoaderPOS message="Cargando notas de crédito..." />
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Motivo</th>
                  <th>Productos</th>
                  <th>C.F.</th>
                  <th>FE</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {creditNotes.length > 0 ? (
                  creditNotes.map((note, idx) => (
                    <tr key={idx}>
                      <td>{note.Factura || "—"}</td>
                      <td>{formatDate(note.Fecha)}</td>
                      <td>{note.Cliente}</td>
                      <td
                        className="max-w-[200px] truncate"
                        title={note.Motivo}
                      >
                        {note.Motivo || "—"}
                      </td>
                      <td
                        className="max-w-[300px] truncate"
                        title={note.Productos}
                      >
                        {note.Productos || "—"}
                      </td>
                      <td>{note["C.F."]}</td>
                      <td>{note.FE}</td>
                      <td>
                        <MoneyDisplay amount={note.Importe} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-gray-500">
                      <AlertCircle className="mx-auto mb-2" size={24} /> No se
                      encontraron notas de crédito
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Pagination
              page={creditPage}
              totalPages={creditTotalPages}
              onPageChange={setCreditPage}
            />
          </div>
        )}
      </div>

      {/* MODAL NUEVA FACTURA (igual que antes) */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Generar Factura
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitInvoice} className="p-5 space-y-4">
              <div>
                <label className="label">Venta</label>
                <select
                  value={selectedSale}
                  onChange={(e) => setSelectedSale(e.target.value)}
                  required
                  className="input"
                  disabled={loadingSales}
                >
                  <option value="">Seleccione una venta...</option>
                  {salesWithoutInvoice.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.id.slice(0, 8)} - {formatDate(s.created_at)} -{" "}
                      {s.total}
                    </option>
                  ))}
                </select>
                {loadingSales && (
                  <span className="text-xs text-gray-500">
                    Cargando ventas...
                  </span>
                )}
              </div>
              <div>
                <label className="label">Número de Factura</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  required
                  className="input"
                  placeholder="Ej: 18753"
                />
              </div>
              <div>
                <label className="label">Cliente</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="input"
                  placeholder="Nombre del cliente"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cf"
                  checked={cf}
                  onChange={(e) => setCf(e.target.checked)}
                  className="rounded"
                />
                <label
                  htmlFor="cf"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Control Fiscal (C.F.)
                </label>
              </div>
              <div>
                <label className="label">N° Factura Electrónica (FE)</label>
                <input
                  type="text"
                  value={fe}
                  onChange={(e) => setFe(e.target.value)}
                  className="input"
                  placeholder="Ej: 21718"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? "Guardando..." : "Generar Factura"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary px-6"
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

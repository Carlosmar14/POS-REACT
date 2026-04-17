// frontend/src/pages/Historial.jsx
import { useState, useEffect, Fragment } from "react";
import { useAuth } from "../store/authStore";
import api from "../api";
import Swal from "sweetalert2";
import {
  History,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  AlertCircle,
  Package,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
  TrendingUp,
  CreditCard,
  DollarSign,
  Landmark,
  Filter,
  X,
  FileText,
  ArrowUpRight,
  TrendingDown,
  RefreshCw,
  User,
} from "lucide-react";

const DEFAULT_ITEMS_PER_PAGE = 20;
const MAX_REPORT_RECORDS = 500;

// ✅ SEPARAR URL de API y URL de UPLOADS para imágenes
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || "http://localhost:3000";

export default function Historial() {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [saleDetails, setSaleDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  const [summaryStats, setSummaryStats] = useState({
    totalVentas: 0,
    totalTransacciones: 0,
    porMetodo: { efectivo: 0, tarjeta: 0, transferencia: 0 },
  });

  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState("today");
  const [filters, setFilters] = useState({
    start: new Date().toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
    status: "",
  });
  const [showFilters, setShowFilters] = useState(true);

  // ✅ Función helper para construir URL de imágenes correctamente
  const getProductImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    // ✅ Usar UPLOADS_URL, no API_URL (las imágenes están en /uploads, no en /api/uploads)
    return `${UPLOADS_URL}${imageUrl.startsWith("/") ? imageUrl : "/" + imageUrl}`;
  };

  // Cargar configuración
  const loadConfiguracion = async () => {
    try {
      const response = await api.get("/configuracion");
      if (response.data.success && response.data.data) {
        const perPage =
          response.data.data.appearance?.itemsPerPage || DEFAULT_ITEMS_PER_PAGE;
        setItemsPerPage(perPage);
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
    }
  };

  // Cargar estadísticas reales
  const loadSummaryStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.start) params.append("start", filters.start);
      if (filters.end) params.append("end", filters.end);
      if (filters.status) params.append("status", filters.status);
      const res = await api.get(`/sales/stats?${params.toString()}`);
      if (res.data.success && res.data.data) setSummaryStats(res.data.data);
    } catch (err) {
      console.error("Error cargando stats:", err);
    }
  };

  // Cargar ventas paginadas (para la tabla)
  const loadSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: itemsPerPage,
        ...(filters.start && { start: filters.start }),
        ...(filters.end && { end: filters.end }),
        ...(filters.status && { status: filters.status }),
      });
      const res = await api.get(`/sales?${params.toString()}`);
      setSales(res.data.data || []);
      setPagination(
        res.data.pagination || { page: 1, totalPages: 1, total: 0 },
      );
      setSaleDetails({});
      setExpandedRow(null);
    } catch (err) {
      console.error("Error cargando historial:", err);
      setError(err.response?.data?.message || "No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  };

  // ✅ NUEVO: Cargar TODAS las ventas del filtro para reportes
  const loadAllSalesForReport = async () => {
    try {
      const params = new URLSearchParams({
        limit: MAX_REPORT_RECORDS,
        ...(filters.start && { start: filters.start }),
        ...(filters.end && { end: filters.end }),
        ...(filters.status && { status: filters.status }),
      });
      const res = await api.get(`/sales?${params.toString()}`);
      return res.data.data || [];
    } catch (err) {
      console.error("Error cargando ventas para reporte:", err);
      throw new Error("No se pudieron cargar las ventas para el reporte");
    }
  };

  // ✅ NUEVO: Cargar detalles de múltiples ventas en paralelo
  const loadSaleDetailsBatch = async (saleIds) => {
    const details = {};
    const promises = saleIds.map(async (id) => {
      try {
        const res = await api.get(`/sales/${id}`);
        if (res.data.success && res.data.data) details[id] = res.data.data;
      } catch (err) {
        console.warn(`No se pudo cargar detalle de venta ${id}:`, err.message);
      }
    });
    await Promise.all(promises);
    return details;
  };

  const loadData = async () => {
    await Promise.all([loadSales(), loadSummaryStats()]);
  };

  useEffect(() => {
    loadConfiguracion();
  }, []);
  useEffect(() => {
    if (user) loadData();
  }, [
    user,
    pagination.page,
    itemsPerPage,
    filters.start,
    filters.end,
    filters.status,
  ]);

  // Escuchar cambios en localStorage
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "pos_settings") {
        try {
          const settings = JSON.parse(e.newValue);
          const perPage =
            settings.appearance?.itemsPerPage || DEFAULT_ITEMS_PER_PAGE;
          setItemsPerPage(perPage);
        } catch (err) {
          console.error("Error en storage change:", err);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Helpers
  const getTodayDate = () => new Date().toISOString().split("T")[0];
  const getWeekAgoDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  };
  const getMonthAgoDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  };
  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const formatCurrency = (val) => parseFloat(val || 0).toFixed(2);

  // Cargar detalle de venta individual
  const loadSaleDetails = async (saleId) => {
    if (saleDetails[saleId]) return;
    setLoadingDetails((prev) => ({ ...prev, [saleId]: true }));
    try {
      const res = await api.get(`/sales/${saleId}`);
      if (res.data.success && res.data.data)
        setSaleDetails((prev) => ({ ...prev, [saleId]: res.data.data }));
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [saleId]: false }));
    }
  };

  const toggleExpand = async (saleId) => {
    if (expandedRow === saleId) {
      setExpandedRow(null);
    } else {
      setExpandedRow(saleId);
      await loadSaleDetails(saleId);
    }
  };

  const applyQuickFilter = (type) => {
    const today = getTodayDate();
    setActiveQuickFilter(type);
    const newFilters = { ...filters };
    if (type === "today") {
      newFilters.start = today;
      newFilters.end = today;
    } else if (type === "week") {
      newFilters.start = getWeekAgoDate();
      newFilters.end = today;
    } else if (type === "month") {
      newFilters.start = getMonthAgoDate();
      newFilters.end = today;
    }
    setFilters(newFilters);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const clearFilters = () => {
    const t = getTodayDate();
    setFilters({ start: t, end: t, status: "" });
    setActiveQuickFilter("today");
    setPagination((p) => ({ ...p, page: 1 }));
  };

  // Imagen de producto con fallback
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
          className={`w-14 h-14 ${colorClass} rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md`}
        >
          {firstLetter}
        </div>
      );
    return (
      <img
        // ✅ CORREGIDO: Usar getProductImageUrl con UPLOADS_URL
        src={getProductImageUrl(imageUrl)}
        alt={productName}
        className="w-14 h-14 object-cover rounded-xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-all hover:scale-105 cursor-pointer"
        onError={() => setImgError(true)}
      />
    );
  };

  // ✅ GENERAR REPORTE PDF - CON IMÁGENES CORREGIDAS
  const generatePDFReport = async () => {
    setGeneratingReport(true);
    try {
      // 1. Mostrar progreso
      const progressSwal = Swal.fire({
        title: "Generando reporte...",
        html: "Cargando datos del período filtrado",
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // 2. Cargar TODAS las ventas del filtro (sin paginación)
      const allSales = await loadAllSalesForReport();
      if (allSales.length === 0) {
        Swal.fire(
          "Sin datos",
          "No hay ventas en el período seleccionado",
          "info",
        );
        return;
      }

      // 3. Cargar detalles de todas las ventas en paralelo
      Swal.update({
        html: `Cargando detalles de ${allSales.length} ventas...`,
      });
      const saleIds = allSales.map((s) => s.id);
      const allDetails = await loadSaleDetailsBatch(saleIds);

      // 4. Preparar datos con imágenes
      Swal.update({ html: "Preparando imágenes..." });

      const imageToBase64 = (url) =>
        new Promise((resolve) => {
          if (!url) {
            resolve(null);
            return;
          }
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          };
          img.onerror = () => resolve(null);
          // ✅ CORREGIDO: Usar UPLOADS_URL para imágenes
          img.src = getProductImageUrl(url);
        });

      const salesWithImages = await Promise.all(
        allSales.map(async (sale) => {
          const details = allDetails[sale.id];
          if (!details?.items) return { ...sale, details: { items: [] } };

          const itemsWithImages = await Promise.all(
            details.items.map(async (item) => {
              let imageBase64 = null;
              if (item.image) imageBase64 = await imageToBase64(item.image);
              return { ...item, imageBase64 };
            }),
          );
          return { ...sale, details: { ...details, items: itemsWithImages } };
        }),
      );

      // 5. Generar HTML del reporte
      Swal.update({ html: "Generando PDF..." });

      const reportHTML = `
        <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte de Ventas</title>
        <style>
          body{font-family:Arial,sans-serif;margin:20px;color:#111;background:#fff;line-height:1.4}
          .page-break{page-break-after:always}
          .header{background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#fff;padding:15px 20px;border-radius:8px;margin-bottom:15px}
          .header h1{margin:0 0 5px;font-size:18px;font-weight:700}
          .header p{margin:2px 0;opacity:0.95;font-size:11px}
          .sale-card{border:1px solid #e2e8f0;border-radius:8px;margin:15px 0;overflow:hidden}
          .sale-header{background:#f8fafc;padding:10px 15px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
          .sale-header .left{display:flex;flex-direction:column;gap:2px}
          .sale-header .right{text-align:right}
          .sale-header .badge{display:inline-block;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600}
          .badge-method{background:#e0e7ff;color:#3730a3}
          .badge-status{background:#dcfce7;color:#166534}
          .badge-status.pending{background:#fef3c7;color:#92400e}
          .badge-status.cancelled{background:#fee2e2;color:#991b1b}
          .operator{display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b}
          table{width:100%;border-collapse:collapse;font-size:11px}
          th{background:#f1f5f9;padding:8px 10px;text-align:left;font-weight:600;color:#475569}
          td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
          tr:last-child td{border-bottom:none}
          .product-img{width:40px;height:40px;object-fit:cover;border-radius:5px;border:1px solid #e2e8f0}
          .product-placeholder{width:40px;height:40px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:5px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px}
          .sale-total{background:#f8fafc;padding:10px 15px;text-align:right;font-weight:700;color:#16a34a;font-size:13px;border-top:1px solid #e2e8f0}
          .summary{margin-top:25px;padding-top:20px;border-top:2px solid #e2e8f0}
          .summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:10px}
          .summary-card{background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:6px;text-align:center}
          .summary-card h4{margin:0 0 4px;color:#475569;font-size:11px;text-transform:uppercase}
          .summary-card .value{font-size:20px;font-weight:800;color:#0f172a}
          .footer{margin-top:25px;padding-top:15px;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:10px}
          @media print{body{margin:10px}.page-break{page-break-after:always}.sale-card{break-inside:avoid}}
        </style></head><body>
          <div class="header">
            <h1>📊 REPORTE DE VENTAS</h1>
            <p><strong>Período:</strong> ${filters.start || "Inicio"} → ${filters.end || "Actual"}</p>
            <p><strong>Estado:</strong> ${filters.status ? (filters.status === "completed" ? "Completadas" : filters.status === "pending" ? "Pendientes" : "Canceladas") : "Todos"}</p>
            <p><strong>Generado:</strong> ${new Date().toLocaleString("es-ES")} | Usuario: ${user?.name || user?.email || "Sistema"}</p>
          </div>

          ${salesWithImages
            .map((sale) => {
              const details = sale.details;
              if (!details?.items?.length) return "";
              const methodText =
                sale.payment_method === "cash"
                  ? "Efectivo"
                  : sale.payment_method === "card"
                    ? "Tarjeta"
                    : "Transferencia";
              const statusText =
                sale.status === "completed"
                  ? "Completada"
                  : sale.status === "pending"
                    ? "Pendiente"
                    : "Cancelada";
              const statusClass =
                sale.status === "completed"
                  ? ""
                  : sale.status === "pending"
                    ? " pending"
                    : " cancelled";

              return `
              <div class="sale-card">
                <div class="sale-header">
                  <div class="left">
                    <strong style="font-size:13px">🧾 Venta #${sale.id.slice(0, 8)}</strong>
                    <span style="font-size:11px;color:#64748b">${formatDate(sale.created_at)}</span>
                    <div class="operator"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> ${sale.cashier_name || "Sistema"}</div>
                  </div>
                  <div class="right">
                    <span class="badge badge-method">${methodText}</span>
                    <span class="badge badge-status${statusClass}">${statusText}</span>
                  </div>
                </div>
                <table>
                  <thead><tr><th style="width:45px">Img</th><th>Producto</th><th style="width:50px;text-align:center">Cant</th><th style="width:70px;text-align:right">Precio</th><th style="width:70px;text-align:right">Subtotal</th></tr></thead>
                  <tbody>
                    ${details.items
                      .map((item) => {
                        const firstLetter =
                          item.name?.charAt(0).toUpperCase() || "?";
                        return `
                        <tr>
                          <td style="text-align:center">${item.imageBase64 ? `<img src="${item.imageBase64}" class="product-img" alt="${item.name}"/>` : `<div class="product-placeholder">${firstLetter}</div>`}</td>
                          <td>
                            <div style="font-weight:600">${item.name}</div>
                            ${item.sku ? `<div style="font-size:9px;color:#64748b;margin-top:1px">SKU: ${item.sku}</div>` : ""}
                          </td>
                          <td style="text-align:center;font-weight:600;color:#2563eb">${item.quantity}</td>
                          <td style="text-align:right">$${formatCurrency(item.unitPrice)}</td>
                          <td style="text-align:right;font-weight:600">$${formatCurrency(item.subtotal)}</td>
                        </tr>
                      `;
                      })
                      .join("")}
                  </tbody>
                </table>
                <div class="sale-total">TOTAL: $${formatCurrency(sale.total)}</div>
              </div>
            `;
            })
            .join("")}

          <div class="summary">
            <h3 style="margin:0 0 10px;font-size:14px;color:#1e293b">📈 Resumen del Período</h3>
            <div class="summary-grid">
              <div class="summary-card">
                <h4>Ventas Realizadas</h4>
                <div class="value">${summaryStats.totalTransacciones || allSales.length}</div>
              </div>
              <div class="summary-card">
                <h4>Ingresos Totales</h4>
                <div class="value">$${formatCurrency(summaryStats.totalVentas || allSales.reduce((s, v) => s + parseFloat(v.total || 0), 0))}</div>
              </div>
              <div class="summary-card">
                <h4>Efectivo</h4>
                <div class="value">$${formatCurrency(summaryStats.porMetodo?.efectivo || 0)}</div>
              </div>
              <div class="summary-card">
                <h4>Tarjeta</h4>
                <div class="value">$${formatCurrency(summaryStats.porMetodo?.tarjeta || 0)}</div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Sistema POS © ${new Date().getFullYear()} - Reporte generado automáticamente</p>
            <p style="margin-top:5px;font-style:italic">"¡Gracias por su compra!"</p>
          </div>
        </body></html>
      `;

      // 6. Imprimir
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
          Swal.fire({
            icon: "success",
            title: "✅ Reporte generado",
            text: `Incluye ${allSales.length} ventas con productos e imágenes`,
            timer: 2000,
            showConfirmButton: false,
          });
        }, 500);
      }
    } catch (err) {
      console.error("❌ Error generando reporte:", err);
      Swal.fire(
        "Error",
        err.message || "No se pudo generar el reporte",
        "error",
      );
    } finally {
      setGeneratingReport(false);
    }
  };

  // Exportar a CSV
  const exportToCSV = () => {
    if (!sales.length) return;
    const headers = [
      "ID",
      "Fecha",
      "Operador",
      "Productos",
      "Cantidad Total",
      "Total",
      "Método Pago",
      "Estado",
    ];
    const rows = sales.map((s) => {
      const details = saleDetails[s.id];
      const productos =
        details?.items
          ?.map((item) => `${item.name} x${item.quantity}`)
          .join("; ") || "";
      const totalCantidad =
        details?.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) ||
        s.items_count ||
        0;
      return [
        s.id.slice(0, 8),
        formatDate(s.created_at),
        s.cashier_name || "N/A",
        productos,
        totalCantidad,
        formatCurrency(s.total),
        s.payment_method === "cash"
          ? "Efectivo"
          : s.payment_method === "card"
            ? "Tarjeta"
            : "Transferencia",
        s.status === "completed"
          ? "Completada"
          : s.status === "cancelled"
            ? "Cancelada"
            : "Pendiente",
      ];
    });
    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;encoding:utf-8",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `historial_ventas_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.click();
    URL.revokeObjectURL(url);
  };

  // Loading/Error states
  if (error && !loading)
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-4">
        <AlertCircle className="text-amber-500 mb-4" size={48} />
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          No se pudo cargar el historial
        </h3>
        <p className="text-gray-600 mb-4 max-w-md">{error}</p>
        <button
          onClick={loadData}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    );
  if (loading && sales.length === 0)
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={32} />
        <span className="text-gray-500">Cargando historial...</span>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="text-blue-600" size={28} /> Historial de
            Transacciones
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {user?.role === "admin"
              ? "Registro global de ventas"
              : "Tus ventas recientes"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            disabled={sales.length === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            <Download size={16} /> Exportar CSV
          </button>
          <button
            onClick={generatePDFReport}
            disabled={generatingReport || sales.length === 0}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            {generatingReport ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileText size={16} />
            )}{" "}
            Generar PDF
          </button>
        </div>
      </div>

      {/* Paneles de stats */}
      {summaryStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-100 text-sm font-medium">
                  VENTAS REALIZADAS
                </p>
                <p className="text-4xl font-bold mt-2">
                  {summaryStats.totalTransacciones}
                </p>
                <div className="flex items-center gap-1 mt-3 text-blue-100">
                  <ArrowUpRight size={16} />
                  <span className="text-sm">Total de transacciones</span>
                </div>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <TrendingUp size={28} />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-green-100 text-sm font-medium">
                  INGRESOS TOTALES
                </p>
                <p className="text-4xl font-bold mt-2">
                  ${formatCurrency(summaryStats.totalVentas)}
                </p>
                <div className="flex items-center gap-1 mt-3 text-green-100">
                  <ArrowUpRight size={16} />
                  <span className="text-sm">Total recaudado</span>
                </div>
              </div>
              <div className="bg-white/20 p-3 rounded-xl">
                <DollarSign size={28} />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard size={12} /> <span>Tarjeta:</span>
                  <span className="font-semibold">
                    ${formatCurrency(summaryStats.porMetodo?.tarjeta || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Landmark size={12} /> <span>Efectivo:</span>
                  <span className="font-semibold">
                    ${formatCurrency(summaryStats.porMetodo?.efectivo || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros Rápidos */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown size={18} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Filtros rápidos:
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyQuickFilter("today")}
            className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${activeQuickFilter === "today" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            <Calendar size={16} /> Hoy
          </button>
          <button
            onClick={() => applyQuickFilter("week")}
            className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${activeQuickFilter === "week" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            <Calendar size={16} /> Última Semana
          </button>
          <button
            onClick={() => applyQuickFilter("month")}
            className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${activeQuickFilter === "month" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            <Calendar size={16} /> Último Mes
          </button>
        </div>
      </div>

      {/* Filtros Avanzados */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-gray-700 hover:text-blue-600"
          >
            <Filter size={18} />
            <span className="font-medium">Filtros Avanzados</span>
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {(filters.start !== getTodayDate() ||
            filters.end !== getTodayDate() ||
            filters.status) && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
            >
              <X size={14} /> Limpiar filtros
            </button>
          )}
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Calendar size={14} /> Desde
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.start}
                onChange={(e) => {
                  setFilters({ ...filters, start: e.target.value });
                  setActiveQuickFilter(null);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Calendar size={14} /> Hasta
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.end}
                onChange={(e) => {
                  setFilters({ ...filters, end: e.target.value });
                  setActiveQuickFilter(null);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <AlertCircle size={14} /> Estado
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.status}
                onChange={(e) => {
                  setFilters({ ...filters, status: e.target.value });
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <option value="">Todos</option>
                <option value="completed">Completada</option>
                <option value="pending">Pendiente</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setPagination((prev) => ({ ...prev, page: 1 }));
                  loadData();
                }}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Search size={16} /> Aplicar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabla de Ventas - CON IMÁGENES CORREGIDAS */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {sales.length === 0 ? (
          <div className="text-center py-12">
            <History className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 font-medium">
              {filters.start || filters.end || filters.status
                ? "No hay ventas con los filtros seleccionados"
                : "No hay ventas registradas"}
            </p>
            {filters.start === getTodayDate() &&
              filters.end === getTodayDate() && (
                <p className="text-sm text-gray-400 mt-2">
                  No hay ventas registradas para hoy
                </p>
              )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="w-10 px-6 py-3"></th>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Operador</th>
                  <th className="px-6 py-3">Total</th>
                  <th className="px-6 py-3">Método</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3 text-center">Cantidad</th>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((s) => {
                  const saleDetail = saleDetails[s.id];
                  const isLoadingDetails = loadingDetails[s.id];
                  const totalCantidad =
                    saleDetail?.items?.reduce(
                      (sum, item) => sum + (item.quantity || 0),
                      0,
                    ) ||
                    s.items_count ||
                    0;
                  return (
                    <Fragment key={s.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleExpand(s.id)}
                            className="hover:bg-gray-200 p-1 rounded transition-colors"
                          >
                            {expandedRow === s.id ? (
                              <ChevronUp size={16} className="text-gray-600" />
                            ) : (
                              <ChevronDown
                                size={16}
                                className="text-gray-600"
                              />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-500">
                          {s.id.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-gray-400" />
                            <span className="text-sm font-medium text-gray-800">
                              {s.cashier_name || "Sistema"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-green-700">
                          ${formatCurrency(s.total)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1 text-sm">
                            {s.payment_method === "cash" && (
                              <DollarSign
                                size={14}
                                className="text-green-600"
                              />
                            )}
                            {s.payment_method === "card" && (
                              <CreditCard size={14} className="text-blue-600" />
                            )}
                            {s.payment_method === "transfer" && (
                              <Landmark size={14} className="text-purple-600" />
                            )}
                            {s.payment_method === "cash"
                              ? "Efectivo"
                              : s.payment_method === "card"
                                ? "Tarjeta"
                                : "Transferencia"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${s.status === "completed" ? "bg-green-100 text-green-800" : s.status === "cancelled" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
                          >
                            {s.status === "completed"
                              ? "Completada"
                              : s.status === "cancelled"
                                ? "Cancelada"
                                : "Pendiente"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-center font-bold text-blue-600">
                          {totalCantidad}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(s.created_at)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => printTicket(s.id)}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1 mx-auto transition-colors text-sm"
                            title="Re-imprimir ticket"
                          >
                            <Printer size={14} /> Ticket
                          </button>
                        </td>
                      </tr>
                      {expandedRow === s.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="ml-8">
                              <div className="flex items-center gap-2 mb-4">
                                <Package size={18} className="text-blue-500" />
                                <h4 className="font-semibold text-gray-700 text-lg">
                                  Detalle de la venta
                                </h4>
                                <span className="text-sm text-gray-500">
                                  (Total unidades: {totalCantidad})
                                </span>
                              </div>
                              {isLoadingDetails ? (
                                <div className="flex justify-center py-8">
                                  <Loader2
                                    className="animate-spin text-blue-600"
                                    size={28}
                                  />
                                  <span className="ml-2 text-gray-600">
                                    Cargando productos...
                                  </span>
                                </div>
                              ) : saleDetail?.items ? (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm">
                                    <thead>
                                      <tr className="border-b-2 border-gray-200 bg-gray-100">
                                        <th className="text-left py-3 px-4 text-gray-600 font-semibold">
                                          Imagen
                                        </th>
                                        <th className="text-left py-3 px-4 text-gray-600 font-semibold">
                                          Producto
                                        </th>
                                        <th className="text-center py-3 px-4 text-gray-600 font-semibold">
                                          Cantidad
                                        </th>
                                        <th className="text-right py-3 px-4 text-gray-600 font-semibold">
                                          Precio Unit.
                                        </th>
                                        <th className="text-right py-3 px-4 text-gray-600 font-semibold">
                                          Subtotal
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {saleDetail.items.map((item, idx) => (
                                        <tr
                                          key={idx}
                                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                        >
                                          <td className="py-3 px-4">
                                            {/* ✅ CORREGIDO: Usar getProductImageUrl */}
                                            <ProductImage
                                              imageUrl={item.image}
                                              productName={item.name}
                                            />
                                          </td>
                                          <td className="py-3 px-4">
                                            <div className="flex flex-col">
                                              <span className="font-medium text-gray-800">
                                                {item.name}
                                              </span>
                                              {item.sku && (
                                                <span className="text-xs text-gray-400 mt-1">
                                                  SKU: {item.sku}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="text-center py-3 px-4">
                                            <span className="font-bold text-blue-600 text-lg">
                                              {item.quantity}
                                            </span>
                                          </td>
                                          <td className="text-right py-3 px-4 text-gray-700">
                                            ${formatCurrency(item.unitPrice)}
                                          </td>
                                          <td className="text-right py-3 px-4">
                                            <span className="font-semibold text-gray-800">
                                              ${formatCurrency(item.subtotal)}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2 border-gray-200 bg-gray-100">
                                        <td
                                          colSpan="2"
                                          className="py-3 px-4 text-right font-bold text-gray-700"
                                        >
                                          TOTAL UNIDADES:
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          <span className="font-bold text-blue-600 text-lg">
                                            {totalCantidad}
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-gray-700">
                                          TOTAL:
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                          <span className="font-bold text-green-700 text-xl">
                                            ${formatCurrency(saleDetail.total)}
                                          </span>
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-center py-8 text-gray-500">
                                  <AlertCircle
                                    className="mx-auto mb-2"
                                    size={32}
                                  />
                                  No se pudieron cargar los productos
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
            Mostrando {sales.length} de {pagination.total} registros
          </div>
          <div className="flex items-center gap-4">
            <button
              disabled={pagination.page === 1}
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={18} /> Anterior
            </button>
            <div className="flex gap-1">
              {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                let pageNum;
                if (pagination.totalPages <= 5) pageNum = i + 1;
                else if (pagination.page <= 3) pageNum = i + 1;
                else if (pagination.page >= pagination.totalPages - 2)
                  pageNum = pagination.totalPages - 4 + i;
                else pageNum = pagination.page - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: pageNum }))
                    }
                    className={`px-3 py-1 rounded-lg transition-colors ${pagination.page === pageNum ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              disabled={pagination.page === pagination.totalPages}
              onClick={() =>
                setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
              }
              className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
            >
              Siguiente <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

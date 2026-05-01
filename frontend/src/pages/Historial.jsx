import {
  useState,
  useEffect,
  Fragment,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useReactToPrint } from "react-to-print";
import { useAuth } from "../store/authStore";
import api from "../api";
import Swal from "sweetalert2";
import jsPDF from "jspdf";
import { useConfig } from "../context/ConfigContext";
import { useTranslation } from "../context/LanguageContext";
import LoaderPOS from "../components/LoaderPOS";
import MoneyDisplay from "../components/MoneyDisplay";
import TicketToPrint from "../components/TicketToPrint";
import {
  History,
  Calendar,
  ChevronLeft,
  ChevronRight,
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
  Banknote,
  X,
  FileText,
  ArrowDownRight,
  RefreshCw,
  User,
  SlidersHorizontal,
} from "lucide-react";

const DEFAULT_ITEMS_PER_PAGE = 20;
const MAX_REPORT_RECORDS = 500;
const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || "http://localhost:3000";

const imageCache = new Map();
const MAX_CACHE_SIZE = 30;

const imageToBase64 = async (url, width = 60, height = 60, quality = 0.95) => {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);
  try {
    const response = await fetch(url, {
      mode: "cors",
      headers: { Accept: "image/*" },
      cache: "force-cache",
    });
    if (!response.ok) throw new Error("Fetch failed");
    const blob = await response.blob();
    const objUrl = URL.createObjectURL(blob);
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => {
        URL.revokeObjectURL(objUrl);
        res(i);
      };
      i.onerror = () => {
        URL.revokeObjectURL(objUrl);
        rej(new Error("Image load failed"));
      };
      i.src = objUrl;
    });
    const canvas = document.createElement("canvas");
    const ratio = img.width / img.height;
    canvas.width = ratio > 1 ? width : Math.round(height * ratio);
    canvas.height = ratio > 1 ? Math.round(width / ratio) : height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL("image/jpeg", quality);
    if (imageCache.size >= MAX_CACHE_SIZE)
      imageCache.delete(imageCache.keys().next().value);
    imageCache.set(url, b64);
    return b64;
  } catch {
    return null;
  }
};

const addPageFooter = (
  pdf,
  pageNum,
  totalPages,
  pageWidth,
  pageHeight,
  companyName,
) => {
  const footerY = pageHeight - 12;
  pdf.setDrawColor(150, 160, 170);
  pdf.setLineWidth(0.2);
  pdf.line(15, footerY, pageWidth - 15, footerY);
  pdf.setTextColor(100, 110, 120);
  pdf.setFontSize(5);
  pdf.setFont("helvetica", "normal");
  pdf.text(`${companyName || "POS"} • Documento Confidencial`, 15, footerY + 4);
  pdf.text(`Página ${pageNum} de ${totalPages}`, pageWidth / 2, footerY + 4, {
    align: "center",
  });
  pdf.text(
    `Generado: ${new Date().toLocaleString("es-UY")}`,
    pageWidth - 15,
    footerY + 4,
    { align: "right" },
  );
};

const renderMainTableHeader = (pdf, y, mL, mR, pageW) => {
  const cW = pageW - mL - mR;
  pdf.setFillColor(28, 42, 58);
  pdf.rect(mL, y, cW, 8, "F");
  pdf.setDrawColor(180, 170, 130);
  pdf.setLineWidth(0.2);
  pdf.line(mL, y + 8, mL + cW, y + 8);
  pdf.setTextColor(230, 235, 240);
  pdf.setFontSize(6.5);
  pdf.setFont("helvetica", "bold");
  const cols = [
    { t: "ID Venta", x: mL + 3 },
    { t: "Fecha / Hora", x: mL + 22 },
    { t: "Operador", x: mL + 48 },
    { t: "Items", x: mL + 82, a: "center" },
    { t: "Método Pago", x: mL + 98 },
    { t: "Estado", x: mL + 124 },
    { t: "Total", x: mL + 150, a: "right" },
  ];
  cols.forEach((c) => pdf.text(c.t, c.x, y + 5, { align: c.a || "left" }));
  return y + 8;
};

const renderProductsTableHeader = (pdf, y, mL, contentW) => {
  pdf.setFillColor(245, 247, 250);
  pdf.rect(mL + 5, y, contentW - 5, 5, "F");
  pdf.setDrawColor(200, 205, 210);
  pdf.setLineWidth(0.15);
  pdf.line(mL + 5, y, mL + contentW, y);
  pdf.line(mL + 5, y + 5, mL + contentW, y + 5);
  pdf.setTextColor(60, 65, 70);
  pdf.setFontSize(5);
  pdf.setFont("helvetica", "bold");
  pdf.text("Imagen", mL + 7, y + 3);
  pdf.text("Descripción del Producto", mL + 18, y + 3);
  pdf.text("Cant", mL + 88, y + 3, { align: "center" });
  pdf.text("Precio Unit.", mL + 105, y + 3, { align: "right" });
  pdf.text("Subtotal", mL + 132, y + 3, { align: "right" });
  return y + 5;
};

export default function Historial() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { config, loading: configLoading } = useConfig();

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [saleDetails, setSaleDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [globalStats, setGlobalStats] = useState({
    totalVentas: 0,
    totalTransacciones: 0,
    porMetodo: { efectivo: 0, tarjeta: 0, transferencia: 0 },
  });
  const [filteredStats, setFilteredStats] = useState({
    totalVentas: 0,
    totalTransacciones: 0,
    porMetodo: { efectivo: 0, tarjeta: 0, transferencia: 0 },
  });
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [advancedFilters, setAdvancedFilters] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    paymentMethod: "",
    status: "",
  });
  const [activeDateFilter, setActiveDateFilter] = useState("today");
  const [refundModal, setRefundModal] = useState(false);
  const [refundSale, setRefundSale] = useState(null);
  const [refundItems, setRefundItems] = useState({});
  const [refundReason, setRefundReason] = useState("");
  const [processingRefund, setProcessingRefund] = useState(false);
  const [isCreditNote, setIsCreditNote] = useState(false);
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [creditCustomerName, setCreditCustomerName] = useState("");
  const [creditCf, setCreditCf] = useState(false);
  const [creditFe, setCreditFe] = useState("");
  const [showTicket, setShowTicket] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const ticketRef = useRef(null);

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

  const applyDateFilter = (type) => {
    let start = getTodayDate(),
      end = getTodayDate();
    if (type === "week") start = getWeekAgoDate();
    if (type === "month") start = getMonthAgoDate();
    setActiveDateFilter(type);
    setAdvancedFilters((p) => ({ ...p, startDate: start, endDate: end }));
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const applyTypeFilter = (type, val) => {
    setAdvancedFilters((p) => ({
      ...p,
      paymentMethod: type === "payment" ? val : "",
      status: type === "status" ? val : "",
      startDate: p.startDate,
      endDate: p.endDate,
    }));
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters({
      startDate: getTodayDate(),
      endDate: getTodayDate(),
      paymentMethod: "",
      status: "",
    });
    setActiveDateFilter("today");
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const hasActiveFilters = useMemo(
    () =>
      advancedFilters.startDate !== getTodayDate() ||
      advancedFilters.endDate !== getTodayDate() ||
      advancedFilters.paymentMethod ||
      advancedFilters.status,
    [advancedFilters],
  );

  const getProductImageUrl = useCallback(
    (u) =>
      u
        ? u.startsWith("http")
          ? u
          : `${UPLOADS_URL}${u.startsWith("/") ? u : "/" + u}`
        : null,
    [],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bp = new URLSearchParams();
      if (advancedFilters.startDate)
        bp.append("start", advancedFilters.startDate);
      if (advancedFilters.endDate) bp.append("end", advancedFilters.endDate);
      if (advancedFilters.paymentMethod)
        bp.append("paymentMethod", advancedFilters.paymentMethod);
      if (advancedFilters.status) bp.append("status", advancedFilters.status);
      const pp = new URLSearchParams(bp);
      pp.append("page", pagination.page);
      pp.append(
        "limit",
        config?.appearance?.itemsPerPage || DEFAULT_ITEMS_PER_PAGE,
      );
      const res = await api.get(`/sales?${pp.toString()}`);
      setSales(res.data.data || []);
      setPagination(
        res.data.pagination || { page: 1, totalPages: 1, total: 0 },
      );
      const sp = new URLSearchParams(bp);
      sp.append("limit", "9999");
      const sr = await api.get(`/sales?${sp.toString()}`);
      const fs = sr.data.data || [];
      setFilteredStats({
        totalTransacciones: fs.length,
        totalVentas: fs.reduce((s, v) => s + parseFloat(v.total || 0), 0),
        porMetodo: {
          efectivo: fs
            .filter((v) => v.payment_method === "cash")
            .reduce((s, v) => s + parseFloat(v.total || 0), 0),
          tarjeta: fs
            .filter((v) => v.payment_method === "card")
            .reduce((s, v) => s + parseFloat(v.total || 0), 0),
          transferencia: fs
            .filter((v) => v.payment_method === "transfer")
            .reduce((s, v) => s + parseFloat(v.total || 0), 0),
        },
      });
      const gp = new URLSearchParams();
      if (advancedFilters.startDate)
        gp.append("start", advancedFilters.startDate);
      if (advancedFilters.endDate) gp.append("end", advancedFilters.endDate);
      if (advancedFilters.paymentMethod)
        gp.append("paymentMethod", advancedFilters.paymentMethod);
      gp.append("limit", "9999");
      gp.append("status", "completed");
      const gr = await api.get(`/sales?${gp.toString()}`);
      const cs = gr.data.data || [];
      setGlobalStats({
        totalTransacciones: cs.length,
        totalVentas: cs.reduce((s, v) => s + parseFloat(v.total || 0), 0),
        porMetodo: {
          efectivo: cs
            .filter((v) => v.payment_method === "cash")
            .reduce((s, v) => s + parseFloat(v.total || 0), 0),
          tarjeta: cs
            .filter((v) => v.payment_method === "card")
            .reduce((s, v) => s + parseFloat(v.total || 0), 0),
          transferencia: cs
            .filter((v) => v.payment_method === "transfer")
            .reduce((s, v) => s + parseFloat(v.total || 0), 0),
        },
      });
      setSaleDetails({});
      setExpandedRow(null);
    } catch (err) {
      setError(err.response?.data?.message || "Error");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, advancedFilters, config?.appearance?.itemsPerPage]);

  const loadSaleDetails = async (id) => {
    if (saleDetails[id]) return;
    setLoadingDetails((p) => ({ ...p, [id]: true }));
    try {
      const r = await api.get(`/sales/${id}`);
      if (r.data?.success) setSaleDetails((p) => ({ ...p, [id]: r.data.data }));
    } finally {
      setLoadingDetails((p) => ({ ...p, [id]: false }));
    }
  };
  const toggleExpand = async (id) =>
    expandedRow === id
      ? setExpandedRow(null)
      : (setExpandedRow(id), await loadSaleDetails(id));
  useEffect(() => {
    if (user && !configLoading) loadData();
  }, [loadData, user, configLoading]);
  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [advancedFilters]);

  const formatDate = (d) =>
    new Date(d).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const getColor = (n) =>
    [
      "from-blue-500 to-blue-600",
      "from-green-500 to-green-600",
      "from-purple-500 to-purple-600",
      "from-pink-500 to-pink-600",
    ][(n?.length || 0) % 4];
  const ProductImage = ({ imageUrl, productName }) => {
    const [e, se] = useState(false);
    const f = productName?.[0] || "?";
    return !imageUrl || e ? (
      <div
        className={`w-14 h-14 bg-gradient-to-br ${getColor(productName)} rounded-xl flex items-center justify-center text-white font-bold text-xl`}
      >
        {f}
      </div>
    ) : (
      <img
        src={getProductImageUrl(imageUrl)}
        alt={productName}
        className="w-14 h-14 object-cover rounded-xl border-2 border-gray-200 shadow-md hover:scale-105 transition"
        onError={() => se(true)}
      />
    );
  };

  const handlePrint = useReactToPrint({
    contentRef: ticketRef,
    onAfterPrint: () => {
      setShowTicket(false);
      setLastSale(null);
    },
  });
  const printTicket = async (id) => {
    try {
      const r = await api.get(`/sales/${id}`);
      if (r.data?.success) {
        setLastSale({
          saleId: r.data.data.id,
          total: r.data.data.total,
          createdAt: r.data.data.createdAt,
          paymentMethod: r.data.data.paymentMethod,
          items: r.data.data.items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit_price: i.unitPrice,
          })),
        });
        setShowTicket(true);
        setTimeout(() => handlePrint(), 300);
      }
    } catch {
      Swal.fire("Error", "No se pudo cargar ticket", "error");
    }
  };

  const openRefundModal = async (sale) => {
    setRefundSale(sale);
    setIsCreditNote(false);
    setCreditNoteNumber("");
    setCreditCustomerName("");
    setCreditCf(false);
    setCreditFe("");
    try {
      const r = await api.get(`/sales/${sale.id}`);
      if (r.data?.success && r.data.data?.items) {
        const init = {};
        r.data.data.items.forEach((i) => (init[i.productId] = 0));
        setRefundItems(init);
        setSaleDetails((p) => ({ ...p, [sale.id]: r.data.data }));
      }
    } catch {
      Swal.fire("Error", "Fallo detalles", "error");
      return;
    }
    setRefundReason("");
    setRefundModal(true);
  };
  const handleRefundSubmit = async () => {
    if (!refundSale) return;
    const items = Object.entries(refundItems)
      .filter(([, q]) => q > 0)
      .map(([pid, q]) => ({ product_id: pid, quantity: parseInt(q) }));
    if (!items.length)
      return Swal.fire("Atención", "Selecciona productos", "warning");
    if (
      isCreditNote &&
      (!creditNoteNumber.trim() || !creditCustomerName.trim())
    )
      return Swal.fire("Incompleto", "Faltan datos NC", "warning");
    setProcessingRefund(true);
    try {
      const p = {
        sale_id: refundSale.id,
        items,
        reason: refundReason || "Devolución",
      };
      if (isCreditNote) {
        p.credit_note_number = creditNoteNumber.trim();
        p.customer_name = creditCustomerName.trim();
        p.cf = creditCf;
        p.fe = creditFe.trim() || null;
      }
      const r = await api.post("/refunds", p);
      if (r.data.success) {
        Swal.fire({
          icon: "success",
          title: isCreditNote ? "Nota Crédito" : "Devolución",
          text: `$${r.data.data.totalRefunded.toFixed(2)}`,
        });
        setRefundModal(false);
        loadData();
      }
    } catch (e) {
      Swal.fire("Error", e.response?.data?.message, "error");
    } finally {
      setProcessingRefund(false);
    }
  };

  const generatePDFReport = async () => {
    setGeneratingReport(true);
    try {
      Swal.fire({
        title: "Generando Reporte",
        html: "Preparando documento profesional...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      const bp = new URLSearchParams();
      if (advancedFilters.startDate)
        bp.append("start", advancedFilters.startDate);
      if (advancedFilters.endDate) bp.append("end", advancedFilters.endDate);
      if (advancedFilters.paymentMethod)
        bp.append("paymentMethod", advancedFilters.paymentMethod);
      if (advancedFilters.status) bp.append("status", advancedFilters.status);
      bp.append("limit", MAX_REPORT_RECORDS);
      const res = await api.get(`/sales?${bp.toString()}`);
      const allSales = res.data.data || [];
      if (!allSales.length) {
        Swal.fire(
          "Sin datos",
          "No hay ventas para el período seleccionado",
          "info",
        );
        setGeneratingReport(false);
        return;
      }
      const ids = allSales.map((s) => s.id);
      const det = await Promise.all(
        ids.map((id) =>
          api
            .get(`/sales/${id}`)
            .then((r) => r.data?.data || null)
            .catch(() => null),
        ),
      );
      const detMap = {};
      det.forEach((r, i) => {
        if (r) detMap[ids[i]] = r;
      });
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      const pW = pdf.internal.pageSize.getWidth(),
        pH = pdf.internal.pageSize.getHeight();
      const mL = 12,
        mR = 12,
        cW = pW - mL - mR;
      const companyName = config?.invoice?.companyName || "MI TIENDA POS";
      let logoB64 = null;
      if (config?.invoice?.logo) {
        try {
          logoB64 = await imageToBase64(config.invoice.logo, 32, 32, 0.95);
        } catch {}
      }
      let y = 15;
      pdf.setFillColor(18, 45, 80);
      pdf.rect(0, 0, pW, 45, "F");
      pdf.setFillColor(25, 60, 100);
      pdf.rect(0, 0, pW, 20, "F");
      pdf.setDrawColor(220, 180, 100);
      pdf.setLineWidth(1.5);
      pdf.line(0, 44, pW, 44);
      pdf.setLineWidth(0.3);
      pdf.line(0, 45, pW, 45);
      if (logoB64) {
        pdf.addImage(logoB64, "JPEG", mL, 8, 30, 30, undefined, "FAST");
      } else {
        pdf.setFillColor(30, 60, 95);
        pdf.roundedRect(mL, 8, 30, 30, 3, 3, "F");
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(mL, 8, 30, 30, 3, 3, "D");
        pdf.setTextColor(180, 190, 200);
        pdf.setFontSize(6);
        pdf.text("LOGO", mL + 15, 21, { align: "center" });
        pdf.text("EMPRESA", mL + 15, 26, { align: "center" });
      }
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text(companyName.toUpperCase(), pW / 2, 16, { align: "center" });
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(200, 210, 220);
      pdf.text("REPORTE DE VENTAS", pW / 2, 23, { align: "center" });
      pdf.setFontSize(8);
      pdf.text(
        `${advancedFilters.startDate} y ${advancedFilters.endDate}`,
        pW / 2,
        29,
        { align: "center" },
      );
      pdf.setFontSize(7);
      pdf.setTextColor(180, 190, 200);
      pdf.text(`Período de consulta`, pW / 2, 34, { align: "center" });
      pdf.setFontSize(7);
      pdf.setTextColor(180, 190, 200);
      pdf.text(`Generado: ${new Date().toLocaleString("es-UY")}`, pW - mR, 12, {
        align: "right",
      });
      pdf.text(`Usuario: ${user?.name || "Administrador"}`, pW - mR, 17, {
        align: "right",
      });
      pdf.text(`Documento: Reporte Comercial`, pW - mR, 22, { align: "right" });
      y = 52;
      pdf.setFillColor(25, 55, 109);
      pdf.roundedRect(mL, y, cW, 7, 1.5, 1.5, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.text("RESUMEN DEL PERÍODO", mL + 4, y + 4.5);
      y += 12;
      const stats = advancedFilters.status ? filteredStats : globalStats;
      const cardW = (cW - 8) / 2;
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(mL, y, cardW, 20, 2, 2, "F");
      pdf.setDrawColor(25, 55, 109);
      pdf.setLineWidth(1.5);
      pdf.line(mL, y, mL + cardW, y);
      pdf.setTextColor(90, 100, 110);
      pdf.setFontSize(6);
      pdf.text("Total Transacciones", mL + 4, y + 6);
      pdf.setTextColor(25, 55, 109);
      pdf.setFontSize(15);
      pdf.text(String(stats.totalTransacciones), mL + 4, y + 15);
      const midX = mL + cardW + 8;
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(midX, y, cardW, 20, 2, 2, "F");
      pdf.setDrawColor(22, 163, 74);
      pdf.setLineWidth(1.5);
      pdf.line(midX, y, midX + cardW, y);
      pdf.setTextColor(90, 100, 110);
      pdf.setFontSize(6);
      pdf.text("Ingresos Totales", midX + 4, y + 6);
      pdf.setTextColor(22, 163, 74);
      pdf.setFontSize(15);
      pdf.text(`$${stats.totalVentas.toFixed(2)}`, midX + 4, y + 15);
      y += 26;
      pdf.setTextColor(30, 40, 50);
      pdf.setFontSize(8);
      pdf.text("Distribución por Método", mL, y);
      y += 5;
      const pd = [
        { l: "Efectivo", v: stats.porMetodo?.efectivo || 0, c: [34, 197, 94] },
        { l: "Tarjeta", v: stats.porMetodo?.tarjeta || 0, c: [59, 130, 246] },
        {
          l: "Transferencia",
          v: stats.porMetodo?.transferencia || 0,
          c: [168, 85, 247],
        },
      ];
      const barW = 95;
      pd.forEach((it) => {
        const fill =
          stats.totalVentas > 0 ? (it.v / stats.totalVentas) * barW : 0;
        pdf.setFontSize(5.5);
        pdf.setTextColor(50, 50, 50);
        pdf.text(it.l, mL, y + 3);
        pdf.setFillColor(235, 238, 240);
        pdf.roundedRect(mL + 28, y, barW, 4, 1, 1, "F");
        if (fill > 0) {
          pdf.setFillColor(...it.c);
          pdf.roundedRect(mL + 28, y, fill, 4, 1, 1, "F");
        }
        pdf.setTextColor(30, 40, 50);
        pdf.text(`$${it.v.toFixed(2)}`, mL + 32 + barW + 3, y + 3);
        pdf.setTextColor(120, 120, 120);
        pdf.text(
          `(${stats.totalVentas > 0 ? ((it.v / stats.totalVentas) * 100).toFixed(1) : "0.0"}%)`,
          mL + 32 + barW + 25,
          y + 3,
        );
        y += 7;
      });
      y += 6;
      y = renderMainTableHeader(pdf, y, mL, mR, pW);
      const toShow = allSales.slice(0, 150);
      let currentPage = 1;
      for (let i = 0; i < toShow.length; i++) {
        const sale = toShow[i];
        const d = detMap[sale.id];
        const needed = d?.items ? 20 + d.items.length * 10 : 15;
        if (y + needed > pH - 30) {
          addPageFooter(
            pdf,
            currentPage,
            Math.max(currentPage + 5, 10),
            pW,
            pH,
            companyName,
          );
          pdf.addPage();
          currentPage++;
          y = 15;
          y = renderMainTableHeader(pdf, y, mL, mR, pW);
        }
        const isC = sale.status === "completed";
        const sCol = isC ? [22, 163, 74] : [249, 115, 22];
        const sTxt = isC ? "COMPLETADA" : "REEMBOLSO";
        const bg = i % 2 === 0 ? [255, 255, 255] : [250, 251, 252];
        pdf.setFillColor(...bg);
        pdf.rect(mL, y, cW, 10, "F");
        pdf.setFillColor(...sCol);
        pdf.rect(mL, y, 2, 10, "F");
        pdf.setDrawColor(220, 225, 230);
        pdf.setLineWidth(0.15);
        pdf.line(mL, y, mL + cW, y);
        pdf.setTextColor(30, 40, 50);
        pdf.setFontSize(6);
        pdf.setFont("courier", "bold");
        pdf.text(`#${sale.id.slice(0, 10)}`, mL + 4, y + 5.5);
        pdf.setFont("helvetica", "normal");
        pdf.text(formatDate(sale.created_at), mL + 23, y + 5.5);
        pdf.text(sale.cashier_name || "Sistema", mL + 49, y + 5.5);
        pdf.text(
          String(d?.items?.reduce((a, b) => a + b.quantity, 0) || 0),
          mL + 84,
          y + 5.5,
          { align: "center" },
        );
        const mInfo = {
          cash: { t: "Efectivo", c: [22, 163, 74] },
          card: { t: "Tarjeta", c: [59, 130, 246] },
          transfer: { t: "Transfer", c: [139, 92, 247] },
        }[sale.payment_method] || { t: "N/A", c: [100, 100, 100] };
        pdf.setTextColor(...mInfo.c);
        pdf.text(mInfo.t, mL + 100, y + 5.5);
        pdf.setFillColor(...sCol);
        pdf.roundedRect(mL + 126, y + 2, 18, 5, 1.5, 1.5, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(5);
        pdf.text(sTxt, mL + 135, y + 5, { align: "center" });
        pdf.setTextColor(30, 40, 50);
        pdf.setFontSize(8);
        pdf.text(`$${parseFloat(sale.total).toFixed(2)}`, mL + 155, y + 5.5, {
          align: "right",
        });
        y += 10.5;
        if (d?.items?.length) {
          y = renderProductsTableHeader(pdf, y, mL, cW);
          for (let j = 0; j < d.items.length; j++) {
            const item = d.items[j];
            if (y + 12 > pH - 25) {
              addPageFooter(
                pdf,
                currentPage,
                currentPage + 5,
                pW,
                pH,
                companyName,
              );
              pdf.addPage();
              currentPage++;
              y = 15;
              y = renderMainTableHeader(pdf, y, mL, mR, pW);
            }
            pdf.setFillColor(255, 255, 255);
            pdf.rect(mL + 5, y, cW - 5, 10, "F");
            pdf.setDrawColor(230, 232, 235);
            pdf.setLineWidth(0.15);
            pdf.line(mL + 5, y, mL + cW, y);
            pdf.line(mL + 5, y + 10, mL + cW, y + 10);
            if (item.image) {
              try {
                const u = getProductImageUrl(item.image);
                const b = await imageToBase64(u, 55, 55, 0.95);
                if (b) {
                  pdf.addImage(
                    b,
                    "JPEG",
                    mL + 6,
                    y + 0.5,
                    9,
                    9,
                    undefined,
                    "FAST",
                  );
                  pdf.setDrawColor(180, 185, 190);
                  pdf.setLineWidth(0.2);
                  pdf.rect(mL + 6, y + 0.5, 9, 9, "D");
                }
              } catch {
                pdf.setFillColor(240, 242, 245);
                pdf.rect(mL + 6, y + 0.5, 9, 9, "F");
              }
            } else {
              pdf.setFillColor(230, 232, 235);
              pdf.roundedRect(mL + 6, y + 0.5, 9, 9, 1, 1, "F");
              pdf.setTextColor(120, 125, 130);
              pdf.setFontSize(6);
              pdf.text(
                (item.name?.[0] || "?").toUpperCase(),
                mL + 10.5,
                y + 5.5,
                { align: "center" },
              );
            }
            pdf.setTextColor(30, 40, 50);
            pdf.setFontSize(5.5);
            pdf.text(
              (item.name || "").length > 40
                ? item.name.substring(0, 37) + "..."
                : item.name,
              mL + 17,
              y + 4,
            );
            if (item.sku) {
              pdf.setTextColor(140, 145, 150);
              pdf.setFontSize(4.5);
              pdf.text(`SKU: ${item.sku}`, mL + 17, y + 7);
            }
            pdf.setFont("helvetica", "bold");
            pdf.text(String(item.quantity), mL + 88, y + 4, {
              align: "center",
            });
            pdf.text(`$${(item.unitPrice || 0).toFixed(2)}`, mL + 105, y + 4, {
              align: "right",
            });
            pdf.text(
              `$${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}`,
              mL + 132,
              y + 4,
              { align: "right" },
            );
            y += 10;
          }
        }
        pdf.setDrawColor(60, 70, 80);
        pdf.setLineWidth(0.4);
        pdf.line(mL, y, mL + cW, y);
        pdf.setLineWidth(0.1);
        pdf.setDrawColor(200, 205, 210);
        y += 4;
      }
      const totalP = pdf.internal.getNumberOfPages();
      for (let p = 1; p <= totalP; p++) {
        pdf.setPage(p);
        addPageFooter(pdf, p, totalP, pW, pH, companyName);
      }
      pdf.setProperties({
        title: `Reporte ${companyName}`,
        author: user?.name || "POS",
        creator: "POS Pro",
      });
      pdf.save(
        `${companyName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
      );
      Swal.fire({
        icon: "success",
        title: "PDF Generado",
        text: `${toShow.length} ventas incluidas`,
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("ERR PDF:", err);
      Swal.fire({ icon: "error", title: "Error", text: err.message });
    } finally {
      setGeneratingReport(false);
    }
  };

  const exportToCSV = () => {
    if (!sales.length) return;
    const h = ["ID", "Fecha", "Cajero", "Total", "Método", "Estado"];
    const r = sales.map((s) => [
      s.id.slice(0, 8),
      formatDate(s.created_at),
      s.cashier_name || "N/A",
      parseFloat(s.total || 0).toFixed(2),
      { cash: "Efectivo", card: "Tarjeta", transfer: "Transfer" }[
        s.payment_method
      ],
      { completed: "Completada", refunded: "Reembolsado" }[s.status],
    ]);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([h.join(",") + "\n" + r.map((x) => x.join(",")).join("\n")], {
        type: "text/csv",
      }),
    );
    link.download = `ventas_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  if (loading && !sales.length)
    return <LoaderPOS message={t("historial.loading")} />;
  if (error && !loading)
    return (
      <div className="flex flex-col items-center justify-center h-64 p-4">
        <AlertCircle className="text-amber-500 mb-4" size={48} />
        <h3 className="text-lg font-bold text-gray-900 mb-2">Error</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={loadData}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Reintentar
        </button>
      </div>
    );

  const dStats = advancedFilters.status ? filteredStats : globalStats;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="text-blue-600" size={28} />
            {t("historial.title")}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {user?.role === "admin"
              ? t("historial.subtitle_admin")
              : t("historial.subtitle_cashier")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            disabled={!sales.length}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 transition"
          >
            <Download size={16} />
            CSV
          </button>
          <button
            onClick={generatePDFReport}
            disabled={generatingReport || !sales.length}
            className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-lg hover:from-red-700 hover:to-red-800 flex items-center gap-2 disabled:opacity-50 transition shadow-md"
          >
            {generatingReport ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <FileText size={16} />
                PDF
              </>
            )}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-sm font-medium">
                Transacciones {advancedFilters.status ? "(Filtrado)" : ""}
              </p>
              <p className="text-4xl font-bold mt-2">
                {dStats.totalTransacciones}
              </p>
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
                Ingresos {advancedFilters.status ? "(Filtrado)" : ""}
              </p>
              <p className="text-4xl font-bold mt-2">
                <MoneyDisplay amount={dStats.totalVentas} />
              </p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <DollarSign size={28} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Banknote size={12} />
                <span>Efectivo</span>
                <span className="font-semibold">
                  <MoneyDisplay amount={dStats.porMetodo.efectivo} />
                </span>
              </div>
              <div className="flex items-center gap-1">
                <CreditCard size={12} />
                <span>Tarjeta</span>
                <span className="font-semibold">
                  <MoneyDisplay amount={dStats.porMetodo.tarjeta} />
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Landmark size={12} />
                <span>Transfer</span>
                <span className="font-semibold">
                  <MoneyDisplay amount={dStats.porMetodo.transferencia} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
          >
            <SlidersHorizontal size={16} />
            Filtros{" "}
            {hasActiveFilters && (
              <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            )}
          </button>
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyDateFilter("today")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${activeDateFilter === "today" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            <Calendar size={16} />
            Hoy
          </button>
          <button
            onClick={() => applyDateFilter("week")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${activeDateFilter === "week" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            <Calendar size={16} />
            Semana
          </button>
          <button
            onClick={() => applyDateFilter("month")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition ${activeDateFilter === "month" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            <Calendar size={16} />
            Mes
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyTypeFilter("payment", "")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${!advancedFilters.paymentMethod && !advancedFilters.status ? "bg-blue-500 text-white shadow" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            Todos
          </button>
          <button
            onClick={() => applyTypeFilter("payment", "cash")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${advancedFilters.paymentMethod === "cash" ? "bg-green-500 text-white shadow" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
          >
            Efectivo
          </button>
          <button
            onClick={() => applyTypeFilter("payment", "card")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${advancedFilters.paymentMethod === "card" ? "bg-blue-500 text-white shadow" : "bg-blue-100 text-blue-700 hover:bg-blue-200"}`}
          >
            Tarjeta
          </button>
          <button
            onClick={() => applyTypeFilter("payment", "transfer")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${advancedFilters.paymentMethod === "transfer" ? "bg-purple-500 text-white shadow" : "bg-purple-100 text-purple-700 hover:bg-purple-200"}`}
          >
            Transfer
          </button>
          <button
            onClick={() => applyTypeFilter("status", "completed")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${advancedFilters.status === "completed" ? "bg-emerald-500 text-white shadow" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
          >
            Completadas
          </button>
          <button
            onClick={() => applyTypeFilter("status", "refunded")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${advancedFilters.status === "refunded" ? "bg-orange-500 text-white shadow" : "bg-orange-100 text-orange-700 hover:bg-orange-200"}`}
          >
            Reembolsos
          </button>
        </div>
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">Desde</label>
              <input
                type="date"
                className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg"
                value={advancedFilters.startDate}
                onChange={(e) => {
                  setAdvancedFilters((p) => ({
                    ...p,
                    startDate: e.target.value,
                  }));
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Hasta</label>
              <input
                type="date"
                className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg"
                value={advancedFilters.endDate}
                onChange={(e) => {
                  setAdvancedFilters((p) => ({
                    ...p,
                    endDate: e.target.value,
                  }));
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">
                Método
              </label>
              <select
                className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg"
                value={advancedFilters.paymentMethod}
                onChange={(e) => {
                  setAdvancedFilters((p) => ({
                    ...p,
                    paymentMethod: e.target.value,
                    status: "",
                  }));
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              >
                <option value="">Todos</option>
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="transfer">Transfer</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">
                Estado
              </label>
              <select
                className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg"
                value={advancedFilters.status}
                onChange={(e) => {
                  setAdvancedFilters((p) => ({
                    ...p,
                    status: e.target.value,
                    paymentMethod: "",
                  }));
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              >
                <option value="">Todos</option>
                <option value="completed">Completadas</option>
                <option value="refunded">Reembolsos</option>
              </select>
            </div>
            {hasActiveFilters && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={clearAdvancedFilters}
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {!sales.length ? (
          <div className="text-center py-12">
            <History className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 font-medium">
              {hasActiveFilters
                ? "Sin resultados con estos filtros"
                : "No hay ventas"}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAdvancedFilters}
                className="mt-4 text-blue-600 hover:underline text-sm"
              >
                Limpiar
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="w-10 px-6 py-3"></th>
                  <th className="px-6 py-3">ID</th>
                  <th className="px-6 py-3">Cajero</th>
                  <th className="px-6 py-3">Total</th>
                  <th className="px-6 py-3">Método</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3 text-center">Items</th>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((s) => {
                  const d = saleDetails[s.id];
                  const ld = loadingDetails[s.id];
                  const tq =
                    d?.items?.reduce((a, b) => a + b.quantity, 0) ||
                    s.items_count ||
                    0;
                  return (
                    <Fragment key={s.id}>
                      <tr className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleExpand(s.id)}
                            className="hover:bg-gray-200 p-1 rounded transition"
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
                            <span className="text-sm font-medium">
                              {s.cashier_name || "Sistema"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-green-700">
                          <MoneyDisplay amount={s.total} />
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1 text-sm">
                            {s.payment_method === "cash"
                              ? "Efectivo"
                              : s.payment_method === "card"
                                ? "Tarjeta"
                                : "Transfer"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full font-medium ${s.status === "completed" ? "bg-green-100 text-green-800" : s.status === "refunded" ? "bg-orange-100 text-orange-800" : "bg-yellow-100 text-yellow-800"}`}
                          >
                            {s.status === "completed"
                              ? "Completada"
                              : s.status === "refunded"
                                ? "Reembolsado"
                                : "Pendiente"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-center font-bold text-blue-600">
                          {tq}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(s.created_at)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => printTicket(s.id)}
                              className="bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 transition"
                              title="Ticket"
                            >
                              <Printer size={14} />
                            </button>
                            {s.status === "completed" && (
                              <button
                                onClick={() => openRefundModal(s)}
                                className="bg-orange-600 text-white p-1.5 rounded-lg hover:bg-orange-700 transition"
                                title="Devolver"
                              >
                                <ArrowDownRight size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedRow === s.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="ml-8">
                              <div className="flex items-center gap-2 mb-3">
                                <Package size={16} className="text-blue-500" />
                                <h4 className="font-semibold text-gray-700">
                                  Detalle
                                </h4>
                              </div>
                              {ld ? (
                                <div className="py-4 text-gray-600">
                                  Cargando...
                                </div>
                              ) : d?.items ? (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-gray-200">
                                        <th className="text-left py-2 px-3 text-gray-600 font-semibold">
                                          Producto
                                        </th>
                                        <th className="text-center py-2 px-3 text-gray-600 font-semibold">
                                          Cant.
                                        </th>
                                        <th className="text-right py-2 px-3 text-gray-600 font-semibold">
                                          P.Unit
                                        </th>
                                        <th className="text-right py-2 px-3 text-gray-600 font-semibold">
                                          Subtotal
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {d.items.map((it, idx) => (
                                        <tr
                                          key={idx}
                                          className="border-b border-gray-100"
                                        >
                                          <td className="py-2 px-3">
                                            <div className="flex items-center gap-2">
                                              <ProductImage
                                                imageUrl={it.image}
                                                productName={it.name}
                                              />
                                              <span className="font-medium">
                                                {it.name}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="text-center py-2 px-3 font-bold">
                                            {it.quantity}
                                          </td>
                                          <td className="text-right py-2 px-3">
                                            <MoneyDisplay
                                              amount={it.unitPrice}
                                            />
                                          </td>
                                          <td className="text-right py-2 px-3 font-semibold">
                                            <MoneyDisplay
                                              amount={it.subtotal}
                                            />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="py-4 text-gray-500">
                                  Sin detalles
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
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
            <div className="text-sm text-gray-600">
              {sales.length} de {pagination.total}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page === 1}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page - 1 }))
                }
                className="px-3 py-1.5 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg transition flex items-center gap-1"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex gap-1">
                {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                  let pn =
                    pagination.totalPages <= 5
                      ? i + 1
                      : pagination.page <= 3
                        ? i + 1
                        : pagination.page >= pagination.totalPages - 2
                          ? pagination.totalPages - 4 + i
                          : pagination.page - 2 + i;
                  return (
                    <button
                      key={pn}
                      onClick={() => setPagination((p) => ({ ...p, page: pn }))}
                      className={`px-3 py-1.5 rounded-lg transition ${pagination.page === pn ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                    >
                      {pn}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={pagination.page === pagination.totalPages}
                onClick={() =>
                  setPagination((p) => ({ ...p, page: p.page + 1 }))
                }
                className="px-3 py-1.5 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg transition flex items-center gap-1"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      {refundModal && refundSale && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !processingRefund && setRefundModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Devolución</h2>
                <p className="text-orange-100 text-sm">
                  #{refundSale.id.slice(0, 8)} - $
                  {parseFloat(refundSale.total).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => !processingRefund && setRefundModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              <div className="bg-white rounded-xl p-3 border">
                {saleDetails[refundSale.id]?.items?.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between py-2 border-b last:border-b-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        ${item.unitPrice.toFixed(2)} x {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={item.quantity}
                        value={refundItems[item.productId] || 0}
                        onChange={(e) => {
                          const v = Math.min(
                            Math.max(0, parseInt(e.target.value) || 0),
                            item.quantity,
                          );
                          setRefundItems((p) => ({
                            ...p,
                            [item.productId]: v,
                          }));
                        }}
                        className="w-14 text-center border rounded py-1 text-sm"
                        disabled={processingRefund}
                      />
                      <span className="text-xs text-gray-500">
                        / {item.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
                <input
                  type="checkbox"
                  checked={isCreditNote}
                  onChange={(e) => setIsCreditNote(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded"
                  disabled={processingRefund}
                />
                <label className="text-sm font-medium">Nota de Crédito</label>
              </div>
              {isCreditNote && (
                <div className="space-y-2 bg-white p-3 rounded-lg border border-blue-200">
                  <div>
                    <label className="text-xs text-gray-500">N° NC *</label>
                    <input
                      type="text"
                      value={creditNoteNumber}
                      onChange={(e) => setCreditNoteNumber(e.target.value)}
                      className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
                      placeholder="NC-001"
                      disabled={processingRefund}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Cliente *</label>
                    <input
                      type="text"
                      value={creditCustomerName}
                      onChange={(e) => setCreditCustomerName(e.target.value)}
                      className="w-full mt-1 px-2 py-1.5 border rounded text-sm"
                      placeholder="Nombre"
                      disabled={processingRefund}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={creditCf}
                      onChange={(e) => setCreditCf(e.target.checked)}
                      className="rounded text-blue-600"
                      disabled={processingRefund}
                    />
                    <label className="text-sm text-gray-600">C.F.</label>
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Motivo
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Motivo..."
                  disabled={processingRefund}
                />
              </div>
            </div>
            <div className="border-t p-3 bg-white flex justify-between items-center">
              <div className="text-sm">
                Reembolso:{" "}
                <strong className="text-lg text-green-600">
                  $
                  {Object.entries(refundItems)
                    .reduce((t, [pid, q]) => {
                      const i = saleDetails[refundSale.id]?.items?.find(
                        (x) => x.productId === pid,
                      );
                      return t + q * (i?.unitPrice || 0);
                    }, 0)
                    .toFixed(2)}
                </strong>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setRefundModal(false)}
                  disabled={processingRefund}
                  className="px-3 py-1.5 border rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRefundSubmit}
                  disabled={
                    processingRefund ||
                    Object.values(refundItems).every((q) => q === 0)
                  }
                  className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition flex items-center gap-1"
                >
                  <ArrowDownRight size={14} />
                  Procesar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div
        style={{
          display: showTicket && lastSale ? "block" : "none",
          position: "absolute",
          left: "-9999px",
          top: 0,
        }}
      >
        {lastSale && (
          <TicketToPrint
            ref={ticketRef}
            saleData={lastSale}
            items={lastSale.items}
            storeInfo={{ cashier: user?.name || "Admin" }}
            config={config}
          />
        )}
      </div>
    </div>
  );
}

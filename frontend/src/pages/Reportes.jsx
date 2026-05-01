// frontend/src/pages/Reportes.jsx
import { useState, useEffect, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2"; // ← IMPORTACIÓN CORREGIDA
import { useConfig } from "../context/ConfigContext";
import { useTranslation } from "../context/LanguageContext";
import LoaderPOS from "../components/LoaderPOS";
import MoneyDisplay from "../components/MoneyDisplay";
import jsPDF from "jspdf";
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
  ShoppingBag,
  Zap,
  Trophy,
  Medal,
  Award,
  Star,
  Filter,
  X,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

const DEFAULT_ITEMS_PER_PAGE = 20;
const MAX_REPORT_RECORDS = 200;

/* ========================================================
   CACHÉ DE IMÁGENES PARA EL PDF
   ======================================================== */
const imageCache = new Map();
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
        rej(new Error("img"));
      };
      i.src = objUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);
    const b64 = canvas.toDataURL("image/jpeg", quality);
    if (imageCache.size >= 30)
      imageCache.delete(imageCache.keys().next().value);
    imageCache.set(url, b64);
    return b64;
  } catch {
    return null;
  }
};

/* ========================================================
   ANIMACIONES
   ======================================================== */
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: "easeOut" },
  }),
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

/* ========================================================
   COMPONENTES AUXILIARES
   ======================================================== */
function Badge({ children, variant = "default", className = "" }) {
  const variants = {
    default: "bg-blue-500 text-white",
    secondary: "bg-gray-100 text-gray-700",
    outline: "border border-gray-200 bg-white text-gray-700",
    green: "bg-green-100 text-green-700",
    orange: "bg-orange-100 text-orange-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

function Skeleton({ className = "" }) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-200/70 ${className}`} />
  );
}

/* ========================================================
   TARJETA ESTADÍSTICA – ESTILO Stock.jsx
   ======================================================== */
function StatCard({
  icon: Icon,
  label,
  value,
  color,
  isCurrency = false,
  index = 0,
}) {
  const colorMap = {
    blue: {
      from: "from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20",
      border: "border-blue-200 dark:border-blue-800",
      text: "text-blue-700 dark:text-blue-300",
      icon: "text-blue-600 dark:text-blue-400",
    },
    green: {
      from: "from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20",
      border: "border-emerald-200 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-300",
      icon: "text-emerald-600 dark:text-emerald-400",
    },
    amber: {
      from: "from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20",
      border: "border-amber-200 dark:border-amber-800",
      text: "text-amber-700 dark:text-amber-300",
      icon: "text-amber-600 dark:text-amber-400",
    },
    purple: {
      from: "from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20",
      border: "border-purple-200 dark:border-purple-800",
      text: "text-purple-700 dark:text-purple-300",
      icon: "text-purple-600 dark:text-purple-400",
    },
    teal: {
      from: "from-teal-50 to-teal-100 dark:from-teal-900/20 dark:to-teal-800/20",
      border: "border-teal-200 dark:border-teal-800",
      text: "text-teal-700 dark:text-teal-300",
      icon: "text-teal-600 dark:text-teal-400",
    },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      custom={index}
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`rounded-2xl p-5 border shadow-sm bg-gradient-to-br ${c.from} ${c.border}`}
    >
      <div className="flex items-center gap-4">
        <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <Icon size={28} className={c.icon} />
        </div>
        <div>
          <p className={`text-sm font-medium ${c.text}`}>{label}</p>
          <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
            {isCurrency ? (
              <MoneyDisplay amount={value} />
            ) : (
              value.toLocaleString()
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ========================================================
   PRODUCTO TOP
   ======================================================== */
function TopProductCard({ product, rank }) {
  const medals = [
    {
      border: "border-amber-400",
      bg: "from-amber-50 to-yellow-50",
      badge: "bg-amber-100 text-amber-700",
      icon: <Trophy size={16} className="text-amber-600" />,
    },
    {
      border: "border-gray-300",
      bg: "from-gray-50 to-white",
      badge: "bg-gray-100 text-gray-700",
      icon: <Medal size={16} className="text-gray-500" />,
    },
    {
      border: "border-orange-300",
      bg: "from-orange-50 to-white",
      badge: "bg-orange-100 text-orange-700",
      icon: <Award size={16} className="text-orange-600" />,
    },
  ];
  const m = medals[rank] || medals[2];
  const imgSrc = product.image_url
    ? `${import.meta.env.VITE_UPLOADS_URL || "http://localhost:3000"}${product.image_url.startsWith("/") ? "" : "/"}${product.image_url}`
    : null;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      custom={rank}
      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 ${m.border} bg-gradient-to-br ${m.bg} hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${m.badge} shadow-sm`}
      >
        {rank + 1}
      </div>
      <div className="w-11 h-11 rounded-xl bg-white border border-gray-200 overflow-hidden flex-shrink-0 shadow-sm">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.product_name}
            className="w-full h-full object-cover"
            onError={(e) => (e.target.style.display = "none")}
          />
        ) : (
          <Star size={16} className="text-gray-400 m-3" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">
          {product.product_name}
        </p>
        <p className="text-xs text-gray-500">{product.total_quantity} uds.</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-blue-600">
          <MoneyDisplay amount={product.total_amount} />
        </p>
        <p className="text-[10px] text-gray-400 uppercase">total</p>
      </div>
      <div className="ml-1">{m.icon}</div>
    </motion.div>
  );
}

/* ========================================================
   COMPONENTE PRINCIPAL
   ======================================================== */
export default function Reportes() {
  const { t } = useTranslation();
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
  const [recentSalesItems, setRecentSalesItems] = useState({});
  const [loadingSales, setLoadingSales] = useState(false);
  const [topProducts, setTopProducts] = useState([]);
  const [loadingTopProducts, setLoadingTopProducts] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Estado para expandir las filas de últimas ventas
  const [expandedSalesRow, setExpandedSalesRow] = useState(null);

  const itemsPerPage =
    config?.appearance?.itemsPerPage || DEFAULT_ITEMS_PER_PAGE;

  const getDateRange = (p) => {
    const today = new Date();
    const fmt = (d) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .split("T")[0];
    const start = new Date(today);
    if (p === "daily") start.setHours(0, 0, 0, 0);
    else if (p === "weekly") start.setDate(today.getDate() - 7);
    else if (p === "monthly") start.setMonth(today.getMonth() - 1);
    return { start: fmt(start), end: fmt(today) };
  };

  // --------------- FUNCIONES DE CARGA ---------------
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const range =
        filters.startDate && filters.endDate
          ? { start: filters.startDate, end: filters.endDate }
          : getDateRange(period);
      params.append("start", range.start);
      params.append("end", range.end);
      if (filters.paymentMethod)
        params.append("paymentMethod", filters.paymentMethod);
      if (filters.cashierId) params.append("cashierId", filters.cashierId);
      const res = await api.get(`/reports/dashboard?${params.toString()}`);
      setData(res.data.data);
    } catch (err) {
      console.error("Error cargando reportes:", err);
      setError(err.response?.data?.message || t("reportes.error_loading"));
    } finally {
      setLoading(false);
    }
  };

  const loadTopProducts = async () => {
    setLoadingTopProducts(true);
    try {
      const params = new URLSearchParams();
      const range =
        filters.startDate && filters.endDate
          ? { start: filters.startDate, end: filters.endDate }
          : getDateRange(period);
      params.append("start", range.start);
      params.append("end", range.end);
      const res = await api.get(`/reports/top-products?${params.toString()}`);
      setTopProducts(res.data.data || []);
    } catch (err) {
      console.error("Error top products:", err);
    } finally {
      setLoadingTopProducts(false);
    }
  };

  const loadRecentSales = async () => {
    setLoadingSales(true);
    try {
      const params = new URLSearchParams();
      const range =
        filters.startDate && filters.endDate
          ? { start: filters.startDate, end: filters.endDate }
          : getDateRange(period);
      params.append("start", range.start);
      params.append("end", range.end);
      if (filters.paymentMethod)
        params.append("paymentMethod", filters.paymentMethod);
      if (filters.cashierId) params.append("cashierId", filters.cashierId);
      params.append("page", salesPage);
      params.append("limit", itemsPerPage);
      params.append("status", "completed");
      const res = await api.get(`/sales?${params.toString()}`);
      const salesList = res.data.data || [];
      setRecentSales(salesList);
      setSalesPagination(res.data.pagination || { totalPages: 1, total: 0 });
      // Obtener los ítems de cada venta
      const detailsPromises = salesList.map((sale) =>
        api
          .get(`/sales/${sale.id}`)
          .then((r) => ({ id: sale.id, items: r.data?.data?.items || [] }))
          .catch(() => ({ id: sale.id, items: [] })),
      );
      const details = await Promise.all(detailsPromises);
      const itemsMap = {};
      details.forEach((d) => {
        itemsMap[d.id] = d.items;
      });
      setRecentSalesItems(itemsMap);
    } catch (err) {
      console.error("Error recent sales:", err);
    } finally {
      setLoadingSales(false);
    }
  };

  useEffect(() => {
    if (!configLoading) {
      loadData();
      loadTopProducts();
    }
  }, [period, filters, configLoading]);
  useEffect(() => {
    if (!configLoading) loadRecentSales();
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

  const { barData, pieData } = useMemo(() => {
    const s = data?.summary || {};
    const bar = [
      { name: "Efectivo", value: s.cash_total || 0, fill: "#22c55e" },
      { name: "Tarjeta", value: s.card_total || 0, fill: "#3b82f6" },
      { name: "Transferencia", value: s.transfer_total || 0, fill: "#8b5cf6" },
    ];
    return { barData: bar, pieData: bar.filter((d) => d.value > 0) };
  }, [data]);

  const ChartTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xl">
          <p className="text-sm text-gray-700 font-medium">{label}</p>
          <p className="text-blue-600 font-bold">
            <MoneyDisplay amount={payload[0].value} />
          </p>
        </div>
      );
    }
    return null;
  };

  // --------------- GENERACIÓN DE PDF ---------------
  const generatePDFReport = async () => {
    setGeneratingPDF(true);
    try {
      Swal.fire({
        title: "Generando Reporte",
        html: "Preparando documento profesional...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      const bp = new URLSearchParams();
      if (filters.startDate) bp.append("start", filters.startDate);
      if (filters.endDate) bp.append("end", filters.endDate);
      if (filters.paymentMethod)
        bp.append("paymentMethod", filters.paymentMethod);
      if (filters.cashierId) bp.append("cashierId", filters.cashierId);
      bp.append("limit", MAX_REPORT_RECORDS);
      const salesRes = await api.get(`/sales?${bp.toString()}`);
      const allSales = salesRes.data.data || [];
      if (!allSales.length) {
        Swal.fire("Sin datos", "No hay ventas en el período", "info");
        setGeneratingPDF(false);
        return;
      }

      const saleIds = allSales.map((s) => s.id);
      const detailsRes = await Promise.all(
        saleIds.map((id) =>
          api.get(`/sales/${id}`).catch(() => ({ data: { data: null } })),
        ),
      );
      const allDetails = {};
      detailsRes.forEach((r, i) => {
        if (r.data?.data) allDetails[saleIds[i]] = r.data.data;
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
      pdf.setDrawColor(220, 180, 100);
      pdf.setLineWidth(1.5);
      pdf.line(0, 44, pW, 44);
      if (logoB64) {
        pdf.addImage(logoB64, "JPEG", mL, 8, 30, 30, undefined, "FAST");
      }
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.text(companyName.toUpperCase(), pW / 2, 16, { align: "center" });
      pdf.setFontSize(11);
      pdf.text("REPORTE DE VENTAS", pW / 2, 23, { align: "center" });
      pdf.setFontSize(8);
      pdf.text(
        `${filters.startDate || "Inicio"} al ${filters.endDate || "Hoy"}`,
        pW / 2,
        29,
        { align: "center" },
      );
      pdf.setFontSize(7);
      pdf.setTextColor(180, 190, 200);
      pdf.text(
        `Generado: ${new Date().toLocaleString("es-UY")} | Usuario: ${user?.name || "Admin"}`,
        pW - mR,
        12,
        { align: "right" },
      );

      y = 52;
      pdf.setFillColor(25, 55, 109);
      pdf.roundedRect(mL, y, cW, 7, 1.5, 1.5, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.text("RESUMEN DEL PERÍODO", mL + 4, y + 4.5);
      y += 12;
      const s = data?.summary || {};
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(mL, y, cW, 20, 2, 2, "F");
      pdf.setTextColor(90, 100, 110);
      pdf.setFontSize(6);
      pdf.text("Total Ventas", mL + 4, y + 6);
      pdf.setTextColor(25, 55, 109);
      pdf.setFontSize(15);
      pdf.text(String(s.total_sales || 0), mL + 4, y + 15);
      pdf.setTextColor(22, 163, 74);
      pdf.setFontSize(15);
      pdf.text(
        `$${(s.total_revenue || 0).toFixed(2)}`,
        mL + cW / 2 + 4,
        y + 15,
      );
      y += 26;
      pdf.setTextColor(30, 40, 50);
      pdf.setFontSize(8);
      pdf.text("Distribución por Método", mL, y);
      y += 5;
      const pd = [
        { l: "Efectivo", v: s.cash_total || 0, c: [34, 197, 94] },
        { l: "Tarjeta", v: s.card_total || 0, c: [59, 130, 246] },
        { l: "Transferencia", v: s.transfer_total || 0, c: [168, 85, 247] },
      ];
      const barW = 95;
      pd.forEach((it) => {
        const fill =
          (s.total_revenue || 0) > 0 ? (it.v / s.total_revenue) * barW : 0;
        pdf.setFontSize(5.5);
        pdf.text(it.l, mL, y + 3);
        pdf.setFillColor(235, 238, 240);
        pdf.roundedRect(mL + 28, y, barW, 4, 1, 1, "F");
        if (fill > 0) {
          pdf.setFillColor(...it.c);
          pdf.roundedRect(mL + 28, y, fill, 4, 1, 1, "F");
        }
        pdf.text(`$${it.v.toFixed(2)}`, mL + 32 + barW + 3, y + 3);
        y += 7;
      });

      y += 6;
      // Tabla de ventas recientes
      const toShow = allSales.slice(0, MAX_REPORT_RECORDS);
      let page = 1;
      const addPageFooter = (pdf, p, tp, comp) => {
        const fY = pdf.internal.pageSize.getHeight() - 10;
        pdf.setDrawColor(150, 160, 170);
        pdf.setLineWidth(0.2);
        pdf.line(15, fY, pdf.internal.pageSize.getWidth() - 15, fY);
        pdf.setTextColor(100, 110, 120);
        pdf.setFontSize(5);
        pdf.text(`${comp || "POS"} • Documento Confidencial`, 15, fY + 4);
        pdf.text(
          `Página ${p} de ${tp}`,
          pdf.internal.pageSize.getWidth() / 2,
          fY + 4,
          { align: "center" },
        );
      };

      toShow.forEach((sale, idx) => {
        const details = allDetails[sale.id];
        if (!details?.items) return;
        if (y > 250) {
          addPageFooter(pdf, page, Math.max(page + 5, 10), companyName);
          pdf.addPage();
          page++;
          y = 15;
        }
        pdf.setFillColor(
          idx % 2 === 0 ? 255 : 250,
          idx % 2 === 0 ? 255 : 250,
          idx % 2 === 0 ? 255 : 250,
        );
        pdf.rect(mL, y, cW, 10, "F");
        pdf.setFontSize(6);
        pdf.setTextColor(30, 40, 50);
        pdf.text(`#${sale.id.slice(0, 8)}`, mL + 2, y + 5);
        pdf.text(
          new Date(sale.created_at).toLocaleString("es-ES"),
          mL + 35,
          y + 5,
        );
        pdf.text(sale.cashier_name || "Sistema", mL + 70, y + 5);
        pdf.text(`$${parseFloat(sale.total).toFixed(2)}`, mL + 120, y + 5);
        const productos = details.items
          .map((i) => `${i.name} x${i.quantity}`)
          .join(", ");
        pdf.setTextColor(80);
        pdf.text(
          productos.length > 60
            ? productos.substring(0, 57) + "..."
            : productos,
          mL + 2,
          y + 9,
        );
        y += 12;
      });

      const totalP = pdf.internal.getNumberOfPages();
      for (let p = 1; p <= totalP; p++) {
        pdf.setPage(p);
        addPageFooter(pdf, p, totalP, companyName);
      }
      pdf.save(
        `${companyName.replace(/\s+/g, "_")}_reporte_${new Date().toISOString().split("T")[0]}.pdf`,
      );
      Swal.fire({
        icon: "success",
        title: "PDF descargado",
        text: "Reporte generado exitosamente",
        timer: 2500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("Error PDF:", err);
      Swal.fire("Error", "No se pudo generar el PDF", "error");
    } finally {
      setGeneratingPDF(false);
    }
  };

  // --------------- RENDER ---------------
  if (loading && !data)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoaderPOS message={t("reportes.loading")} />
      </div>
    );
  if (error)
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center h-64 p-4"
      >
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {t("reportes.error_title")}
        </h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={loadData} className="btn-primary">
          {t("reportes.retry")}
        </button>
      </motion.div>
    );

  const s = data?.summary || {};
  const cashiers = data?.by_cashier || [];
  const top3 = topProducts.slice(0, 3);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="space-y-6 pb-8 max-w-[1600px] mx-auto"
    >
      {/* Encabezado */}
      <motion.div variants={fadeInUp} className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <TrendingUp className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                {t("reportes.title")}
              </h1>
              <p className="text-sm text-gray-500">{t("reportes.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={async () => {
                await loadData();
                await loadTopProducts();
                await loadRecentSales();
              }}
              className="btn-ghost"
              title={t("reportes.refresh")}
            >
              <RefreshCw size={18} />
            </button>
            <div className="flex rounded-xl bg-gray-100 p-1">
              {Object.entries({
                daily: t("reportes.daily"),
                weekly: t("reportes.weekly"),
                monthly: t("reportes.monthly"),
              }).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => handlePeriodChange(k)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${period === k && !filters.startDate ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              onClick={generatePDFReport}
              disabled={generatingPDF || !data}
              className="btn-primary"
            >
              <FileText size={16} className="mr-1" /> PDF
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filtros */}
      <motion.div variants={fadeInUp} className="card p-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <Filter size={16} /> {t("reportes.filter_advanced")}
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </button>
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <div>
                <label className="text-xs font-medium text-gray-500">
                  {t("reportes.from")}
                </label>
                <input
                  type="date"
                  className="input"
                  value={filters.startDate}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, startDate: e.target.value }));
                    setPeriod("");
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">
                  {t("reportes.to")}
                </label>
                <input
                  type="date"
                  className="input"
                  value={filters.endDate}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, endDate: e.target.value }));
                    setPeriod("");
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">
                  {t("reportes.payment_method")}
                </label>
                <select
                  className="input"
                  value={filters.paymentMethod}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, paymentMethod: e.target.value }))
                  }
                >
                  <option value="">{t("reportes.all")}</option>
                  <option value="cash">{t("reportes.cash")}</option>
                  <option value="card">{t("reportes.card")}</option>
                  <option value="transfer">{t("reportes.transfer")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">
                  {t("reportes.cashier")}
                </label>
                <select
                  className="input"
                  value={filters.cashierId}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, cashierId: e.target.value }))
                  }
                >
                  <option value="">{t("reportes.all_cashiers")}</option>
                  {cashiers.map((c, i) => (
                    <option key={i} value={c.cashier_id}>
                      {c.cashier_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-full flex justify-end gap-2 mt-2">
                <button onClick={clearFilters} className="btn-secondary">
                  {t("reportes.clear_filters")}
                </button>
                <button
                  onClick={async () => {
                    await loadData();
                    await loadTopProducts();
                    await loadRecentSales();
                  }}
                  className="btn-primary"
                >
                  {t("reportes.apply") || "Aplicar"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Tarjetas estadísticas */}
      <motion.div
        variants={stagger}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
      >
        <StatCard
          icon={TrendingUp}
          label={t("reportes.sales")}
          value={s.total_sales || 0}
          color="blue"
          index={0}
        />
        <StatCard
          icon={DollarSign}
          label={t("reportes.income")}
          value={s.total_revenue || 0}
          color="green"
          isCurrency
          index={1}
        />
        <StatCard
          icon={Banknote}
          label={t("reportes.cash")}
          value={s.cash_total || 0}
          color="amber"
          isCurrency
          index={2}
        />
        <StatCard
          icon={CreditCard}
          label={t("reportes.card")}
          value={s.card_total || 0}
          color="purple"
          isCurrency
          index={3}
        />
        <StatCard
          icon={Landmark}
          label={t("reportes.transfer")}
          value={s.transfer_total || 0}
          color="teal"
          isCurrency
          index={4}
        />
      </motion.div>

      {/* Gráficos + Top productos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={fadeInUp} className="lg:col-span-2 card p-5">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Zap size={20} className="text-blue-600" /> Distribución de Ingresos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ left: 30, right: 20 }}
                >
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#4ade80" />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#60a5fa" />
                    </linearGradient>
                    <linearGradient id="g3" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={75}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "#f3f4f6", opacity: 0.6 }}
                  />
                  <Bar dataKey="value" barSize={26} radius={[6, 6, 6, 6]}>
                    {barData.map((_, i) => (
                      <Cell key={i} fill={`url(#g${i + 1})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {pieData.length > 0 ? (
              <div className="h-64 flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={42}
                      paddingAngle={3}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={barData[i].fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={32}
                      formatter={(v) => (
                        <span className="text-xs text-gray-600 ml-1">{v}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex gap-3 mt-2">
                  {pieData.map((item, i) => {
                    const total = pieData.reduce((a, b) => a + b.value, 0);
                    const p =
                      total > 0 ? Math.round((item.value / total) * 100) : 0;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: barData[i].fill }}
                        />
                        <span className="text-gray-600">{p}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <ShoppingBag size={28} className="mr-2 text-gray-300" /> Sin
                datos
              </div>
            )}
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="card p-5">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Trophy size={20} className="text-amber-500" /> Más Vendidos
          </h3>
          {loadingTopProducts ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-7 h-7 rounded-lg" />
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : top3.length > 0 ? (
            <div className="space-y-3">
              {top3.map((p, i) => (
                <TopProductCard key={p.product_id} product={p} rank={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <ShoppingBag size={32} className="mx-auto mb-2" />
              Sin datos
            </div>
          )}
        </motion.div>
      </div>

      {/* Desempeño por cajero */}
      <motion.div variants={fadeInUp} className="table-container">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
          <Users size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-900">
            {t("reportes.performance_title")}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Cajero</th>
                <th className="text-center">Ventas</th>
                <th className="text-right">Recaudado</th>
                <th className="text-right hidden sm:table-cell">Promedio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cashiers.length ? (
                cashiers.map((c, i) => {
                  const avg =
                    c.total_sales > 0 ? c.total_collected / c.total_sales : 0;
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="font-medium flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {c.cashier_name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        {c.cashier_name}
                      </td>
                      <td className="text-center">
                        <span className="badge badge-info">
                          {c.total_sales}
                        </span>
                      </td>
                      <td className="text-right font-semibold text-green-700">
                        <MoneyDisplay amount={c.total_collected} />
                      </td>
                      <td className="text-right text-gray-500 hidden sm:table-cell">
                        <MoneyDisplay amount={avg} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="text-center py-10 text-gray-400">
                    <Users size={28} className="mx-auto mb-2" />
                    <p>{t("reportes.no_data")}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Últimas ventas (con expansión para ver productos) */}
      <motion.div variants={fadeInUp} className="table-container">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">
              {t("reportes.recent_sales_title")}
            </h2>
          </div>
          {salesPagination.total > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {salesPagination.total} ventas
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          {loadingSales ? (
            <div className="flex justify-center py-8">
              <LoaderPOS message={t("reportes.loading_sales")} />
            </div>
          ) : recentSales.length ? (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10"></th>
                    <th>ID</th>
                    <th>Cajero</th>
                    <th className="text-center">Items</th>
                    <th className="text-right">Total</th>
                    <th>Método</th>
                    <th className="hidden sm:table-cell">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentSales.map((sale) => {
                    const isExpanded = expandedSalesRow === sale.id;
                    const items = recentSalesItems[sale.id] || [];
                    return (
                      <>
                        <tr
                          key={sale.id}
                          className="hover:bg-gray-50 cursor-pointer transition"
                          onClick={() =>
                            setExpandedSalesRow(isExpanded ? null : sale.id)
                          }
                        >
                          <td className="px-2 py-4 text-center">
                            <button className="hover:bg-gray-200 p-1 rounded">
                              {isExpanded ? (
                                <ChevronUp
                                  size={16}
                                  className="text-gray-600"
                                />
                              ) : (
                                <ChevronDown
                                  size={16}
                                  className="text-gray-600"
                                />
                              )}
                            </button>
                          </td>
                          <td className="font-mono text-xs text-gray-500">
                            #{sale.id?.slice(0, 6).toUpperCase()}
                          </td>
                          <td className="font-medium">
                            {sale.cashier_name || t("reportes.system")}
                          </td>
                          <td className="text-center">
                            <span className="badge badge-info">
                              {sale.items_count || 0}
                            </span>
                          </td>
                          <td className="text-right font-semibold text-green-700">
                            <MoneyDisplay amount={sale.total} />
                          </td>
                          <td>
                            <span
                              className={`badge ${sale.payment_method === "cash" ? "badge-success" : sale.payment_method === "card" ? "badge-info" : "badge-purple"}`}
                            >
                              {sale.payment_method === "cash"
                                ? t("reportes.cash")
                                : sale.payment_method === "card"
                                  ? t("reportes.card")
                                  : t("reportes.transfer")}
                            </span>
                          </td>
                          <td className="text-gray-500 text-xs hidden sm:table-cell">
                            {new Date(sale.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                        {isExpanded && items.length > 0 && (
                          <tr>
                            <td colSpan={7} className="bg-gray-50 px-6 py-3">
                              <div className="ml-8">
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                                        <th className="py-2 px-3">Producto</th>
                                        <th className="py-2 px-3 text-center">
                                          Cant.
                                        </th>
                                        <th className="py-2 px-3 text-right">
                                          P. Unit
                                        </th>
                                        <th className="py-2 px-3 text-right">
                                          Subtotal
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {items.map((item, idx) => (
                                        <tr
                                          key={idx}
                                          className="border-b border-gray-100 hover:bg-gray-50"
                                        >
                                          <td className="py-2 px-3 font-medium">
                                            {item.name}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            {item.quantity}
                                          </td>
                                          <td className="py-2 px-3 text-right">
                                            <MoneyDisplay
                                              amount={item.unitPrice}
                                            />
                                          </td>
                                          <td className="py-2 px-3 text-right font-semibold">
                                            <MoneyDisplay
                                              amount={item.subtotal}
                                            />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
              {salesPagination.totalPages > 1 && (
                <div className="flex justify-between items-center gap-4 bg-white p-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    {recentSales.length} de {salesPagination.total} ventas
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSalesPage((p) => Math.max(1, p - 1))}
                      disabled={salesPage === 1}
                      className="btn-ghost"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="flex gap-1">
                      {[...Array(Math.min(5, salesPagination.totalPages))].map(
                        (_, i) => {
                          let pn =
                            salesPagination.totalPages <= 5
                              ? i + 1
                              : salesPage <= 3
                                ? i + 1
                                : salesPage >= salesPagination.totalPages - 2
                                  ? salesPagination.totalPages - 4 + i
                                  : salesPage - 2 + i;
                          return (
                            <button
                              key={pn}
                              onClick={() => setSalesPage(pn)}
                              className={`w-8 h-8 rounded-lg text-sm font-medium ${salesPage === pn ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                            >
                              {pn}
                            </button>
                          );
                        },
                      )}
                    </div>
                    <button
                      onClick={() =>
                        setSalesPage((p) =>
                          Math.min(salesPagination.totalPages, p + 1),
                        )
                      }
                      disabled={salesPage === salesPagination.totalPages}
                      className="btn-ghost"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <Package size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="font-medium text-gray-700">
                No hay ventas en el período seleccionado
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

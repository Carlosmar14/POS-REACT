// frontend/src/pages/Caja.jsx
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useReactToPrint } from "react-to-print";
import api from "../api";
import { useCart } from "../store/cartStore";
import { useAuth } from "../store/authStore";
import Swal from "sweetalert2";
import TicketToPrint from "../components/TicketToPrint";
import LoaderPOS from "../components/LoaderPOS"; // ✅ Importamos tu componente
import {
  Search,
  Minus,
  Plus,
  Trash2,
  Package,
  Printer,
  CreditCard,
  Banknote,
  Receipt,
  ShoppingCart,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Camera,
  // ✅ Íconos para categorías (mismos que en Categorias.jsx)
  Apple,
  GlassWater,
  SprayCan,
  HeartPulse,
  Hammer,
  Cog,
  Smartphone,
  PenLine,
  Blocks,
  Dog,
  ShoppingBag,
  Shirt,
  Snowflake,
  Croissant,
  Milk,
  Ham,
  Carrot,
  Wheat,
  Sparkles,
  Pill,
  Wrench,
  Lightbulb,
  Palette,
  Sprout,
  Tag,
  Coffee,
  Pizza,
  Utensils,
  Laptop,
  Home,
  Car,
  Book,
  Gamepad2,
  Music,
  Camera as CameraIcon,
  Gift,
  Store,
  Grid,
} from "lucide-react";

// ✅ SEPARAR URL de API y URL de UPLOADS para imágenes
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || "http://localhost:3000";
const DEFAULT_ITEMS_PER_PAGE = 9;

// ✅ Mapeo de íconos (idéntico al de Categorias.jsx)
const ICON_OPTIONS = {
  Apple,
  GlassWater,
  SprayCan,
  HeartPulse,
  Hammer,
  Cog,
  Smartphone,
  PenLine,
  Blocks,
  Dog,
  ShoppingBag,
  Shirt,
  Snowflake,
  Croissant,
  Milk,
  Ham,
  Carrot,
  Wheat,
  Sparkles,
  Pill,
  Wrench,
  Lightbulb,
  Palette,
  Sprout,
  Tag,
  Package,
  Coffee,
  Pizza,
  Utensils,
  Laptop,
  Home,
  Car,
  Book,
  Gamepad2,
  Music,
  CameraIcon,
  Gift,
  Store,
  Grid,
};

// ✅ Estilos para SweetAlert2
const swalStyles = `
  .swal2-popup { border-radius: 20px !important; padding: 20px !important; }
  .swal2-title { font-size: 24px !important; font-weight: 700 !important; color: #1f2937 !important; }
  .swal2-confirm {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
    color: white !important; padding: 12px 28px !important; border-radius: 12px !important;
  }
  .swal2-cancel {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
    color: white !important; padding: 12px 28px !important; border-radius: 12px !important;
  }
  .swal2-actions { gap: 16px !important; margin-top: 20px !important; }
`;

if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = swalStyles;
  document.head.appendChild(styleSheet);
}

export default function Caja() {
  const { user } = useAuth();
  const { items, addToCart, updateQty, clear, total } = useCart();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payment, setPayment] = useState("cash");
  const [showTicket, setShowTicket] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);

  // ✅ Estado para la configuración completa
  const [fullConfig, setFullConfig] = useState({});

  // ✅ Estado para la configuración de la empresa (para el ticket)
  const [storeInfo, setStoreInfo] = useState({
    companyName: "CAFÉ UNIVERSAL",
    companyAddress: "Avda. Central, 4",
    companyPhone: "📞 555-123-456",
    footerMessage: "Muchas gracias por su visita",
    logo: "",
    website: "www.cafeuniversal.com",
    promoMessage:
      "Le recordamos que cada mañana ofrecemos desayuno té o café con croissant por 1,40 €",
    taxRate: 10,
    showTaxInfo: true,
    paperSize: "80mm",
    companyRuc: "C-91233456",
  });

  const [editingQty, setEditingQty] = useState(null);

  const ticketRef = useRef(null);
  const searchInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // ✅ Función helper para construir URL de imágenes correctamente
  const getProductImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `${UPLOADS_URL}${imageUrl.startsWith("/") ? imageUrl : "/" + imageUrl}`;
  };

  // ✅ Cargar configuración desde la base de datos
  const loadConfiguracion = async () => {
    try {
      const response = await api.get("/configuracion");
      if (response.data.success && response.data.data) {
        const config = response.data.data;
        setFullConfig(config);

        const perPage =
          config.appearance?.itemsPerPage || DEFAULT_ITEMS_PER_PAGE;
        setItemsPerPage(perPage);

        const invoice = config.invoice || {};
        const system = config.system || {};

        setStoreInfo({
          companyName: invoice.companyName || "CAFÉ UNIVERSAL",
          companyAddress: invoice.companyAddress || "Avda. Central, 4",
          companyPhone: invoice.companyPhone || "📞 555-123-456",
          footerMessage:
            invoice.footerMessage || "Muchas gracias por su visita",
          logo: invoice.logo || "",
          website: invoice.website || "www.cafeuniversal.com",
          promoMessage: invoice.promoMessage || "",
          taxRate: invoice.taxRate || 10,
          showTaxInfo: invoice.showTaxInfo !== false,
          paperSize: invoice.paperSize || "80mm",
          companyRuc: invoice.companyRuc || "C-91233456",
          companyEmail: invoice.companyEmail || "",
        });

        localStorage.setItem("pos_settings", JSON.stringify(config));
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
      const savedSettings = localStorage.getItem("pos_settings");
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          setFullConfig(settings);
          const perPage =
            settings.appearance?.itemsPerPage || DEFAULT_ITEMS_PER_PAGE;
          setItemsPerPage(perPage);
          const invoice = settings.invoice || {};
          setStoreInfo({
            companyName: invoice.companyName || "CAFÉ UNIVERSAL",
            companyAddress: invoice.companyAddress || "Avda. Central, 4",
            companyPhone: invoice.companyPhone || "📞 555-123-456",
            footerMessage:
              invoice.footerMessage || "Muchas gracias por su visita",
            logo: invoice.logo || "",
            website: invoice.website || "www.cafeuniversal.com",
            promoMessage: invoice.promoMessage || "",
            taxRate: invoice.taxRate || 10,
            showTaxInfo: invoice.showTaxInfo !== false,
            paperSize: invoice.paperSize || "80mm",
            companyRuc: invoice.companyRuc || "C-91233456",
            companyEmail: invoice.companyEmail || "",
          });
        } catch (e) {
          setItemsPerPage(DEFAULT_ITEMS_PER_PAGE);
        }
      }
    }
  };

  // ✅ Escuchar cambios en la configuración
  useEffect(() => {
    loadConfiguracion();
    const handleStorageChange = (e) => {
      if (e.key === "pos_settings") {
        try {
          const settings = JSON.parse(e.newValue);
          setFullConfig(settings);
          const perPage =
            settings.appearance?.itemsPerPage || DEFAULT_ITEMS_PER_PAGE;
          setItemsPerPage(perPage);
          const invoice = settings.invoice || {};
          setStoreInfo({
            companyName: invoice.companyName || "CAFÉ UNIVERSAL",
            companyAddress: invoice.companyAddress || "Avda. Central, 4",
            companyPhone: invoice.companyPhone || "📞 555-123-456",
            footerMessage:
              invoice.footerMessage || "Muchas gracias por su visita",
            logo: invoice.logo || "",
            website: invoice.website || "www.cafeuniversal.com",
            promoMessage: invoice.promoMessage || "",
            taxRate: invoice.taxRate || 10,
            showTaxInfo: invoice.showTaxInfo !== false,
            paperSize: invoice.paperSize || "80mm",
            companyRuc: invoice.companyRuc || "C-91233456",
            companyEmail: invoice.companyEmail || "",
          });
        } catch (err) {
          console.error("Error al cambiar configuración:", err);
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    const handleConfigUpdate = (e) => {
      if (e.detail) {
        setFullConfig(e.detail);
        const perPage =
          e.detail.appearance?.itemsPerPage || DEFAULT_ITEMS_PER_PAGE;
        setItemsPerPage(perPage);
        const invoice = e.detail.invoice || {};
        setStoreInfo({
          companyName: invoice.companyName || "CAFÉ UNIVERSAL",
          companyAddress: invoice.companyAddress || "Avda. Central, 4",
          companyPhone: invoice.companyPhone || "📞 555-123-456",
          footerMessage:
            invoice.footerMessage || "Muchas gracias por su visita",
          logo: invoice.logo || "",
          website: invoice.website || "www.cafeuniversal.com",
          promoMessage: invoice.promoMessage || "",
          taxRate: invoice.taxRate || 10,
          showTaxInfo: invoice.showTaxInfo !== false,
          paperSize: invoice.paperSize || "80mm",
          companyRuc: invoice.companyRuc || "C-91233456",
          companyEmail: invoice.companyEmail || "",
        });
      }
    };
    window.addEventListener("configUpdated", handleConfigUpdate);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("configUpdated", handleConfigUpdate);
    };
  }, []);

  const handlePrint = useReactToPrint({
    contentRef: ticketRef,
    onAfterPrint: () => {
      setShowTicket(false);
      setLastSale(null);
    },
    onPrintError: (err) => {
      console.error("❌ Error imprimiendo:", err);
      Swal.fire("Error", "No se pudo imprimir el ticket", "error");
    },
  });

  const handleManualQtyChange = (productId, newQty) => {
    const qty = parseInt(newQty);
    if (isNaN(qty) || qty < 0) return;
    updateQty(productId, qty === 0 ? 0 : qty);
    setEditingQty(null);
  };

  const handleQtyInputKeyPress = (e, productId) => {
    if (e.key === "Enter") handleManualQtyChange(productId, e.target.value);
  };

  const performSearch = (searchValue = null) => {
    let value =
      searchValue !== null ? searchValue : searchInputRef.current?.value || "";
    if (searchInputRef.current) searchInputRef.current.value = value;
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === "Enter") performSearch();
  };

  const clearSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
      setSearchTerm("");
      setCurrentPage(1);
      searchInputRef.current.focus();
    }
  };

  const startScanner = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        Swal.fire({
          title: "Escáner de código de barras",
          html: `<div style="text-align:center"><video id="scanner-video" style="width:100%;max-width:400px;height:auto;border-radius:12px;margin-bottom:10px"></video><canvas id="scanner-canvas" style="display:none"></canvas><p style="color:#666">Apunta la cámara al código de barras</p></div>`,
          showConfirmButton: true,
          confirmButtonText: "Cancelar",
          confirmButtonColor: "#ef4444",
          allowOutsideClick: false,
          didOpen: () => {
            const video = document.getElementById("scanner-video");
            const canvas = document.getElementById("scanner-canvas");
            if (video && canvas) {
              navigator.mediaDevices
                .getUserMedia({ video: { facingMode: "environment" } })
                .then((stream) => {
                  video.srcObject = stream;
                  video.play();
                  const interval = setInterval(() => {
                    if (video.readyState === video.HAVE_ENOUGH_DATA) {
                      canvas.width = video.videoWidth;
                      canvas.height = video.videoHeight;
                      canvas
                        .getContext("2d")
                        .drawImage(video, 0, 0, canvas.width, canvas.height);
                      if (window.scannerTimeout)
                        clearTimeout(window.scannerTimeout);
                      window.scannerTimeout = setTimeout(() => {
                        const mockCode = prompt(
                          "Demo: Ingresa el código escaneado manualmente:",
                          "1234567890",
                        );
                        if (mockCode) {
                          stream.getTracks().forEach((track) => track.stop());
                          clearInterval(interval);
                          Swal.close();
                          setScanning(false);
                          performSearch(mockCode);
                          Swal.fire(
                            "Éxito",
                            `Código escaneado: ${mockCode}`,
                            "success",
                          );
                        }
                      }, 2000);
                    }
                  }, 500);
                })
                .catch((err) => {
                  console.error("Error al acceder a la cámara:", err);
                  Swal.fire("Error", "No se pudo acceder a la cámara", "error");
                  setScanning(false);
                });
            }
          },
          willClose: () => {
            if (videoRef.current?.srcObject) {
              videoRef.current.srcObject
                .getTracks()
                .forEach((track) => track.stop());
            }
            if (window.scannerTimeout) clearTimeout(window.scannerTimeout);
            setScanning(false);
          },
        });
      }
    } catch (err) {
      console.error("Error al iniciar escáner:", err);
      Swal.fire(
        "Error",
        "No se pudo acceder a la cámara. Verifica los permisos.",
        "error",
      );
    }
  };

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const productsRes = await api.get("/products");
      const productList = productsRes.data?.data || productsRes.data || [];
      try {
        const categoriesRes = await api.get("/categories");
        setCategories(categoriesRes.data?.data || categoriesRes.data || []);
      } catch (catErr) {
        console.warn(
          "⚠️ No se pudieron cargar las categorías:",
          catErr.message,
        );
        setCategories([]);
      }
      setProducts(productList);
    } catch (err) {
      console.error("❌ Error cargando productos:", err);
      setError(
        err.response?.data?.message || "No se pudieron cargar los productos",
      );
      if (err.response?.status !== 401) {
        Swal.fire("Error", "No se pudieron cargar los productos", "error");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadProducts();
  }, [loadProducts, user]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let filtered = products.filter(
      (p) =>
        p?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
        p?.sku?.toLowerCase()?.includes(searchTerm?.toLowerCase()),
    );
    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (p) =>
          p.category_id === selectedCategory ||
          p.categoryId === selectedCategory ||
          p.category === selectedCategory,
      );
    }
    return filtered;
  }, [products, searchTerm, selectedCategory]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, itemsPerPage]);

  const handleAddToCart = useCallback(
    (product) => {
      if (!product?.id || product.stock <= 0) {
        if (product?.name)
          Swal.fire(
            "Sin stock",
            `"${product.name}" no está disponible`,
            "warning",
          );
        return;
      }
      addToCart({
        id: String(product.id),
        name: product.name,
        price: parseFloat(product.sale_price) || 0,
        stock: product.stock,
        image_url: product.image_url,
      });
    },
    [addToCart],
  );

  const handleCheckout = async () => {
    if (!items || items.length === 0) {
      return Swal.fire({
        title: "Carrito vacío",
        text: "Agrega productos antes de cobrar",
        icon: "warning",
        confirmButtonText: "Aceptar",
        confirmButtonColor: "#3b82f6",
      });
    }
    for (const item of items) {
      const product = products.find((p) => p.id === item.id);
      if (product && product.stock < (parseInt(item.qty) || 1)) {
        return Swal.fire(
          "Stock insuficiente",
          `"${product.name}" solo tiene ${product.stock} disponibles`,
          "warning",
        );
      }
    }
    const result = await Swal.fire({
      title: "¿Confirmar venta?",
      html: `<div style="text-align:left"><p><strong>Total:</strong> $${Number(total()).toFixed(2)}</p><p><strong>Método:</strong> ${payment === "cash" ? "Efectivo" : payment === "card" ? "Tarjeta" : "Transferencia"}</p><p><strong>Items:</strong> ${items.length}</p></div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, cobrar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    setProcessing(true);
    try {
      const saleData = {
        items: items.map((i) => ({
          productId: String(i.id),
          quantity: parseInt(i.qty) || 1,
        })),
        paymentMethod: payment,
      };
      const res = await api.post("/sales", saleData);
      if (res.data?.success) {
        const backendData = res.data.data || {};
        const sale = {
          saleId: backendData.saleId || `VENTA-${Date.now()}`,
          total: backendData.total || Number(total()) || 0,
          createdAt: backendData.createdAt || new Date().toISOString(),
          paymentMethod: payment,
        };
        const ticketItems = items.map((item) => ({
          name: item.name,
          quantity: parseInt(item.qty) || 1,
          unit_price: parseFloat(item.price) || 0,
        }));
        setLastSale({ ...sale, items: ticketItems });
        setShowTicket(true);
        setTimeout(() => handlePrint(), 300);
        clear();
        await loadProducts();
      }
    } catch (err) {
      console.error("❌ Error en venta:", err);
      Swal.fire({
        title: "❌ Error en la venta",
        text:
          err.response?.data?.message ||
          err.message ||
          "Error al procesar la venta",
        icon: "error",
        confirmButtonText: "Aceptar",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setProcessing(false);
    }
  };

  const Pagination = () => {
    if (totalPages <= 1) return null;
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    if (endPage - startPage + 1 < maxVisiblePages)
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
        <span className="text-sm text-gray-500">
          Mostrando {(currentPage - 1) * itemsPerPage + 1} -{" "}
          {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de{" "}
          {filteredProducts.length} productos
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            <ChevronLeft size={18} />
          </button>
          {startPage > 1 && (
            <>
              <button
                onClick={() => setCurrentPage(1)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100"
              >
                1
              </button>
              {startPage > 2 && <span className="px-1 text-gray-400">...</span>}
            </>
          )}
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-8 h-8 rounded-lg text-sm font-medium ${currentPage === page ? "bg-blue-500 text-white" : "hover:bg-gray-100"}`}
            >
              {page}
            </button>
          ))}
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && (
                <span className="px-1 text-gray-400">...</span>
              )}
              <button
                onClick={() => setCurrentPage(totalPages)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100"
              >
                {totalPages}
              </button>
            </>
          )}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  };

  const ProductCard = ({ product }) => {
    const isOutOfStock = product.stock <= 0;
    const isLowStock = product.stock <= 5 && product.stock > 0;
    return (
      <button
        onClick={() => handleAddToCart(product)}
        disabled={isOutOfStock || processing}
        className="group relative bg-white rounded-xl border-2 transition-all duration-200 overflow-hidden p-3 border-gray-200 hover:border-blue-400 hover:shadow-lg hover:-translate-y-1 disabled:opacity-50"
      >
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          {isLowStock && (
            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
              ¡Últimas {product.stock}!
            </span>
          )}
          {isOutOfStock && (
            <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
              Agotado
            </span>
          )}
        </div>
        <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center overflow-hidden h-32 mb-3">
          {product.image_url ? (
            <img
              src={getProductImageUrl(product.image_url)}
              alt={product.name}
              className="h-full w-full object-cover group-hover:scale-110 transition-transform"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            <Package className="text-gray-400" size={40} />
          )}
        </div>
        <div className="flex-1">
          <h3
            className="font-semibold text-gray-800 text-sm"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
            title={product.name}
          >
            {product.name}
          </h3>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xl font-bold text-blue-600">
              ${parseFloat(product.sale_price || 0).toFixed(2)}
            </p>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${isOutOfStock ? "bg-red-100 text-red-700" : isLowStock ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}
            >
              Stock: {product.stock}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            SKU: {product.sku || "N/A"}
          </p>
        </div>
      </button>
    );
  };

  // ✅ FilterBar con iconos en las categorías
  const FilterBar = () => (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100"
        >
          <Filter size={18} />
          <span className="text-sm font-medium">Filtros</span>
          {selectedCategory !== "all" && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
              1 activo
            </span>
          )}
        </button>
        <div className="flex-1 relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Escribe y presiona Enter..."
            onKeyPress={handleSearchKeyPress}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={processing}
            autoComplete="off"
            defaultValue=""
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => performSearch()}
          disabled={processing}
          className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          <Search size={18} />
        </button>
        <button
          onClick={startScanner}
          disabled={processing || scanning}
          className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          <Camera size={18} />
        </button>
      </div>
      {showFilters && (
        <div className="pt-3 border-t border-gray-200">
          <label className="text-xs font-medium text-gray-500 mb-2 block">
            Categorías
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${selectedCategory === "all" ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"}`}
            >
              Todas
            </button>
            {categories.map((cat) => {
              const IconComponent = ICON_OPTIONS[cat.icon] || Tag;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  <IconComponent size={14} />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
          {(searchTerm || selectedCategory !== "all") && (
            <button
              onClick={() => {
                if (searchInputRef.current) searchInputRef.current.value = "";
                setSearchTerm("");
                setSelectedCategory("all");
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (error && !loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <AlertCircle className="text-red-500 mb-4" size={64} />
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Error al cargar productos
        </h3>
        <p className="text-gray-600 mb-6 max-w-md">{error}</p>
        <button
          onClick={loadProducts}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium"
        >
          Reintentar
        </button>
      </div>
    );

  // ✅ Carga principal: usamos LoaderPOS en lugar del spinner manual
  if (loading)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoaderPOS message="Cargando productos..." />
      </div>
    );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <FilterBar />
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <Package className="text-gray-400 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  No se encontraron productos
                </h3>
                <p className="text-gray-500 text-center max-w-md">
                  {searchTerm || selectedCategory !== "all"
                    ? "Intenta ajustar los filtros de búsqueda"
                    : "No hay productos disponibles en el catálogo"}
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                <Pagination />
              </>
            )}
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 sticky top-4 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <ShoppingCart size={20} />
                  Carrito de compras
                </h2>
                <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                  <span className="font-medium">
                    {items?.reduce(
                      (acc, i) => acc + (parseInt(i?.qty) || 0),
                      0,
                    ) || 0}{" "}
                    items
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              {!items || items.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart
                    className="text-gray-400 mx-auto mb-3"
                    size={32}
                  />
                  <p className="text-gray-500 font-medium">
                    El carrito está vacío
                  </p>
                </div>
              ) : (
                items.map((item, index) => {
                  const originalProduct = products.find(
                    (p) => String(p.id) === String(item.id),
                  );
                  const productImage =
                    originalProduct?.image_url || item?.image_url;
                  return (
                    <div
                      key={`${item?.id}-${index}`}
                      className="group flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {productImage ? (
                          <img
                            src={getProductImageUrl(productImage)}
                            alt={item?.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package size={24} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-semibold text-gray-800 text-sm truncate"
                          title={item?.name}
                        >
                          {item?.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-gray-600">
                            ${parseFloat(item?.price || 0).toFixed(2)}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-sm font-semibold text-blue-600">
                            Total: $
                            {(
                              parseFloat(item?.price || 0) *
                              parseInt(item?.qty || 1)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-white rounded-lg shadow-sm p-1">
                        <button
                          onClick={() =>
                            updateQty(item?.id, (parseInt(item?.qty) || 1) - 1)
                          }
                          className="p-1.5 hover:bg-gray-100 rounded"
                          disabled={processing}
                        >
                          <Minus size={14} />
                        </button>
                        {editingQty === item?.id ? (
                          <input
                            type="number"
                            defaultValue={item?.qty}
                            min="0"
                            step="1"
                            className="w-12 text-center text-sm font-semibold border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onBlur={(e) =>
                              handleManualQtyChange(item?.id, e.target.value)
                            }
                            onKeyPress={(e) =>
                              handleQtyInputKeyPress(e, item?.id)
                            }
                            autoFocus
                            disabled={processing}
                          />
                        ) : (
                          <span
                            className="w-10 text-center text-sm font-semibold cursor-pointer hover:bg-gray-50 rounded py-1"
                            onClick={() => setEditingQty(item?.id)}
                            title="Haz clic para editar cantidad"
                          >
                            {item?.qty}
                          </span>
                        )}
                        <button
                          onClick={() =>
                            updateQty(item?.id, (parseInt(item?.qty) || 1) + 1)
                          }
                          className="p-1.5 hover:bg-gray-100 rounded"
                          disabled={processing}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => updateQty(item?.id, 0)}
                          className="p-1.5 hover:bg-red-100 rounded text-red-500"
                          disabled={processing}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">
                  Método de pago
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "cash", icon: Banknote, label: "Efectivo" },
                    { id: "card", icon: CreditCard, label: "Tarjeta" },
                    { id: "transfer", icon: Receipt, label: "Transfer" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPayment(m.id)}
                      disabled={processing}
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${payment === m.id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 bg-white"}`}
                    >
                      <m.icon size={20} />
                      <span className="text-xs font-medium">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className="text-sm font-medium">
                    ${Number(total?.() || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t-2 border-dashed border-gray-300">
                  <span className="font-bold text-gray-800">Total a pagar</span>
                  <span className="text-3xl font-bold text-blue-600">
                    ${Number(total?.() || 0).toFixed(2)}
                  </span>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                disabled={!items || items.length === 0 || processing}
                className="w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:opacity-50 shadow-lg"
              >
                {processing ? (
                  <>
                    {/* ✅ Eliminado el spinner circular, solo texto */}
                    Procesando venta...
                  </>
                ) : (
                  <>
                    <Printer size={20} />
                    Cobrar ${Number(total?.() || 0).toFixed(2)}
                  </>
                )}
              </button>
              {items && items.length > 0 && (
                <button
                  onClick={() =>
                    Swal.fire({
                      title: "¿Limpiar carrito?",
                      text: "Se eliminarán todos los productos",
                      icon: "warning",
                      showCancelButton: true,
                      confirmButtonText: "Sí, limpiar",
                    }).then((r) => {
                      if (r.isConfirmed) clear();
                    })
                  }
                  disabled={processing}
                  className="w-full py-2 text-sm text-gray-500 hover:text-red-600"
                >
                  Limpiar carrito
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <video ref={videoRef} style={{ display: "none" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div
        style={{
          display: showTicket && lastSale ? "block" : "none",
          position: "absolute",
          left: "-9999px",
        }}
      >
        {lastSale && (
          <TicketToPrint
            ref={ticketRef}
            saleData={lastSale}
            items={lastSale.items}
            storeInfo={{
              cashier: user?.name || "Admin",
            }}
            config={fullConfig}
          />
        )}
      </div>
    </div>
  );
}

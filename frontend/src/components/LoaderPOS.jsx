// frontend/src/components/LoaderPOS.jsx
import { ShoppingBag, Package, Coffee, Truck } from "lucide-react";

export default function LoaderPOS({ message = "Cargando tienda..." }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Contenedor de la animación */}
      <div className="relative w-80 h-40 flex items-end justify-around">
        {/* Estante izquierdo */}
        <div className="absolute left-0 bottom-0 flex flex-col items-center">
          <Package
            className="text-amber-600 dark:text-amber-400 animate-bounce"
            size={36}
            style={{ animationDuration: "1.2s" }}
          />
          <div className="w-20 h-2 bg-amber-800/30 dark:bg-amber-700/50 rounded-full mt-1" />
        </div>

        {/* Centro - Carrito / Café */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex flex-col items-center">
          <ShoppingBag
            className="text-green-600 dark:text-green-400 animate-bounce mt-1"
            size={32}
            style={{ animationDuration: "0.9s" }}
          />
          <div className="w-24 h-3 bg-gray-400/30 dark:bg-gray-600/50 rounded-full mt-1" />
        </div>

        {/* Estante derecho */}
        <div className="absolute right-0 bottom-0 flex flex-col items-center">
          <Truck
            className="text-purple-600 dark:text-purple-400 animate-pulse"
            size={38}
            style={{ animationDuration: "1.5s" }}
          />
          <div className="w-20 h-2 bg-purple-800/30 dark:bg-purple-700/50 rounded-full mt-1" />
        </div>
      </div>

      {/* Texto de carga */}
      <div className="mt-8 flex flex-col items-center">
        <div className="flex gap-1">
          <span className="text-2xl font-bold text-gray-700 dark:text-gray-200">
            {message}
          </span>
          <span className="flex gap-1">
            <span
              className="animate-pulse text-2xl font-bold text-blue-600 dark:text-blue-400"
              style={{ animationDelay: "0ms" }}
            >
              .
            </span>
            <span
              className="animate-pulse text-2xl font-bold text-blue-600 dark:text-blue-400"
              style={{ animationDelay: "300ms" }}
            >
              .
            </span>
            <span
              className="animate-pulse text-2xl font-bold text-blue-600 dark:text-blue-400"
              style={{ animationDelay: "600ms" }}
            >
              .
            </span>
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Preparando tu experiencia POS
        </p>
      </div>
    </div>
  );
}

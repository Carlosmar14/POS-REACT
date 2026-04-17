// frontend/src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../store/authStore";
import {
  Store,
  Mail,
  Lock,
  ArrowRight,
  Shield,
  Key,
  RefreshCw,
  X,
} from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Estados para 2FA
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [tempToken, setTempToken] = useState(null);

  const navigate = useNavigate();
  const login = useAuth((s) => s.login);

  // ✅ Función principal de login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const payload = { email, password };

      // Si estamos en flujo 2FA, incluir el código
      if (requires2FA && twoFactorToken) {
        payload.twoFactorToken = twoFactorToken;
      }

      const res = await api.post("/auth/login", payload);

      // ✅ Caso: Backend solicita verificación 2FA
      if (res.data.requires2FA) {
        setRequires2FA(true);
        setPendingEmail(res.data.data.email);
        setTempToken(res.data.data.tempToken);
        setTwoFactorToken("");
        setLoading(false);
        return;
      }

      // ✅ Caso: Login exitoso completo
      if (res.data.success) {
        // Guardar token y usuario en localStorage
        localStorage.setItem("pos_token", res.data.data.accessToken);
        localStorage.setItem("pos_user", JSON.stringify(res.data.data.user));

        // Actualizar estado global
        login({
          user: res.data.data.user,
          accessToken: res.data.data.accessToken,
        });

        // Redirigir según rol
        const userRole = res.data.data.user.role;
        if (userRole === "admin") {
          navigate("/reportes");
        } else if (userRole === "warehouse") {
          navigate("/stock");
        } else {
          navigate("/caja");
        }
      }
    } catch (e) {
      console.error("❌ Error en login:", e);
      setErr(e.response?.data?.message || "Credenciales inválidas");
      setTwoFactorToken("");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Verificar código 2FA (segundo paso)
  const verify2FA = async () => {
    if (!twoFactorToken || twoFactorToken.length !== 6) {
      return setErr("Ingresa un código de 6 dígitos válido");
    }

    setLoading(true);
    setErr("");

    try {
      // Enviar credenciales completas + código 2FA
      const res = await api.post("/auth/login", {
        email: pendingEmail || email,
        password,
        twoFactorToken,
      });

      if (res.data.success) {
        localStorage.setItem("pos_token", res.data.data.accessToken);
        localStorage.setItem("pos_user", JSON.stringify(res.data.data.user));

        login({
          user: res.data.data.user,
          accessToken: res.data.data.accessToken,
        });

        const userRole = res.data.data.user.role;
        if (userRole === "admin") {
          navigate("/reportes");
        } else if (userRole === "warehouse") {
          navigate("/stock");
        } else {
          navigate("/caja");
        }
      }
    } catch (e) {
      console.error("❌ Error verificando 2FA:", e);
      setErr(e.response?.data?.message || "Código de autenticación inválido");
      setTwoFactorToken("");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Cancelar flujo 2FA y volver al login
  const cancel2FA = () => {
    setRequires2FA(false);
    setTwoFactorToken("");
    setPendingEmail("");
    setTempToken(null);
    setPassword(""); // Limpiar password por seguridad
    setErr("");
  };

  // ✅ Manejar input de código 2FA (solo números, máximo 6 dígitos)
  const handle2FAInput = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setTwoFactorToken(value);
  };

  // ✅ Manejar tecla Enter en input 2FA
  const handle2FAKeyPress = (e) => {
    if (e.key === "Enter" && twoFactorToken.length === 6 && !loading) {
      verify2FA();
    }
  };

  // ✅ Modal para código 2FA
  const TwoFAModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
              <Shield className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white">
              Verificación de Seguridad
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              Autenticación de dos factores
            </p>
          </div>

          {/* Body */}
          <div className="p-8 space-y-5">
            <div className="text-center">
              <p className="text-gray-700 mb-2">
                Ingresa el código de 6 dígitos de tu app autenticadora para:
              </p>
              <p className="font-semibold text-gray-900">
                {pendingEmail || email}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código de verificación
              </label>
              <div className="relative">
                <Key
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorToken}
                  onChange={handle2FAInput}
                  onKeyPress={handle2FAKeyPress}
                  disabled={loading}
                  autoFocus
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Código de Google Authenticator, Authy o similar
              </p>
            </div>

            {err && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {err}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancel2FA}
                disabled={loading}
                className="flex-1 py-3 px-4 border-2 border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={verify2FA}
                disabled={loading || twoFactorToken.length !== 6}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>Verificar</span>
                    <ArrowRight
                      size={18}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </>
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <p className="text-xs text-gray-500">
                ¿Perdiste acceso a tu app?{" "}
                <button
                  type="button"
                  onClick={() =>
                    setErr("Contacta al administrador para recuperar el acceso")
                  }
                  className="text-blue-600 hover:underline font-medium"
                >
                  Usar código de respaldo
                </button>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              POS System Professional v2.0
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              © 2026 Todos los derechos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ✅ Renderizar modal 2FA si está activo
  if (requires2FA) {
    return <TwoFAModal />;
  }

  // ✅ Renderizar login normal
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
              <Store className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white">POS System</h1>
            <p className="text-blue-100 text-sm mt-1">
              Gestión Profesional de Tiendas
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="email"
                  placeholder="admin@pos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {err && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight
                    size={18}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500">
              POS System Professional v2.0
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              © 2026 Todos los derechos reservados
            </p>
          </div>
        </div>

        {/* Demo credentials */}
        <p className="text-center text-sm text-gray-500 mt-4">
          Demo:{" "}
          <code className="bg-gray-100 px-2 py-0.5 rounded">admin@pos.com</code>{" "}
          / <code className="bg-gray-100 px-2 py-0.5 rounded">123456</code>
        </p>
      </div>
    </div>
  );
}

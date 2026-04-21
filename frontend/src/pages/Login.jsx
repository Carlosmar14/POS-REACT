// frontend/src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../store/authStore";
import { Store, Mail, Lock, ArrowRight, Shield, Key } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [tempToken, setTempToken] = useState(null);

  const navigate = useNavigate();
  const login = useAuth((s) => s.login);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const payload = { email, password };
      if (requires2FA && twoFactorToken) {
        payload.twoFactorToken = twoFactorToken;
      }

      const res = await api.post("/auth/login", payload);

      if (res.data.requires2FA) {
        setRequires2FA(true);
        setPendingEmail(res.data.data.email);
        setTempToken(res.data.data.tempToken);
        setTwoFactorToken("");
        setLoading(false);
        return;
      }

      if (res.data.success) {
        localStorage.setItem("pos_token", res.data.data.accessToken);
        localStorage.setItem("pos_user", JSON.stringify(res.data.data.user));
        login({
          user: res.data.data.user,
          accessToken: res.data.data.accessToken,
        });

        const userRole = res.data.data.user.role;
        if (userRole === "admin") navigate("/reportes");
        else if (userRole === "warehouse") navigate("/stock");
        else navigate("/caja");
      }
    } catch (e) {
      console.error("❌ Error en login:", e);
      setErr(e.response?.data?.message || "Credenciales inválidas");
      setTwoFactorToken("");
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async () => {
    if (!twoFactorToken || twoFactorToken.length !== 6) {
      return setErr("Ingresa un código de 6 dígitos válido");
    }

    setLoading(true);
    setErr("");

    try {
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
        if (userRole === "admin") navigate("/reportes");
        else if (userRole === "warehouse") navigate("/stock");
        else navigate("/caja");
      }
    } catch (e) {
      console.error("❌ Error verificando 2FA:", e);
      setErr(e.response?.data?.message || "Código de autenticación inválido");
      setTwoFactorToken("");
    } finally {
      setLoading(false);
    }
  };

  const cancel2FA = () => {
    setRequires2FA(false);
    setTwoFactorToken("");
    setPendingEmail("");
    setTempToken(null);
    setPassword("");
    setErr("");
  };

  const handle2FAInput = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setTwoFactorToken(value);
  };

  const handle2FAKeyPress = (e) => {
    if (e.key === "Enter" && twoFactorToken.length === 6 && !loading) {
      verify2FA();
    }
  };

  const TwoFAModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 transition-colors">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300">
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

          <div className="p-8 space-y-5">
            <div className="text-center">
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Ingresa el código de 6 dígitos de tu app autenticadora para:
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {pendingEmail || email}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Código de verificación
              </label>
              <div className="relative">
                <Key
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                  size={20}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorToken}
                  onChange={handle2FAInput}
                  onKeyPress={handle2FAKeyPress}
                  disabled={loading}
                  autoFocus
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             text-center text-2xl tracking-widest font-mono 
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Código de Google Authenticator, Authy o similar
              </p>
            </div>

            {err && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
                {err}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancel2FA}
                disabled={loading}
                className="flex-1 py-3 px-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl 
                           text-gray-700 dark:text-gray-300 font-medium 
                           hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={verify2FA}
                disabled={loading || twoFactorToken.length !== 6}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 
                           hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium 
                           transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  // ✅ Eliminado el spinner, solo texto
                  <span>Verificando...</span>
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
          </div>

          <div className="px-8 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              POS System Professional v2.0
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              © 2026 Todos los derechos reservados
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (requires2FA) {
    return <TwoFAModal />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden transition-colors duration-300">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
              <Store className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white">POS System</h1>
            <p className="text-blue-100 text-sm mt-1">
              Gestión Profesional de Tiendas
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                  size={20}
                />
                <input
                  type="email"
                  placeholder="admin@pos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                  size={20}
                />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl 
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>
            </div>

            {err && (
              <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm animate-fadeIn">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 
                         hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium 
                         transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                // ✅ Eliminado el spinner, solo texto
                <span>Ingresando...</span>
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

          <div className="px-8 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              POS System Professional v2.0
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              © 2026 Todos los derechos reservados
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
          Demo:{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
            admin@pos.com
          </code>{" "}
          /{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
            123456
          </code>
        </p>
      </div>
    </div>
  );
}

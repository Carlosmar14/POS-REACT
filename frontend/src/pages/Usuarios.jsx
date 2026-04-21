// frontend/src/pages/Usuarios.jsx
import { useState, useEffect } from "react";
import api from "../api";
import Swal from "sweetalert2";
import LoaderPOS from "../components/LoaderPOS";
import {
  Plus,
  UserCheck,
  UserX,
  X,
  Shield,
  Search,
  Edit,
  Key,
  Trash2,
  Lock,
  Unlock,
  Clock,
  AlertTriangle,
} from "lucide-react";

export default function Usuarios() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "cashier",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "cashier",
  });
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/users");
      console.log("📦 Usuarios cargados:", res.data.data);
      setUsers(res.data.data || []);
    } catch (err) {
      console.error("❌ Error cargando usuarios:", err);
      Swal.fire("Error", "No se pudieron cargar los usuarios", "error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ CREAR
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.role) {
      return Swal.fire("Error", "Completa todos los campos", "warning");
    }
    if (form.password.length < 6) {
      return Swal.fire(
        "Error",
        "La contraseña debe tener al menos 6 caracteres",
        "warning",
      );
    }
    try {
      await api.post("/users", form);
      setModal(false);
      setForm({ name: "", email: "", password: "", role: "cashier" });
      await loadData();
      Swal.fire({
        title: "¡Usuario creado!",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Error al crear usuario",
        "error",
      );
    }
  };

  // ✅ EDITAR - Abrir
  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role });
    setEditModal(true);
  };

  // ✅ EDITAR - Guardar
  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.email || !editForm.role) {
      return Swal.fire("Error", "Completa todos los campos", "warning");
    }
    try {
      await api.put(`/users/${editingUser.id}`, editForm);
      setEditModal(false);
      await loadData();
      Swal.fire({
        title: "¡Actualizado!",
        text: "Datos actualizados correctamente.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Error al actualizar",
        "error",
      );
    }
  };

  // ✅ CONTRASEÑA - Abrir
  const openPasswordModal = (user) => {
    setEditingUser(user);
    setPasswordForm({ password: "", confirmPassword: "" });
    setPasswordModal(true);
  };

  // ✅ CONTRASEÑA - Guardar
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.password !== passwordForm.confirmPassword) {
      return Swal.fire("Error", "Las contraseñas no coinciden", "error");
    }
    if (passwordForm.password.length < 6) {
      return Swal.fire("Error", "Mínimo 6 caracteres", "warning");
    }
    try {
      await api.put(`/users/${editingUser.id}/password`, {
        password: passwordForm.password,
      });
      setPasswordModal(false);
      Swal.fire({
        title: "¡Contraseña actualizada!",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Error al cambiar contraseña",
        "error",
      );
    }
  };

  // ✅ ESTADO - Activar/Desactivar
  const toggleStatus = async (id, current, name) => {
    const action = current ? "desactivar" : "activar";
    const result = await Swal.fire({
      title: `¿${action === "desactivar" ? "Desactivar" : "Activar"} usuario?`,
      text: `¿Estás seguro de que deseas ${action} a "${name}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: current ? "#dc3545" : "#28a745",
      confirmButtonText: current ? "Sí, desactivar" : "Sí, activar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;

    try {
      await api.put(`/users/${id}/status`, { is_active: !current });
      await loadData();
      Swal.fire({
        title: `¡${current ? "Desactivado" : "Activado"}!`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || `Error al ${action} usuario`,
        "error",
      );
    }
  };

  // ✅ DESBLOQUEAR USUARIO
  const handleUnlock = async (user) => {
    const result = await Swal.fire({
      title: "¿Desbloquear usuario?",
      text: `¿Estás seguro de que deseas desbloquear a "${user.name}"? Podrá iniciar sesión nuevamente.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#28a745",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, desbloquear",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      await api.post(`/users/${user.id}/unlock`);
      await loadData();
      Swal.fire({
        title: "✅ Desbloqueado",
        text: `${user.name} ha sido desbloqueado y puede iniciar sesión nuevamente.`,
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
    } catch (err) {
      console.error("❌ Error desbloqueando:", err);
      Swal.fire(
        "Error",
        err.response?.data?.message || "No se pudo desbloquear al usuario",
        "error",
      );
    }
  };

  // ✅ ELIMINAR
  const handleDelete = async (user) => {
    const result = await Swal.fire({
      title: "¿Eliminar usuario?",
      text: `Esta acción eliminará permanentemente a "${user.name}". ¿Continuar?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/users/${user.id}`);
      await loadData();
      Swal.fire({
        title: "¡Eliminado!",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      if (err.response?.status === 409) {
        Swal.fire({
          title: "No se puede eliminar",
          text: err.response?.data?.message || "Tiene registros asociados.",
          icon: "warning",
          confirmButtonText: "Entendido",
        });
      } else {
        Swal.fire(
          "Error",
          err.response?.data?.message || "Error al eliminar",
          "error",
        );
      }
    }
  };

  // ✅ Verificar si un usuario está bloqueado
  const isUserLocked = (user) => {
    if (!user.locked_until) return false;
    return new Date(user.locked_until) > new Date();
  };

  // ✅ Formatear tiempo restante de bloqueo
  const formatLockTime = (lockedUntil) => {
    if (!lockedUntil) return "";
    const diff = new Date(lockedUntil) - new Date();
    const minutes = Math.ceil(diff / 1000 / 60);
    if (minutes <= 0) return "";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  // ✅ Reemplazamos spinner manual por LoaderPOS
  if (loading) {
    return <LoaderPOS message="Cargando usuarios..." />;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestión de Usuarios
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Administra accesos, roles y estados
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <Plus size={18} /> Nuevo Usuario
        </button>
      </div>

      {/* Buscador */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-icon"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Seguridad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((u) => {
                  const locked = isUserLocked(u);
                  const lockTime = formatLockTime(u.locked_until);
                  const attempts = u.login_attempts || 0;

                  return (
                    <tr
                      key={u.id}
                      className={
                        locked ? "bg-red-50/30 dark:bg-red-900/10" : ""
                      }
                    >
                      <td className="font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center font-bold text-sm">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          {u.name}
                        </div>
                      </td>
                      <td className="text-gray-600 dark:text-gray-400">
                        {u.email}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            u.role === "admin"
                              ? "badge-info"
                              : u.role === "cashier"
                                ? "badge-warning"
                                : "badge-success"
                          }`}
                        >
                          <Shield size={12} className="mr-1" />
                          {u.role === "admin"
                            ? "Admin"
                            : u.role === "cashier"
                              ? "Cajero"
                              : "Almacén"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${u.is_active ? "badge-success" : "badge-danger"}`}
                        >
                          {u.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        {locked ? (
                          <div className="flex flex-col gap-1">
                            <span className="badge badge-danger flex items-center gap-1">
                              <Lock size={12} /> Bloqueado
                            </span>
                            {lockTime && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Clock size={12} /> {lockTime}
                              </span>
                            )}
                          </div>
                        ) : attempts > 0 ? (
                          <span className="badge badge-warning text-xs flex items-center gap-1">
                            <AlertTriangle size={12} /> Intentos: {attempts}
                          </span>
                        ) : (
                          <span className="badge badge-success flex items-center gap-1">
                            <Unlock size={12} /> Sin bloqueo
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {/* Botón Desbloquear - Solo visible si está bloqueado */}
                          {locked && (
                            <button
                              onClick={() => handleUnlock(u)}
                              className="btn-ghost p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"
                              title="Desbloquear usuario"
                            >
                              <Unlock size={16} />
                            </button>
                          )}

                          <button
                            onClick={() => openEditModal(u)}
                            className="btn-ghost p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>

                          <button
                            onClick={() => openPasswordModal(u)}
                            className="btn-ghost p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg"
                            title="Cambiar contraseña"
                          >
                            <Key size={16} />
                          </button>

                          <button
                            onClick={() =>
                              toggleStatus(u.id, u.is_active, u.name)
                            }
                            className={`btn-ghost p-1.5 ${
                              u.is_active
                                ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
                            } rounded-lg`}
                            title={u.is_active ? "Desactivar" : "Activar"}
                          >
                            {u.is_active ? (
                              <UserX size={16} />
                            ) : (
                              <UserCheck size={16} />
                            )}
                          </button>

                          <button
                            onClick={() => handleDelete(u)}
                            className="btn-ghost p-1.5 text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-12 text-gray-500 dark:text-gray-400"
                  >
                    No se encontraron usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========== MODAL CREAR ========== */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                ➕ Nuevo Usuario
              </h2>
              <button
                onClick={() => setModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="input-group">
                <label className="label">Nombre Completo *</label>
                <input
                  required
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: María González"
                />
              </div>
              <div className="input-group">
                <label className="label">Email *</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@tienda.com"
                />
              </div>
              <div className="input-group">
                <label className="label">Contraseña *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="input"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="••••••••"
                />
              </div>
              <div className="input-group">
                <label className="label">Rol *</label>
                <select
                  className="input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="cashier">🛒 Cajero</option>
                  <option value="warehouse">📦 Almacén</option>
                  <option value="admin">👑 Administrador</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Crear Usuario
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="btn-secondary px-6"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== MODAL EDITAR ========== */}
      {editModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setEditModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                ✏️ Editar Usuario
              </h2>
              <button
                onClick={() => setEditModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-4">
              <div className="input-group">
                <label className="label">Nombre Completo *</label>
                <input
                  required
                  className="input"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label className="label">Email *</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label className="label">Rol *</label>
                <select
                  className="input"
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value })
                  }
                >
                  <option value="cashier">🛒 Cajero</option>
                  <option value="warehouse">📦 Almacén</option>
                  <option value="admin">👑 Administrador</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Actualizar
                </button>
                <button
                  type="button"
                  onClick={() => setEditModal(false)}
                  className="btn-secondary px-6"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== MODAL CONTRASEÑA ========== */}
      {passwordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setPasswordModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                🔑 Cambiar Contraseña
              </h2>
              <button
                onClick={() => setPasswordModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-5 space-y-4">
              <div className="text-center mb-4">
                <p className="text-gray-600 dark:text-gray-300">
                  Usuario:{" "}
                  <span className="font-semibold">{editingUser?.name}</span>
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {editingUser?.email}
                </p>
              </div>
              <div className="input-group">
                <label className="label">Nueva Contraseña *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="input"
                  value={passwordForm.password}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      password: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                />
              </div>
              <div className="input-group">
                <label className="label">Confirmar Contraseña *</label>
                <input
                  type="password"
                  required
                  className="input"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Cambiar Contraseña
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordModal(false)}
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

import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  Users, 
  ShieldCheck, 
  UserCheck, 
  Key, 
  Trash2, 
  Edit3, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Lock
} from 'lucide-react';
import { AppUser, UserSession, UserRole } from '../types/project';
import { storageService } from '../services/storageService';
import { firestoreService } from '../services/firestoreService';
import { isPMO } from '../utils/helpers';

interface UserManagementModalProps {
  currentUser: UserSession;
  onClose: () => void;
  onUsersChanged: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  currentUser,
  onClose,
  onUsersChanged,
}) => {
  const [users, setUsers] = useState<AppUser[]>(() => storageService.getUsers());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // Password visibility states (Exclusive to PMO)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [showAllPasswords, setShowAllPasswords] = useState<boolean>(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(true);

  // New User Form State
  const [newName, setNewName] = useState<string>('');
  const [newUsername, setNewUsername] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newConfirmPassword, setNewConfirmPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Edit User State
  const [userToEdit, setUserToEdit] = useState<AppUser | null>(null);

  // Change Password State
  const [userForPasswordChange, setUserForPasswordChange] = useState<AppUser | null>(null);
  const [changePasswordVal, setChangePasswordVal] = useState<string>('');
  const [changePasswordConfirmVal, setChangePasswordConfirmVal] = useState<string>('');
  const [showChangePassword, setShowChangePassword] = useState<boolean>(false);

  // Feedback messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const refreshUsers = () => {
    const updated = storageService.getUsers();
    setUsers(updated);
    onUsersChanged();
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword !== newConfirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    if (newPassword.length < 3) {
      setErrorMsg('La contraseña debe tener al menos 3 caracteres.');
      return;
    }

    const res = storageService.addUser({
      name: newName,
      username: newUsername,
      email: newEmail,
      password: newPassword,
      role: newRole,
    });

    if (res.success && res.user) {
      firestoreService.saveUser(res.user).catch((e) => console.warn('Firestore save user error:', e));
      setSuccessMsg(`Usuario "${res.user.name}" creado con éxito.`);
      // Clear form
      setNewName('');
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewConfirmPassword('');
      refreshUsers();
      setTimeout(() => {
        setActiveTab('list');
        setSuccessMsg(null);
      }, 1200);
    } else {
      setErrorMsg(res.message || 'Error al crear usuario.');
    }
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = storageService.updateUser(userToEdit);
    if (res.success) {
      firestoreService.saveUser(userToEdit).catch((e) => console.warn('Firestore update user error:', e));
      setSuccessMsg(`Usuario "${userToEdit.name}" actualizado correctamente.`);
      setUserToEdit(null);
      refreshUsers();
      setTimeout(() => setSuccessMsg(null), 2500);
    } else {
      setErrorMsg(res.message || 'Error al actualizar usuario.');
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForPasswordChange) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    // Solo el PMO puede editar contraseñas
    if (!isPMO(currentUser)) {
      setErrorMsg('Acceso denegado: solo el rol PMO tiene autorización para modificar contraseñas.');
      return;
    }

    if (changePasswordVal !== changePasswordConfirmVal) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    if (changePasswordVal.length < 3) {
      setErrorMsg('La contraseña debe tener al menos 3 caracteres.');
      return;
    }

    const res = storageService.changePassword(userForPasswordChange.id, changePasswordVal);
    if (res.success) {
      const updatedUser = storageService.getUsers().find((u) => u.id === userForPasswordChange.id);
      if (updatedUser) {
        firestoreService.saveUser(updatedUser).catch((e) => console.warn('Firestore password change error:', e));
      }
      setSuccessMsg(`Contraseña de "${userForPasswordChange.name}" actualizada con éxito.`);
      setUserForPasswordChange(null);
      setChangePasswordVal('');
      setChangePasswordConfirmVal('');
      refreshUsers();
      setTimeout(() => setSuccessMsg(null), 2500);
    } else {
      setErrorMsg(res.message || 'Error al actualizar contraseña.');
    }
  };

  const handleDeleteUser = (user: AppUser) => {
    if (user.id === currentUser.id || user.username === currentUser.username) {
      alert('No podés eliminar tu propia cuenta en sesión activa.');
      return;
    }

    const confirmDel = window.confirm(
      `¿Estás seguro de que deseas eliminar al usuario "${user.name}" (@${user.username})?\nEsta acción no se puede deshacer.`
    );
    if (!confirmDel) return;

    const res = storageService.deleteUser(user.id);
    if (res.success) {
      firestoreService.deleteUser(user.id).catch((e) => console.warn('Firestore delete user error:', e));
      setSuccessMsg(`Usuario "${user.name}" eliminado.`);
      refreshUsers();
      setTimeout(() => setSuccessMsg(null), 2500);
    } else {
      setErrorMsg(res.message || 'Error al eliminar usuario.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                Gestión de Usuarios y Contraseñas
              </h2>
              <p className="text-xs text-slate-300">
                Administrá las credenciales de acceso, roles y contraseñas de los usuarios del sistema
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs & Notifications */}
        <div className="px-6 pt-3 pb-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('list');
                setUserToEdit(null);
                setUserForPasswordChange(null);
                setErrorMsg(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeTab === 'list' && !userToEdit && !userForPasswordChange
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Usuarios Registrados ({users.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('create');
                setUserToEdit(null);
                setUserForPasswordChange(null);
                setErrorMsg(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Nuevo Usuario con Contraseña</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[11px] border border-indigo-200">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              {users.filter((u) => u.role === 'admin' || u.role === 'pmo').length} PMO
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px] border border-blue-200">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              {users.filter((u) => u.role !== 'admin' && u.role !== 'pmo').length} Usuarios
            </span>
          </div>
        </div>

        {/* Global Alert Messages */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* 1. EDIT USER MODAL FORM */}
          {userToEdit && (
            <div className="p-5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-4">
              <div className="flex items-center justify-between border-b border-blue-200/60 pb-3">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  <span>Modificar Datos de Usuario: {userToEdit.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      value={userToEdit.name}
                      onChange={(e) => setUserToEdit({ ...userToEdit, name: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nombre de Usuario (@username) *</label>
                    <input
                      type="text"
                      required
                      value={userToEdit.username}
                      onChange={(e) =>
                        setUserToEdit({
                          ...userToEdit,
                          username: e.target.value.toLowerCase().replace(/\s+/g, ''),
                        })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    value={userToEdit.email}
                    onChange={(e) => setUserToEdit({ ...userToEdit, email: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rol en el Sistema *</label>
                  <select
                    value={isPMO(userToEdit) ? 'pmo' : 'user'}
                    onChange={(e) =>
                      setUserToEdit({ ...userToEdit, role: e.target.value as UserRole })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer font-medium"
                  >
                    <option value="pmo">PMO (Edición al 100%, Priorización, Reportería y Cancelación)</option>
                    <option value="user">Usuario (Completar asignaciones, cambio de estado, alta y edición de proyectos propios)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setUserToEdit(null)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 2. CHANGE PASSWORD DIALOG */}
          {userForPasswordChange && (
            <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/40 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span>Modificar Contraseña: {userForPasswordChange.name} (@{userForPasswordChange.username})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUserForPasswordChange(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              {/* Contraseña Actual - Visualización para el PMO */}
              <div className="p-3 bg-white rounded-lg border border-amber-200 flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Contraseña Actual del Usuario:
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900 select-all">
                    {showCurrentPassword ? (userForPasswordChange.password || 'sap2026') : '••••••••'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-amber-900 hover:bg-amber-50 border border-amber-300 font-semibold cursor-pointer bg-white"
                  title={showCurrentPassword ? 'Ocultar contraseña' : 'Ver contraseña actual'}
                >
                  {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5 text-amber-700" />}
                  <span>{showCurrentPassword ? 'Ocultar' : 'Ver Actual'}</span>
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Nueva Contraseña *</label>
                    <div className="relative">
                      <input
                        type={showChangePassword ? 'text' : 'password'}
                        required
                        minLength={3}
                        value={changePasswordVal}
                        onChange={(e) => setChangePasswordVal(e.target.value)}
                        placeholder="Mínimo 3 caracteres"
                        className="w-full pl-3 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowChangePassword(!showChangePassword)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showChangePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Confirmar Nueva Contraseña *</label>
                    <input
                      type={showChangePassword ? 'text' : 'password'}
                      required
                      value={changePasswordConfirmVal}
                      onChange={(e) => setChangePasswordConfirmVal(e.target.value)}
                      placeholder="Repetí la nueva contraseña"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] text-amber-800 font-medium">
                    * Solo el rol PMO tiene acceso para visualizar y editar contraseñas de acceso.
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setUserForPasswordChange(null)}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                    >
                      Actualizar Contraseña
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* 3. CREATE USER TAB */}
          {activeTab === 'create' && !userToEdit && !userForPasswordChange && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Dar de alta un nuevo usuario con credenciales
                </h3>
                <p className="text-xs text-slate-500">
                  El usuario podrá ingresar con su nombre de usuario o correo electrónico y la contraseña indicada.
                </p>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nombre Completo y Cargo *
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ej: Ing. Martín Gómez (Líder MM)"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Nombre de Usuario para Login (@username) *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="Ej: mgomez"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none text-xs"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      En minúsculas y sin espacios
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Correo Electrónico Corporativo *
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="m.gomez@empresa.com"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Rol y Nivel de Acceso *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                        !isPMO({ role: newRole } as UserSession)
                          ? 'bg-blue-50 border-blue-300 text-blue-900 ring-1 ring-blue-300'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="newRole"
                        checked={!isPMO({ role: newRole } as UserSession)}
                        onChange={() => setNewRole('user')}
                        className="mt-0.5 text-blue-600"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                          <strong className="block font-bold">Usuario</strong>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 block leading-normal">
                          Completa asignaciones, cambia estado (excepto Cancelado), agrega acciones, sube archivos y edita sus proyectos dados de alta.
                        </span>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isPMO({ role: newRole } as UserSession)
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-1 ring-indigo-300'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="newRole"
                        checked={isPMO({ role: newRole } as UserSession)}
                        onChange={() => setNewRole('pmo')}
                        className="mt-0.5 text-indigo-600"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                          <strong className="block font-bold">PMO (Acceso 100%)</strong>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 block leading-normal">
                          Edición del 100% de la información, reportería y priorización exclusivas, cancelar proyectos y eliminar registros.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Contraseña *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={3}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 3 caracteres"
                        className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Confirmar Contraseña *
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newConfirmPassword}
                      onChange={(e) => setNewConfirmPassword(e.target.value)}
                      placeholder="Repetí la contraseña"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveTab('list')}
                    className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Guardar y Habilitar Usuario</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 4. USER LIST TAB */}
          {activeTab === 'list' && !userToEdit && !userForPasswordChange && (
            <div className="space-y-4">
              {/* Search input */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre, usuario o correo..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <span className="text-xs text-slate-400">
                  Mostrando {filteredUsers.length} de {users.length} usuarios
                </span>
              </div>

              {/* Users Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3">Usuario y Cargo</th>
                      <th className="py-2.5 px-3">Usuario / Login</th>
                      <th className="py-2.5 px-3">Rol</th>
                      <th className="py-2.5 px-3">
                        <div className="flex items-center justify-between gap-2">
                          <span>Contraseña</span>
                          {isPMO(currentUser) && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextState = !showAllPasswords;
                                setShowAllPasswords(nextState);
                                const allMap: Record<string, boolean> = {};
                                users.forEach((u) => {
                                  allMap[u.id] = nextState;
                                });
                                setVisiblePasswords(allMap);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 normal-case font-semibold cursor-pointer"
                              title={showAllPasswords ? 'Ocultar todas las contraseñas' : 'Ver todas las contraseñas (PMO)'}
                            >
                              {showAllPasswords ? (
                                <>
                                  <EyeOff className="w-3 h-3" />
                                  <span>Ocultar</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3 h-3" />
                                  <span>Ver todas</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </th>
                      <th className="py-2.5 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => {
                      const isSelf = u.id === currentUser.id || u.username === currentUser.username;
                      const isPasswordRevealed = showAllPasswords || !!visiblePasswords[u.id];

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                {u.name.substring(0, 2)}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block leading-tight">
                                  {u.name}
                                </span>
                                <span className="text-[11px] text-slate-500 block">{u.email}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                              @{u.username}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isPMO(u)
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {isPMO(u) ? (
                                <>
                                  <ShieldCheck className="w-3 h-3 text-indigo-600" />
                                  PMO
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3 h-3 text-blue-600" />
                                  Usuario
                                </>
                              )}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 font-mono text-slate-700 text-xs">
                              <span
                                className={`px-2 py-0.5 rounded border text-[11px] font-mono select-all transition-colors ${
                                  isPasswordRevealed
                                    ? 'bg-amber-50 text-amber-950 border-amber-300 font-bold'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {isPasswordRevealed ? (u.password || 'sap2026') : '••••••••'}
                              </span>

                              {/* Ver contraseña actual (PMO) */}
                              {isPMO(currentUser) && (
                                <button
                                  type="button"
                                  onClick={() => togglePasswordVisibility(u.id)}
                                  className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                  title={isPasswordRevealed ? 'Ocultar contraseña' : 'Ver contraseña actual (PMO)'}
                                >
                                  {isPasswordRevealed ? (
                                    <EyeOff className="w-3.5 h-3.5 text-blue-600" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}

                              {/* Editar contraseña (Solo PMO) */}
                              {isPMO(currentUser) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUserForPasswordChange(u);
                                    setShowCurrentPassword(true);
                                    setChangePasswordVal('');
                                    setChangePasswordConfirmVal('');
                                  }}
                                  className="text-slate-400 hover:text-amber-600 p-1 rounded hover:bg-amber-50 transition-colors cursor-pointer"
                                  title="Modificar contraseña (Exclusivo PMO)"
                                >
                                  <Key className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setUserToEdit(u)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Editar datos del usuario"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                disabled={isSelf}
                                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                                  isSelf
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                                title={isSelf ? 'No podés borrarte a vos mismo' : 'Eliminar usuario'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Las contraseñas quedan almacenadas en el sistema para el ingreso seguro.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

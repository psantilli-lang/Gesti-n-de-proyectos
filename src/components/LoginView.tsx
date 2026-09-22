import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ArrowRight, 
  AlertCircle, 
  Layers, 
  UserPlus, 
  CheckCircle2, 
  Sparkles
} from 'lucide-react';
import { UserSession, AppUser, SAP_MODULES_DATA, UserRole } from '../types/project';
import { storageService } from '../services/storageService';
import { isPMO } from '../utils/helpers';

interface LoginViewProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [identifier, setIdentifier] = useState<string>('admin');
  const [password, setPassword] = useState<string>('admin');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Registration form state
  const [regName, setRegName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [regRole, setRegRole] = useState<UserRole>('user');
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null);

  // Available users for quick access
  const allUsers = storageService.getUsers();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    setTimeout(() => {
      const result = storageService.authenticate(identifier, password);
      setIsLoading(false);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMsg(result.message || 'Credenciales incorrectas.');
      }
    }, 250);
  };

  const handleQuickSelect = (user: AppUser) => {
    setIdentifier(user.username || user.email);
    setPassword(user.password || 'sap2026');
    setErrorMsg(null);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    if (regPassword.length < 3) {
      setErrorMsg('La contraseña debe tener al menos 3 caracteres.');
      return;
    }

    const res = storageService.addUser({
      name: regName,
      username: regUsername,
      email: regEmail,
      password: regPassword,
      role: regRole,
    });

    if (res.success && res.user) {
      setRegSuccessMsg(`¡Usuario "${res.user.name}" creado con éxito! Iniciando sesión...`);
      setTimeout(() => {
        const loginRes = storageService.authenticate(res.user!.username, regPassword);
        if (loginRes.success && loginRes.user) {
          onLoginSuccess(loginRes.user);
        }
      }, 1000);
    } else {
      setErrorMsg(res.message || 'Error al registrar usuario.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Brand Header */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20">
            SAP
          </div>
          <div>
            <span className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
              Gestión de Proyectos de Mejora SAP
            </span>
            <span className="text-xs text-blue-300 block">
              Control Integral de Etapas, Cronograma y Acciones
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5">
          {SAP_MODULES_DATA.slice(0, 4).map((mod) => (
            <span
              key={mod.id}
              className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800/80 text-blue-200 border border-slate-700"
            >
              {mod.id}
            </span>
          ))}
          <span className="text-slate-500 text-xs">+3</span>
        </div>
      </div>

      {/* Center Auth Card */}
      <div className="max-w-4xl w-full mx-auto my-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Side: Information & Value */}
        <div className="lg:col-span-5 space-y-6 text-left hidden lg:block">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-700/50 text-blue-300 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Acceso Seguro con Contraseña</span>
          </div>

          <h2 className="text-3xl font-extrabold text-white leading-tight tracking-tight">
            Plataforma de seguimiento y control SAP
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            Ingresá con tu cuenta corporativa para gestionar las iniciativas de mejora, actualizar el cronograma plan vs. real y completar tus acciones pendientes.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 text-xs">
              <ShieldCheck className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <strong className="text-white block font-semibold">Roles PMO y Usuario</strong>
                <span className="text-slate-400">
                  PMO con edición del 100%, priorización y reportería exclusivas. Usuarios con gestión de asignaciones, cambio de estado y control de proyectos propios.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 text-xs">
              <Layers className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <strong className="text-white block font-semibold">Barrida Semanal y Priorización</strong>
                <span className="text-slate-400">
                  Visualización consolidada de avances, estado de etapas y tareas por responsable.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="lg:col-span-7 bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Form Header */}
          <div className="p-6 sm:p-8 bg-slate-50/80 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-700 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {isRegisterMode ? 'Crear Nuevo Usuario' : 'Ingreso al Sistema'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isRegisterMode
                      ? 'Completá los datos para dar de alta una nueva cuenta con contraseña'
                      : 'Ingresá tu usuario o correo corporativo y contraseña'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode);
                  setErrorMsg(null);
                  setRegSuccessMsg(null);
                }}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                {isRegisterMode ? (
                  <>Volver a Iniciar Sesión</>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Crear cuenta</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Form Body */}
          <div className="p-6 sm:p-8 space-y-5">
            {errorMsg && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {regSuccessMsg && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>{regSuccessMsg}</span>
              </div>
            )}

            {!isRegisterMode ? (
              /* LOGIN FORM */
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Usuario o Correo Electrónico
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Ej: admin, crossi o correo@empresa.com"
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Contraseña
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Sensible a mayúsculas
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingresá tu contraseña"
                      className="w-full pl-9 pr-10 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                      title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Verificando credenciales...</span>
                  ) : (
                    <>
                      <span>Ingresar al Sistema</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* REGISTRATION FORM */
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nombre y Apellido *
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Ej: Lic. Marcos Benítez"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nombre de Usuario *
                    </label>
                    <input
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder="Ej: mbenitez"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="m.benitez@empresa.com"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rol en el Sistema *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      className={`flex flex-col gap-0.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        !isPMO({ role: regRole } as UserSession)
                          ? 'bg-blue-50 border-blue-300 text-blue-900 ring-1 ring-blue-300'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <input
                          type="radio"
                          name="regRole"
                          checked={!isPMO({ role: regRole } as UserSession)}
                          onChange={() => setRegRole('user')}
                          className="text-blue-600"
                        />
                        <span>Usuario</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal leading-tight">
                        Completa tareas, cambia estado (excepto Cancelado) y edita proyectos propios
                      </span>
                    </label>

                    <label
                      className={`flex flex-col gap-0.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isPMO({ role: regRole } as UserSession)
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 ring-1 ring-indigo-300'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold">
                        <input
                          type="radio"
                          name="regRole"
                          checked={isPMO({ role: regRole } as UserSession)}
                          onChange={() => setRegRole('pmo')}
                          className="text-indigo-600"
                        />
                        <span>PMO</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal leading-tight">
                        Acceso y edición 100%, priorización y reportería exclusivas
                      </span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={3}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Mínimo 3 caracteres"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Confirmar Contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Repetí la contraseña"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Crear Usuario con Contraseña</span>
                </button>
              </form>
            )}

            {/* Quick Demo Accounts Drawer */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Cuentas Demo para Acceso Rápido:
                </span>
                <span className="text-[10px] text-slate-400">
                  (Haz clic para rellenar usuario y contraseña)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allUsers.slice(0, 4).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickSelect(u)}
                    className="p-2 text-left rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors flex items-center justify-between text-xs group cursor-pointer"
                  >
                    <div className="truncate mr-1">
                      <strong className="block text-slate-800 text-[11px] truncate group-hover:text-blue-700">
                        {u.name}
                      </strong>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Usuario: {u.username} • Clave: {u.password}
                      </span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 uppercase tracking-wider ${
                        isPMO(u)
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isPMO(u) ? 'PMO' : 'Usuario'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-6xl w-full mx-auto text-center py-2 text-xs text-slate-400">
        Gestión de Proyectos SAP • Entorno Corporativo Crucianelli • Autenticación de Usuarios
      </div>
    </div>
  );
};

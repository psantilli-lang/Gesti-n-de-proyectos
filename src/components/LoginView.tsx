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
  ShieldAlert,
  Info,
  Key
} from 'lucide-react';
import { UserSession, SAP_MODULES_DATA } from '../types/project';
import { storageService } from '../services/storageService';
import { signInWithGoogleFirebase, signOutFromFirebase } from '../services/firebase';
import { firestoreService } from '../services/firestoreService';

interface LoginViewProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    setTimeout(() => {
      const result = storageService.authenticate(identifier, password);
      setIsLoading(false);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMsg(result.message || 'Credenciales incorrectas o usuario no registrado.');
      }
    }, 200);
  };

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const firebaseUser = await signInWithGoogleFirebase();
      if (!firebaseUser.email) {
        await signOutFromFirebase();
        throw new Error('La cuenta de Google seleccionada no posee un correo electrónico asociado.');
      }

      // Check if user is registered in system by PMO
      const authResult = storageService.authenticateGoogleUser({
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      });

      if (!authResult.success || !authResult.user) {
        await signOutFromFirebase();
        setErrorMsg(
          authResult.message ||
          `El correo "${firebaseUser.email}" no está registrado en el sistema. Solicitá al PMO que cree tu usuario en Gestión de Usuarios.`
        );
        return;
      }

      // Synchronize updated user profile to Firestore
      const allUsers = storageService.getUsers();
      const matched = allUsers.find((u) => u.id === authResult.user!.id);
      if (matched) {
        firestoreService.saveUser(matched).catch((e) => console.warn('Firestore user sync warning:', e));
      }

      onLoginSuccess(authResult.user);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        if (err?.code === 'auth/unauthorized-domain') {
          const currentDomain = window.location.hostname;
          setErrorMsg(
            `El dominio "${currentDomain}" no está habilitado en Firebase para Google OAuth. ` +
            `Para habilitarlo en Vercel, agregalo en Firebase Console > Authentication > Settings > Authorized domains. ` +
            `Mientras tanto, podés ingresar directamente con tu Usuario y Contraseña asignados por el PMO.`
          );
        } else if (err?.code === 'auth/popup-blocked') {
          setErrorMsg(
            'La ventana emergente de Google fue bloqueada por el navegador. Por favor permití los popups en la barra de direcciones e intentá nuevamente.'
          );
        } else {
          setErrorMsg(err.message || 'Error al autenticarse con la cuenta de Google.');
        }
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const autofillAdmin = () => {
    setIdentifier('admin');
    setPassword('admin');
    setErrorMsg(null);
    setSuccessMsg('Credenciales de Administrador cargadas (admin / admin). Hacé clic en "Ingresar al Sistema".');
  };

  const autofillPMO = () => {
    setIdentifier('pmo');
    setPassword('pmo');
    setErrorMsg(null);
    setSuccessMsg('Credenciales de PMO cargadas (pmo / pmo). Hacé clic en "Ingresar al Sistema".');
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
        {/* Left Side: Information & Access Policy */}
        <div className="lg:col-span-5 space-y-6 text-left hidden lg:block">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-700/50 text-blue-300 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Acceso con Nómina Autorizada</span>
          </div>

          <h2 className="text-3xl font-extrabold text-white leading-tight tracking-tight">
            Plataforma de seguimiento y control SAP
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            Sistema restringido exclusivamente a miembros y colaboradores registrados en la nómina oficial del PMO.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <strong className="text-white block font-semibold">Gestión Centralizada por PMO</strong>
                <span className="text-slate-400">
                  Los usuarios son creados y administrados exclusivamente por el PMO dentro de la plataforma. No se permite autoregistro público.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50 text-xs">
              <Layers className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <strong className="text-white block font-semibold">Acceso Seguro Multi-canal</strong>
                <span className="text-slate-400">
                  Podés acceder con tu usuario y contraseña asignados o con tu cuenta de Google corporativa previamente registrada.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form Container */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden text-slate-900">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  Iniciar Sesión
                </span>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  • Acceso exclusivo para personal autorizado
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3 h-3" />
                Seguro
              </span>
            </div>

            {/* Form Body */}
            <div className="p-6 sm:p-8 space-y-4">
              {errorMsg && (
                <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <strong className="block font-semibold">Acceso denegado</strong>
                    <span>{errorMsg}</span>
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* GOOGLE SIGN-IN BUTTON */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isGoogleLoading || isLoading}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 shadow-xs hover:border-slate-400 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>
                    {isGoogleLoading ? 'Verificando con Google...' : 'Continuar con Google'}
                  </span>
                </button>
                <div className="text-[11px] text-center text-slate-500">
                  Válido para cuentas dadas de alta por el PMO (<strong className="text-slate-700">@crucianelli.com</strong> o consultores)
                </div>

                <div className="relative flex items-center justify-center my-3">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider absolute">
                    O con usuario y contraseña
                  </span>
                </div>
              </div>

              {/* QUICK ADMIN AUTOFILL HELPER */}
              <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-blue-900">
                  <Key className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="font-semibold block text-slate-800">¿Acceso inicial como Administrador?</span>
                    <span className="text-[11px] text-slate-600">Usuario: <strong>admin</strong> | Clave: <strong>admin</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={autofillAdmin}
                    className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    admin
                  </button>
                  <button
                    type="button"
                    onClick={autofillPMO}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-700 hover:bg-slate-800 text-white rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    pmo
                  </button>
                </div>
              </div>

              {/* LOGIN FORM */}
              <form onSubmit={handleLogin} className="space-y-4 pt-1">
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
                      placeholder="admin, pmo o tu usuario/correo"
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
                  disabled={isLoading || isGoogleLoading}
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

              {/* Informative notice for non-registered users */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <span className="leading-relaxed">
                  ¿No tenés acceso? Solo pueden ingresar las personas dadas de alta por el equipo de <strong>PMO SAP</strong> desde el módulo de Gestión de Usuarios. Solicitá tu alta a tu referente o al Administrador.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-6xl w-full mx-auto text-center py-2 text-xs text-slate-400">
        Gestión de Proyectos SAP • Acceso Estricto para Personal y Consultores Autorizados
      </div>
    </div>
  );
};

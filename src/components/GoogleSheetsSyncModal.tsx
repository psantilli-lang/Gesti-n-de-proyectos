import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Clock,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Database,
  Layers,
  LogOut,
  Sparkles,
  Columns3
} from 'lucide-react';
import { SAPProject } from '../types/project';
import {
  googleSheetsSyncService,
  GoogleSheetsSyncConfig,
  SHEETS_COLUMNS,
} from '../services/googleSheetsSyncService';
import {
  googleSignIn,
  googleSignOut,
  getAccessToken,
  getCurrentGoogleUser,
  initAuth,
} from '../services/googleAuthService';

interface GoogleSheetsSyncModalProps {
  projects: SAPProject[];
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted?: (lastSyncAt: string, spreadsheetUrl?: string) => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  projects,
  isOpen,
  onClose,
  onSyncCompleted,
}) => {
  const [config, setConfig] = useState<GoogleSheetsSyncConfig>(() =>
    googleSheetsSyncService.getConfig()
  );
  const [googleUser, setGoogleUser] = useState(() => getCurrentGoogleUser());
  const [accessToken, setAccessToken] = useState<string | null>(() => getAccessToken());
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setConfig(googleSheetsSyncService.getConfig());
    setAccessToken(getAccessToken());
    setGoogleUser(getCurrentGoogleUser());

    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setSyncStatusMsg(null);
    try {
      const res = await googleSignIn();
      setGoogleUser(res.user);
      setAccessToken(res.accessToken);
      setSyncStatusMsg({
        type: 'success',
        text: `Conectado exitosamente como ${res.user.email || res.user.displayName}`,
      });
      // Optionally run immediate sync
      handleRunSync(res.accessToken);
    } catch (err: any) {
      console.error('Sign in error:', err);
      setSyncStatusMsg({
        type: 'error',
        text: err?.message || 'No se pudo completar el inicio de sesión con Google.',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setGoogleUser(null);
    setAccessToken(null);
    setSyncStatusMsg(null);
  };

  const handleToggleAutoSync = () => {
    const updated = googleSheetsSyncService.saveConfig({
      autoSync: !config.autoSync,
    });
    setConfig(updated);
  };

  const handleRunSync = async (tokenOverride?: string) => {
    const token = tokenOverride || accessToken || getAccessToken();
    if (!token) {
      setSyncStatusMsg({
        type: 'error',
        text: 'Primero debes conectar tu cuenta de Google para sincronizar.',
      });
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg(null);

    try {
      const res = await googleSheetsSyncService.syncProjects(projects, token);
      setConfig(googleSheetsSyncService.getConfig());
      setSyncStatusMsg({
        type: 'success',
        text: `¡Sincronización exitosa! Se actualizaron ${res.syncedCount} proyectos (${res.syncedRows} filas de acciones) en Google Sheets.`,
      });
      if (onSyncCompleted) {
        onSyncCompleted(res.syncedAt, res.spreadsheetUrl);
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      setSyncStatusMsg({
        type: 'error',
        text: err?.message || 'Ocurrió un error al actualizar la hoja de cálculo.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                Sincronización con Google Sheets
              </h2>
              <p className="text-xs text-emerald-200">
                Archivo único centralizado y siempre actualizado con tus proyectos SAP
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-900/60 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs text-slate-700">
          {/* Status feedback message */}
          {syncStatusMsg && (
            <div
              className={`p-3 rounded-lg flex items-start gap-2.5 ${
                syncStatusMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border border-rose-200 text-rose-900'
              }`}
            >
              {syncStatusMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              )}
              <span className="font-medium leading-relaxed">{syncStatusMsg.text}</span>
            </div>
          )}

          {/* 1. GOOGLE ACCOUNT CONNECTION */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Cuenta de Google
              </span>

              {googleUser && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer font-medium"
                  title="Desconectar cuenta Google"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Cerrar sesión</span>
                </button>
              )}
            </div>

            {googleUser && accessToken ? (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-emerald-200 shadow-2xs">
                <div className="flex items-center gap-3">
                  {googleUser.photoURL ? (
                    <img
                      src={googleUser.photoURL}
                      alt={googleUser.displayName || 'Google user'}
                      className="w-9 h-9 rounded-full border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs uppercase">
                      {(googleUser.email || 'G')[0]}
                    </div>
                  )}
                  <div>
                    <span className="font-bold text-slate-900 block leading-tight text-xs">
                      {googleUser.displayName || 'Usuario Google'}
                    </span>
                    <span className="text-[11px] text-slate-500 block font-mono">
                      {googleUser.email}
                    </span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Conectado
                </span>
              </div>
            ) : (
              <div className="p-4 bg-white rounded-lg border border-slate-200 text-center space-y-3 shadow-2xs">
                <p className="text-xs text-slate-600">
                  Conectá tu cuenta corporativa de Google para crear el archivo único de Google Sheets y sincronizarlo automáticamente.
                </p>

                {/* Google Sign-in standard button */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={isAuthenticating}
                    className="inline-flex items-center justify-center gap-3 px-5 py-2.5 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-lg font-bold text-slate-700 shadow-2xs text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>{isAuthenticating ? 'Conectando con Google...' : 'Iniciar sesión con Google'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. UNIQUE SPREADSHEET CARD */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-emerald-950 text-xs">
                  Archivo Único de Hoja de Cálculo
                </span>
              </div>

              {config.spreadsheetUrl ? (
                <a
                  href={config.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-colors"
                >
                  <span>Abrir en Google Sheets</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-[11px] text-slate-400 font-medium">
                  Se creará automáticamente en tu primer sincronización
                </span>
              )}
            </div>

            <div className="p-3 bg-white rounded-lg border border-emerald-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Nombre del archivo único
                  </span>
                  <span className="font-bold text-slate-800 text-xs block">
                    {config.title}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Carga actual
                  </span>
                  <span className="font-bold text-emerald-700 text-xs">
                    {projects.length} {projects.length === 1 ? 'proyecto' : 'proyectos'} •{' '}
                    {projects.reduce((acc, p) => acc + (p.actions?.length || 0), 0)} acciones
                  </span>
                </div>
              </div>

              {config.spreadsheetId && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 font-mono text-[10px]">
                    <Database className="w-3 h-3 text-slate-400" />
                    ID: {config.spreadsheetId.substring(0, 18)}...
                  </span>

                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Última sincronización:{' '}
                    <strong className="text-slate-700">
                      {config.lastSyncAt
                        ? new Date(config.lastSyncAt).toLocaleString('es-AR', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })
                        : 'Nunca'}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            {/* Auto Sync Switch */}
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
              <div>
                <span className="font-bold text-slate-800 text-xs block leading-tight">
                  Sincronización Automática en Tiempo Real
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Actualiza el archivo de Google Sheets cada vez que se modifique o cargue un proyecto o acción.
                </span>
              </div>

              <button
                type="button"
                onClick={handleToggleAutoSync}
                className="text-emerald-700 cursor-pointer p-1"
                title={config.autoSync ? 'Desactivar sincronización automática' : 'Activar sincronización automática'}
              >
                {config.autoSync ? (
                  <ToggleRight className="w-7 h-7 text-emerald-600" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* 3. SYNCHRONIZED COLUMNS PREVIEW */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                <Columns3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Columnas del archivo ({SHEETS_COLUMNS.length} campos):</span>
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                1 acción por fila
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {SHEETS_COLUMNS.map((col, idx) => (
                <div
                  key={col}
                  className="px-2 py-1.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] flex items-center gap-1.5"
                >
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[9px] shrink-0">
                    {idx + 1}
                  </span>
                  <span className="truncate font-medium">{col}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {config.autoSync ? '• Sincronización automática activada' : '• Modo manual'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-bold text-xs cursor-pointer"
            >
              Cerrar
            </button>

            <button
              type="button"
              onClick={() => handleRunSync()}
              disabled={isSyncing || (!accessToken && !googleUser)}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando con Google Sheets...' : 'Sincronizar Ahora'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

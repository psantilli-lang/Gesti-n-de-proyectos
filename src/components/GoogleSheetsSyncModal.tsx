import React, { useState, useEffect, useRef } from 'react';
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
  Download,
  FileUp,
  Sparkles,
  Columns3,
  Check,
  LogIn,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { SAPProject } from '../types/project';
import {
  googleSheetsSyncService,
  GoogleSheetsSyncConfig,
  SHEETS_COLUMNS,
  DEFAULT_SPREADSHEET_ID,
  parseCSVText,
  parseSpreadsheetRowsToProjects,
} from '../services/googleSheetsSyncService';
import { storageService } from '../services/storageService';
import { firestoreService } from '../services/firestoreService';
import {
  googleSignIn,
  googleSignOut,
  getAccessToken,
  getCurrentGoogleUser,
  initAuth,
  validateGoogleToken,
  clearStoredToken,
} from '../services/googleAuthService';

interface GoogleSheetsSyncModalProps {
  projects: SAPProject[];
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted?: (lastSyncAt: string, spreadsheetUrl?: string) => void;
  onProjectsImported?: (projects: SAPProject[]) => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  projects,
  isOpen,
  onClose,
  onSyncCompleted,
  onProjectsImported,
}) => {
  const [config, setConfig] = useState<GoogleSheetsSyncConfig>(() =>
    googleSheetsSyncService.getConfig()
  );
  const [googleUser, setGoogleUser] = useState(() => getCurrentGoogleUser());
  const [accessToken, setAccessToken] = useState<string | null>(() => getAccessToken());
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [availableSheets, setAvailableSheets] = useState<{
    sheetId: number;
    title: string;
    rowCount: number;
    projectCount: number;
  }[]>([]);
  const [selectedSheetTitle, setSelectedSheetTitle] = useState<string>('');
  const [syncStatusMsg, setSyncStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSignIn = async (): Promise<string | null> => {
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
      return res.accessToken;
    } catch (err: any) {
      console.error('Sign in error:', err);
      const isUnauthorizedDomain = err?.code === 'auth/unauthorized-domain';
      setSyncStatusMsg({
        type: 'error',
        text: isUnauthorizedDomain
          ? `El dominio "${window.location.hostname}" debe ser agregado en Firebase Console (Authentication > Settings > Authorized domains). Podés usar la importación por archivo CSV en esta misma pantalla mientras tanto.`
          : err?.message || 'No se pudo completar el inicio de sesión con Google.',
      });
      return null;
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

  /**
   * Imports all projects directly from Crucianelli Google Sheet
   * Handles expired tokens automatically and scans all tabs to locate the 74 projects
   */
  const handleImportFromSheets = async (targetTitle?: string | React.MouseEvent) => {
    setIsImporting(true);
    setSyncStatusMsg(null);

    const safeTitle =
      typeof targetTitle === 'string' && targetTitle.trim().length > 0
        ? targetTitle.trim()
        : typeof selectedSheetTitle === 'string' && selectedSheetTitle.trim().length > 0
        ? selectedSheetTitle.trim()
        : undefined;

    try {
      let token = accessToken || getAccessToken();
      const isValid = await validateGoogleToken(token);

      // If token is missing, corrupted or expired, prompt Google Sign-in to get a fresh OAuth token
      if (!token || !isValid) {
        clearStoredToken();
        setAccessToken(null);
        token = await handleSignIn();
        if (!token) {
          setIsImporting(false);
          return;
        }
      }

      const spreadsheetId = config.spreadsheetId || DEFAULT_SPREADSHEET_ID;
      let result;

      try {
        result = await googleSheetsSyncService.importProjectsFromSpreadsheet(spreadsheetId, token, safeTitle);
      } catch (firstErr: any) {
        // If 401 unauthenticated or stale token yielded empty data, clear token and prompt sign in popup once to retry
        if (
          firstErr?.message?.includes('401') || 
          firstErr?.message?.includes('UNAUTHENTICATED') || 
          firstErr?.message?.includes('expirada') ||
          firstErr?.message?.includes('invalid authentication') ||
          firstErr?.message?.includes('No se encontraron filas con datos')
        ) {
          console.warn('Google Sheets token expired or invalid (401). Prompting for fresh Google login...');
          clearStoredToken();
          setAccessToken(null);
          token = await handleSignIn();
          if (!token) {
            throw new Error('La sesión de Google expiró. Por favor iniciá sesión nuevamente para acceder a la planilla.');
          }
          result = await googleSheetsSyncService.importProjectsFromSpreadsheet(spreadsheetId, token, safeTitle);
        } else {
          throw firstErr;
        }
      }

      if (!result.projects || result.projects.length === 0) {
        throw new Error('No se detectaron proyectos válidos en la planilla seleccionada.');
      }

      setAvailableSheets(result.availableSheets || []);
      setSelectedSheetTitle(result.sheetTitle);

      // Persist in local storage immediately
      storageService.saveProjects(result.projects);

      // Update state in parent view immediately
      if (onProjectsImported) {
        onProjectsImported(result.projects);
      }

      setSyncStatusMsg({
        type: 'success',
        text: `¡Importación completada con éxito! Se cargaron ${result.projects.length} proyectos oficiales (${result.totalRows} filas de acciones) desde la pestaña "${result.sheetTitle}", sustituyendo los datos de prueba.`,
      });

      // Completely replace Firestore projects with official ones in background
      firestoreService.replaceAllProjects(result.projects).catch((cloudErr) => {
        console.warn('Firestore cloud sync notice:', cloudErr);
      });
    } catch (err: any) {
      console.error('Error importing from Google Sheets:', err);
      setSyncStatusMsg({
        type: 'error',
        text: err?.message || 'Ocurrió un error al importar los proyectos desde Google Sheets.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Deletes all existing projects from Firestore and localStorage (wiping test data)
   */
  const handleDeleteAllProjects = async () => {
    setIsImporting(true);
    setSyncStatusMsg(null);
    try {
      await firestoreService.deleteAllProjects();
      if (onProjectsImported) {
        onProjectsImported([]);
      }
      setSyncStatusMsg({
        type: 'success',
        text: '¡Proyectos viejos eliminados correctamente! La base de datos ha quedado limpia para la importación oficial.',
      });
    } catch (err: any) {
      console.error('Error deleting projects:', err);
      setSyncStatusMsg({
        type: 'error',
        text: err?.message || 'Error al eliminar los proyectos.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Restores previously saved backup projects from localStorage
   */
  const handleRestoreBackup = () => {
    try {
      const backupProjects = storageService.restoreBackup();
      if (backupProjects && backupProjects.length > 0) {
        if (onProjectsImported) {
          onProjectsImported(backupProjects);
        }
        firestoreService.replaceAllProjects(backupProjects).catch((cloudErr) => {
          console.warn('Firestore restore backup notice:', cloudErr);
        });
        setSyncStatusMsg({
          type: 'success',
          text: `¡Copia de seguridad restaurada! Se recuperaron ${backupProjects.length} proyectos exitosamente.`,
        });
      } else {
        setSyncStatusMsg({
          type: 'error',
          text: 'No se encontró ninguna copia de seguridad previa en este navegador.',
        });
      }
    } catch (e: any) {
      setSyncStatusMsg({
        type: 'error',
        text: 'Error al restaurar la copia de seguridad: ' + (e?.message || ''),
      });
    }
  };

  /**
   * Downloads a physical JSON backup file of all current projects to the user device
   */
  const handleDownloadBackup = () => {
    const list = projects && projects.length > 0 ? projects : storageService.getProjects();
    if (!list || list.length === 0) {
      setSyncStatusMsg({
        type: 'error',
        text: 'No hay proyectos cargados actualmente para exportar.',
      });
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(list, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `respaldo_proyectos_sap_crucianelli_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setSyncStatusMsg({
      type: 'success',
      text: `¡Copia física descargada con éxito (${list.length} proyectos)! Guardá este archivo en tu computadora como resguardo total.`,
    });
  };

  /**
   * Restores projects from an uploaded JSON backup file
   */
  const handleUploadBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setSyncStatusMsg(null);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('El archivo no contiene un formato de proyectos válido.');
        }
        storageService.saveProjects(parsed);
        if (onProjectsImported) {
          onProjectsImported(parsed);
        }
        firestoreService.replaceAllProjects(parsed).catch((err) => {
          console.warn('Sync restored projects to cloud warning:', err);
        });
        setSyncStatusMsg({
          type: 'success',
          text: `¡Restauración exitosa! Se cargaron ${parsed.length} proyectos desde "${file.name}".`,
        });
      } catch (err: any) {
        setSyncStatusMsg({
          type: 'error',
          text: 'Error al procesar el archivo de respaldo: ' + (err?.message || ''),
        });
      } finally {
        setIsImporting(false);
        if (backupFileInputRef.current) backupFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  /**
   * Fallback CSV file upload: parses downloaded CSV file directly
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setSyncStatusMsg(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        if (!text) throw new Error('El archivo seleccionado está vacío.');

        const rows = parseCSVText(text);
        const imported = parseSpreadsheetRowsToProjects(rows);

        if (imported.length === 0) {
          throw new Error('No se encontraron proyectos con formato válido en el archivo CSV.');
        }

        // Persist in local storage immediately
        storageService.saveProjects(imported);

        // Update state in parent view immediately
        if (onProjectsImported) {
          onProjectsImported(imported);
        }

        setSyncStatusMsg({
          type: 'success',
          text: `¡Importación exitosa! Se cargaron los ${imported.length} proyectos con sus códigos originales tal como figuran en el archivo "${file.name}".`,
        });

        // Completely replace Firestore projects with imported ones in background
        firestoreService.replaceAllProjects(imported).catch((cloudErr) => {
          console.warn('Firestore CSV cloud sync notice:', cloudErr);
        });
      } catch (err: any) {
        console.error('CSV import error:', err);
        setSyncStatusMsg({
          type: 'error',
          text: err?.message || 'Error al procesar el archivo CSV.',
        });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setIsImporting(false);
      setSyncStatusMsg({
        type: 'error',
        text: 'No se pudo leer el archivo seleccionado.',
      });
    };

    reader.readAsText(file);
  };

  const handleRunSync = async (tokenOverride?: string) => {
    let token = tokenOverride || accessToken || getAccessToken();
    const isValid = await validateGoogleToken(token);
    if (!token || !isValid) {
      clearStoredToken();
      setAccessToken(null);
      token = await handleSignIn();
      if (!token) return;
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
                Integración con Google Sheets
              </h2>
              <p className="text-xs text-emerald-200">
                Carga de proyectos oficiales y sincronización en tiempo real
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
              className={`p-3.5 rounded-xl border flex flex-col gap-2 ${
                syncStatusMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {syncStatusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                )}
                <span className="font-medium leading-relaxed">{syncStatusMsg.text}</span>
              </div>

              {/* Actionable buttons if error */}
              {syncStatusMsg.type === 'error' && (
                <div className="flex items-center gap-2 mt-1 pt-2 border-t border-rose-200/60">
                  <button
                    type="button"
                    onClick={() => handleSignIn()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Conectar / Renovar cuenta Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                  >
                    <FileUp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>O subir CSV descargado</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 1. HERO SECTION: CARGAR / IMPORTAR PLANILLA OFICIAL (74 PROYECTOS) */}
          <div className="p-4 rounded-xl border-2 border-emerald-500/60 bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white space-y-3.5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wider mb-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Planilla Oficial de Crucianelli
                </div>
                <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                  Importar Proyectos Oficiales (Sustituir pruebas)
                </h3>
                <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                  Carga todos los proyectos y sus acciones agrupadas manteniendo los códigos originales de tu planilla o archivo CSV para asegurar la trazabilidad.
                </p>
              </div>

              {config.spreadsheetUrl && (
                <a
                  href={config.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1 text-[11px] font-semibold"
                  title="Abrir hoja de cálculo de Crucianelli"
                >
                  <span>Abrir planilla</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Action Buttons: Google Sheets API or CSV upload */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleImportFromSheets()}
                disabled={isImporting}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Cargando planilla...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Cargar desde Google Sheets</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 hover:border-slate-400 shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <FileUp className="w-4 h-4 text-emerald-700" />
                <span>O subir archivo CSV</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv"
                className="hidden"
              />
            </div>

            {/* Opción de recuperación si existe copia de respaldo local */}
            {storageService.hasBackup() && (
              <div className="pt-2 border-t border-emerald-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleRestoreBackup}
                  disabled={isImporting}
                  className="w-full py-2 px-3 bg-amber-50/90 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Restaura la copia de seguridad guardada previamente en este navegador"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                  <span>Restaurar copia de seguridad local ({storageService.getProjects().length > 0 ? 'Recuperar' : 'Restaurar proyectos previos'})</span>
                </button>
              </div>
            )}

            {/* Pestañas detectadas en la planilla */}
            {availableSheets.length > 0 && (
              <div className="pt-3 border-t border-emerald-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs bg-emerald-50/70 p-3 rounded-xl border">
                <div className="flex items-center gap-1.5 text-emerald-950 font-bold">
                  <Columns3 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Pestaña de Google Sheets:</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={selectedSheetTitle}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      setSelectedSheetTitle(newTitle);
                      handleImportFromSheets(newTitle);
                    }}
                    disabled={isImporting}
                    className="bg-white border border-emerald-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 cursor-pointer w-full sm:w-auto shadow-2xs"
                  >
                    {availableSheets.map((sh) => (
                      <option key={sh.sheetId} value={sh.title}>
                        {sh.title} ({sh.projectCount} proyectos - {sh.rowCount} filas)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 1.5 RESPALDO FÍSICO Y SEGURIDAD TOTAL (GARANTÍA CONTRA PÉRDIDAS) */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Database className="w-4 h-4 text-blue-600" />
                Copia de Seguridad Física (Archivo JSON)
              </span>
              <span className="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-semibold">
                Resguardo 100% en tu PC
              </span>
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              Descargá un archivo con todos los proyectos, cronogramas y acciones a tu computadora en cualquier momento. Si cambiás de equipo o borrás el historial de navegación, podés restaurarlo en 1 segundo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isImporting}
                className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-blue-900 border border-blue-300 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Descargar Respaldo JSON</span>
              </button>

              <button
                type="button"
                onClick={() => backupFileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <FileUp className="w-3.5 h-3.5 text-slate-600" />
                <span>Cargar Respaldo JSON</span>
              </button>

              <input
                type="file"
                ref={backupFileInputRef}
                onChange={handleUploadBackupFile}
                accept=".json"
                className="hidden"
              />
            </div>
          </div>

          {/* 2. GOOGLE ACCOUNT CONNECTION */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Cuenta Google Vinculada
              </span>

              {googleUser && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer font-medium"
                  title="Desconectar cuenta Google"
                >
                  <X className="w-3 h-3" />
                  <span>Desconectar</span>
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
                      className="w-8 h-8 rounded-full border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs uppercase">
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

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Conectado
                  </span>

                  <button
                    type="button"
                    onClick={() => handleSignIn()}
                    className="text-[10px] text-slate-500 hover:text-blue-600 underline cursor-pointer"
                    title="Renovar token de Google"
                  >
                    Renovar
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
                <p className="text-[11px] text-slate-600">
                  Iniciá sesión con tu cuenta Google corporativa (<strong className="text-slate-700">@crucianelli.com</strong>) para conectar con la hoja de cálculo.
                </p>

                <button
                  type="button"
                  onClick={() => handleSignIn()}
                  disabled={isAuthenticating}
                  className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isAuthenticating ? 'Conectando...' : 'Iniciar Sesión'}</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. EXPORT / SYNC CONFIGURATION */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">
                Sincronización Automática en la Nube
              </span>
              <button
                type="button"
                onClick={handleToggleAutoSync}
                className="text-emerald-700 cursor-pointer p-0.5"
                title={config.autoSync ? 'Desactivar auto-sync' : 'Activar auto-sync'}
              >
                {config.autoSync ? (
                  <ToggleRight className="w-7 h-7 text-emerald-600" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-slate-400" />
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Mantener activada la sincronización permite que cualquier cambio realizado en la aplicación se actualice automáticamente en la hoja de Google Sheets.
            </p>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 text-[11px] text-slate-500">
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <Database className="w-3 h-3 text-slate-400" />
                ID: {config.spreadsheetId ? `${config.spreadsheetId.substring(0, 16)}...` : 'Configurado'}
              </span>

              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Última sincronización:{' '}
                <strong className="text-slate-700">
                  {config.lastSyncAt
                    ? new Date(config.lastSyncAt).toLocaleString('es-AR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : 'Nunca'}
                </strong>
              </span>
            </div>
          </div>

          {/* 4. COLUMNS PREVIEW */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                <Columns3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Columnas mapeadas ({SHEETS_COLUMNS.length} campos):</span>
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
            {projects.length} {projects.length === 1 ? 'proyecto cargado' : 'proyectos cargados'}
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
              <span>{isSyncing ? 'Exportando...' : 'Exportar a Google Sheets'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

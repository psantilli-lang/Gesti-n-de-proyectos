import React from 'react';
import { 
  CheckSquare2, 
  FolderKanban, 
  BarChart3, 
  Plus, 
  ShieldCheck, 
  UserCheck, 
  RotateCcw,
  ListTodo,
  Layers,
  ArrowUpDown,
  Users,
  LogOut,
  UserPlus,
  FileSpreadsheet,
  ExternalLink,
  Settings,
  Mail,
} from 'lucide-react';
import { UserSession, SAP_MODULES_DATA } from '../types/project';
import { isPMO, getRoleDisplayName } from '../utils/helpers';

export type ActiveTab = 'weekly' | 'tasks' | 'prioritization' | 'projects' | 'reports';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: UserSession;
  allUsers: UserSession[];
  onUserChange?: (user: UserSession) => void;
  onOpenUserManagement?: () => void;
  onLogout?: () => void;
  onOpenNewProject: () => void;
  onResetData: () => void;
  onOpenGoogleSheetsSync?: () => void;
  sheetsSyncInfo?: {
    lastSyncAt: string | null;
    isSyncing?: boolean;
    isConnected?: boolean;
    spreadsheetUrl?: string | null;
  };
  totalProjects: number;
  pendingActionsCount: number;
  myPendingTasksCount?: number;
  isFirestoreConnected?: boolean;
  googleConnectedEmail?: string | null;
  onOpenGoogleAccount?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  allUsers,
  onUserChange,
  onOpenUserManagement,
  onLogout,
  onOpenNewProject,
  onResetData,
  onOpenGoogleSheetsSync,
  sheetsSyncInfo,
  totalProjects,
  pendingActionsCount,
  myPendingTasksCount = 0,
  isFirestoreConnected = false,
  googleConnectedEmail = null,
  onOpenGoogleAccount,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1: Brand / Logo + SAP Modules + User Profile Bar */}
        <div className="py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {/* Brand / Logo + SAP Title */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shadow-blue-600/20 shrink-0">
              SAP
            </div>
            <div className="shrink-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight whitespace-nowrap">
                  Gestión de Proyectos SAP
                </h1>
                <span className="hidden lg:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Crucianelli
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block leading-none mt-0.5">
                Barrida semanal, control de etapas y cronograma plan vs. real
              </p>
            </div>
          </div>

          {/* Right side of Top Row: SAP Modules Badges & User Profile */}
          <div className="flex items-center gap-3 flex-wrap ml-auto">
            {/* SAP Modules pill row */}
            <div className="hidden sm:flex items-center gap-1 flex-wrap">
              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] flex items-center gap-1 mr-1">
                <Layers className="w-3 h-3 text-blue-600" />
                Módulos:
              </span>
              {SAP_MODULES_DATA.map((mod) => (
                <span
                  key={mod.id}
                  title={`${mod.id} - ${mod.name}`}
                  className="px-1.5 py-0.5 rounded font-mono font-medium text-[10px] bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  {mod.id}
                </span>
              ))}
            </div>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            {/* User Session & Management Section */}
            <div className="flex items-center gap-2">
              {/* Firestore Real-time Status Badge */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                title={
                  isFirestoreConnected
                    ? 'Base de datos en la nube Firebase Firestore conectada en tiempo real'
                    : 'Conectando con Firebase Firestore...'
                }
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isFirestoreConnected
                      ? 'bg-emerald-500 shadow-xs shadow-emerald-500/60 animate-pulse'
                      : 'bg-amber-400'
                  }`}
                />
                <span className="text-[11px] font-medium text-slate-600 hidden sm:inline">
                  {isFirestoreConnected ? 'Firestore en vivo' : 'Conectando...'}
                </span>
              </div>

              {/* PMO User Management Button */}
              {isPMO(currentUser) && onOpenUserManagement && (
                <button
                  type="button"
                  onClick={onOpenUserManagement}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                  title="Administrar usuarios, roles y contraseñas de acceso (Exclusivo PMO)"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden md:inline">Gestión de Usuarios</span>
                  <span className="ml-0.5 px-1.5 py-0.2 bg-indigo-200/80 text-indigo-950 rounded-full text-[10px] font-bold">
                    {allUsers.length}
                  </span>
                </button>
              )}

              {/* Current Logged-in User Badge */}
              {currentUser && (
                <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    {isPMO(currentUser) ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    )}
                    <div className="flex flex-col text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[120px] sm:max-w-[180px]">
                          {currentUser.name}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                            isPMO(currentUser)
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {getRoleDisplayName(currentUser.role)}
                        </span>
                      </div>
                      {currentUser.username && (
                        <span className="text-[10px] text-slate-400 font-mono leading-none">
                          @{currentUser.username}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Logout Button */}
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="ml-1 p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                      title="Cerrar sesión"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Navigation Tabs & Primary Actions */}
        <div className="py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Tab Navigation */}
          <nav className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto no-scrollbar shrink-0">
            <button
              onClick={() => setActiveTab('weekly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'weekly'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckSquare2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Barrida Semanal</span>
              {pendingActionsCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
                  {pendingActionsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5 text-amber-600" />
              <span>Tareas pendientes</span>
              {myPendingTasksCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold">
                  {myPendingTasksCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'projects'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5 text-slate-600" />
              <span>Proyectos SAP ({totalProjects})</span>
            </button>

            {isPMO(currentUser) && (
              <button
                onClick={() => setActiveTab('prioritization')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'prioritization'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Actividad exclusiva del PMO"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                <span>Priorización</span>
                <span className="px-1 py-0.2 bg-indigo-100 text-indigo-800 rounded text-[9px] font-extrabold uppercase">
                  PMO
                </span>
              </button>
            )}

            {isPMO(currentUser) && (
              <button
                onClick={() => setActiveTab('reports')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Actividad exclusiva del PMO"
              >
                <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Reportes</span>
                <span className="px-1 py-0.2 bg-indigo-100 text-indigo-800 rounded text-[9px] font-extrabold uppercase">
                  PMO
                </span>
              </button>
            )}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Google / Gmail Account Linking Button - Exclusively visible and manageable by PMO */}
            {isPMO(currentUser) && onOpenGoogleAccount && (
              googleConnectedEmail ? (
                <button
                  type="button"
                  onClick={onOpenGoogleAccount}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-900 text-xs font-semibold transition-all cursor-pointer shadow-2xs whitespace-nowrap active:scale-[0.98]"
                  title="Cuenta de correo vinculada para envíos automáticos (Gestión exclusiva PMO). Clic para opciones o cambiar cuenta."
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="hidden sm:inline font-bold text-blue-700">Gmail:</span>
                  <span className="max-w-[120px] md:max-w-[170px] truncate text-slate-800 font-medium">
                    {googleConnectedEmail}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 inline-block" title="Conectado y listo para enviar correos" />
                  <span className="px-1 py-0.2 bg-blue-200/80 text-blue-900 rounded text-[9px] font-extrabold uppercase ml-0.5">
                    PMO
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenGoogleAccount}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs whitespace-nowrap active:scale-[0.98]"
                  title="Vincular cuenta de Google / Gmail para el envío de notificaciones automáticas (Exclusivo PMO)"
                >
                  <Mail className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>Vincular Gmail</span>
                  <span className="w-2 h-2 rounded-full bg-amber-300 shrink-0 animate-pulse" />
                  <span className="px-1 py-0.2 bg-blue-800 text-blue-100 rounded text-[9px] font-extrabold uppercase ml-0.5">
                    PMO
                  </span>
                </button>
              )
            )}

            {/* Google Sheets Direct Open & Sync Controls */}
            {onOpenGoogleSheetsSync && (
              <div className="flex items-center rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 transition-colors shadow-2xs overflow-hidden">
                {sheetsSyncInfo?.spreadsheetUrl ? (
                  <a
                    href={sheetsSyncInfo.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-emerald-900 text-xs font-bold transition-all cursor-pointer hover:text-emerald-950 active:scale-[0.98] whitespace-nowrap"
                    title="Abrir directamente el archivo en Google Sheets"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="inline font-bold">Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-600 opacity-80 shrink-0" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenGoogleSheetsSync}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-emerald-900 text-xs font-bold transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap"
                    title="Conectar y abrir Google Sheets"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="inline font-bold">Google Sheets</span>
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Pendiente de conectar" />
                  </button>
                )}

                {/* Settings / Sync Modal Trigger */}
                <button
                  type="button"
                  onClick={onOpenGoogleSheetsSync}
                  className="px-2 py-1.5 border-l border-emerald-200/80 hover:bg-emerald-200/60 text-emerald-700 transition-colors cursor-pointer"
                  title="Configuración y estado de sincronización"
                >
                  {sheetsSyncInfo?.isSyncing ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  ) : sheetsSyncInfo?.isConnected ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Sincronización activa" />
                  ) : (
                    <Settings className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                </button>
              </div>
            )}

            {/* CTA Nuevo Proyecto */}
            <button
              onClick={onOpenNewProject}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs shadow-blue-600/20 active:scale-[0.98] whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Proyecto</span>
            </button>

            {/* Reset mock data button */}
            <button
              onClick={() => {
                if (window.confirm('¿Desea restablecer los proyectos a los datos iniciales de prueba?')) {
                  onResetData();
                }
              }}
              title="Restablecer datos demo"
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

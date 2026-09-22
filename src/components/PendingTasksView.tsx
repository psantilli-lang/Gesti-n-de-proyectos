import React, { useState, useMemo } from 'react';
import {
  SAPProject,
  StageAction,
  UserSession,
  SAP_AREAS,
  ActionStatus,
  AttachedFile,
} from '../types/project';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  MessageSquare,
  Paperclip,
  CheckSquare2,
  FolderKanban,
  User,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  ListTodo,
  Check,
  Trash2,
  Eye,
  Download,
  FileText,
} from 'lucide-react';
import {
  formatDateSpanish,
  isActionOverdue,
  isActionDueSoon,
  isActionAssignedToUser,
  canUserEditAction,
  canUserDeleteAction,
} from '../utils/helpers';

interface PendingTasksViewProps {
  projects: SAPProject[];
  currentUser: UserSession;
  allUsers: UserSession[];
  onUpdateProject: (project: SAPProject) => void;
  onSelectProject: (project: SAPProject) => void;
  onOpenEditAction: (project: SAPProject, action: StageAction) => void;
  onPreviewFile?: (file: AttachedFile, projectTitle?: string) => void;
}

export const PendingTasksView: React.FC<PendingTasksViewProps> = ({
  projects,
  currentUser,
  allUsers,
  onUpdateProject,
  onSelectProject,
  onOpenEditAction,
  onPreviewFile,
}) => {
  // Selected user filter: defaults to 'my-tasks' (the currentUser)
  // Can be set to 'my-tasks', 'all', or a specific user's name
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('my-tasks');

  // Filters state
  const [statusFilter, setStatusFilter] = useState<'all-pending' | 'Pendiente' | 'En proceso' | 'overdue' | 'Finalizada'>('all-pending');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'urgency' | 'project' | 'date'>('urgency');

  // Quick feedback toast when an action is completed
  const [completedNotice, setCompletedNotice] = useState<string | null>(null);

  // Flatten all actions with their project context (excluding cancelled projects)
  const allTasksWithProject = useMemo(() => {
    const list: Array<{
      project: SAPProject;
      action: StageAction;
      isOverdue: boolean;
      isDueSoon: boolean;
      isAssignedToCurrentUser: boolean;
    }> = [];

    projects.forEach((p) => {
      // Don't show actions for cancelled projects
      const isCancelled =
        p.state.includes('Cancelado') ||
        p.state.startsWith('8-') ||
        p.state.startsWith('08-');
      if (isCancelled) return;

      p.actions.forEach((a) => {
        list.push({
          project: p,
          action: a,
          isOverdue: isActionOverdue(a),
          isDueSoon: isActionDueSoon(a),
          isAssignedToCurrentUser: isActionAssignedToUser(currentUser, a),
        });
      });
    });

    return list;
  }, [projects, currentUser]);

  // Tasks filtered by the selected user (My tasks, Specific user, or All)
  const userFilteredTasks = useMemo(() => {
    if (selectedUserFilter === 'my-tasks') {
      return allTasksWithProject.filter((t) => t.isAssignedToCurrentUser);
    }
    if (selectedUserFilter === 'all') {
      return allTasksWithProject;
    }
    // Specific user filter
    const targetUser = allUsers.find((u) => u.name === selectedUserFilter);
    if (targetUser) {
      return allTasksWithProject.filter((t) => isActionAssignedToUser(targetUser, t.action));
    }
    return allTasksWithProject.filter((t) =>
      t.action.responsible.toLowerCase().includes(selectedUserFilter.toLowerCase())
    );
  }, [allTasksWithProject, selectedUserFilter, allUsers]);

  // KPIs for the current user's tasks
  const kpis = useMemo(() => {
    const myTasks = allTasksWithProject.filter((t) => t.isAssignedToCurrentUser);
    const myPending = myTasks.filter((t) => t.action.status !== 'Finalizada');
    const myInProgress = myTasks.filter((t) => t.action.status === 'En proceso');
    const myOverdue = myPending.filter((t) => t.isOverdue);
    const myDueSoon = myPending.filter((t) => t.isDueSoon);
    const myCompleted = myTasks.filter((t) => t.action.status === 'Finalizada');

    return {
      totalPending: myPending.length,
      inProgress: myInProgress.length,
      overdue: myOverdue.length,
      dueSoon: myDueSoon.length,
      completed: myCompleted.length,
    };
  }, [allTasksWithProject]);

  // Apply search, area and status filters
  const filteredTasks = useMemo(() => {
    return userFilteredTasks.filter((item) => {
      // 1. Status Filter
      if (statusFilter === 'all-pending') {
        if (item.action.status === 'Finalizada') return false;
      } else if (statusFilter === 'overdue') {
        if (item.action.status === 'Finalizada' || !item.isOverdue) return false;
      } else if (statusFilter === 'Pendiente') {
        if (item.action.status !== 'Pendiente') return false;
      } else if (statusFilter === 'En proceso') {
        if (item.action.status !== 'En proceso') return false;
      } else if (statusFilter === 'Finalizada') {
        if (item.action.status !== 'Finalizada') return false;
      }

      // 2. Area Filter
      if (areaFilter !== 'all' && item.project.area !== areaFilter) {
        return false;
      }

      // 3. Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = item.action.title.toLowerCase().includes(q);
        const matchProjCode = item.project.code.toLowerCase().includes(q);
        const matchProjTitle = item.project.title.toLowerCase().includes(q);
        const matchResp = item.action.responsible.toLowerCase().includes(q);
        const matchStage = item.action.stageName.toLowerCase().includes(q);
        if (!matchTitle && !matchProjCode && !matchProjTitle && !matchResp && !matchStage) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'urgency') {
        // Overdue first, then due soon, then by requiredDate ascending
        if (a.action.status === 'Finalizada' && b.action.status !== 'Finalizada') return 1;
        if (a.action.status !== 'Finalizada' && b.action.status === 'Finalizada') return -1;
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return a.action.requiredDate.localeCompare(b.action.requiredDate);
      }
      if (sortBy === 'date') {
        return a.action.requiredDate.localeCompare(b.action.requiredDate);
      }
      // Project code sort
      return a.project.code.localeCompare(b.project.code);
    });
  }, [userFilteredTasks, statusFilter, areaFilter, searchTerm, sortBy]);

  // Handle Quick Status Change
  const handleQuickStatusChange = (
    project: SAPProject,
    action: StageAction,
    newStatus: ActionStatus
  ) => {
    if (!canUserEditAction(currentUser, action)) {
      alert(
        `Permiso denegado: Solo el responsable asignado (${action.responsible}) o el Administrador pueden modificar esta tarea.`
      );
      return;
    }

    const updatedActions = project.actions.map((act) => {
      if (act.id === action.id) {
        return {
          ...act,
          status: newStatus,
          completedAt: newStatus === 'Finalizada' ? new Date().toISOString() : act.completedAt,
        };
      }
      return act;
    });

    onUpdateProject({
      ...project,
      actions: updatedActions,
      updatedAt: new Date().toISOString(),
    });

    if (newStatus === 'Finalizada') {
      setCompletedNotice(`¡Tarea completada con éxito!`);
      setTimeout(() => setCompletedNotice(null), 3500);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Toast notice */}
      {completedNotice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-sm font-semibold">{completedNotice}</span>
        </div>
      )}

      {/* TOP USER WELCOME & SCOPE BANNER */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-500/20 shrink-0">
              <ListTodo className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">
                  {selectedUserFilter === 'my-tasks'
                    ? 'Mis Tareas Pendientes'
                    : selectedUserFilter === 'all'
                    ? 'Todas las Tareas del Equipo'
                    : `Tareas de ${selectedUserFilter}`}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    currentUser?.role === 'admin'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}
                >
                  {currentUser?.name || 'Usuario'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Seguimiento focalizado de compromisos, fechas límite y avances directos sobre los proyectos SAP.
              </p>
            </div>
          </div>

          {/* User selector dropdown (for Admin or switching user view) */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 shrink-0">
            <User className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-600">Ver tareas de:</span>
            <select
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="my-tasks">👤 Mis tareas ({currentUser?.name || 'Actual'})</option>
              <option value="all">👥 Todos los responsables ({allTasksWithProject.filter((t) => t.action.status !== 'Finalizada').length} pendientes)</option>
              <optgroup label="Filtrar por Responsable:">
                {allUsers.map((u) => (
                  <option key={u.name} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/70">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Pendientes
              </span>
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900">{kpis.totalPending}</span>
              <span className="text-[11px] text-slate-500 font-medium">asignadas a ti</span>
            </div>
          </div>

          <div className="bg-blue-50/50 rounded-xl p-3.5 border border-blue-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                En Proceso
              </span>
              <Sparkles className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-blue-700">{kpis.inProgress}</span>
              <span className="text-[11px] text-blue-600/80 font-medium">iniciadas</span>
            </div>
          </div>

          <div className={`rounded-xl p-3.5 border ${kpis.overdue > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200/70'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider ${kpis.overdue > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                Vencidas
              </span>
              <AlertTriangle className={`w-4 h-4 ${kpis.overdue > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-2xl font-black ${kpis.overdue > 0 ? 'text-rose-700' : 'text-slate-700'}`}>{kpis.overdue}</span>
              <span className="text-[11px] text-rose-600/80 font-medium">requieren atención</span>
            </div>
          </div>

          <div className="bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                Finalizadas
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-700">{kpis.completed}</span>
              <span className="text-[11px] text-emerald-600/80 font-medium">cumplidas</span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por descripción, código o título de proyecto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setStatusFilter('all-pending')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  statusFilter === 'all-pending'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todas Pendientes
              </button>
              <button
                onClick={() => setStatusFilter('Pendiente')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  statusFilter === 'Pendiente'
                    ? 'bg-white text-amber-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setStatusFilter('En proceso')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  statusFilter === 'En proceso'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                En Proceso
              </button>
              <button
                onClick={() => setStatusFilter('overdue')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  statusFilter === 'overdue'
                    ? 'bg-white text-rose-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Vencidas
              </button>
              <button
                onClick={() => setStatusFilter('Finalizada')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  statusFilter === 'Finalizada'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Finalizadas
              </button>
            </div>

            {/* Area Filter */}
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todas las Áreas</option>
              {SAP_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="urgency">Prioridad / Urgencia</option>
              <option value="date">Fecha límite</option>
              <option value="project">Código de Proyecto</option>
            </select>
          </div>
        </div>
      </div>

      {/* TASKS LIST */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {statusFilter === 'all-pending' && selectedUserFilter === 'my-tasks'
                ? '¡Estás al día!'
                : 'No se encontraron tareas'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {statusFilter === 'all-pending' && selectedUserFilter === 'my-tasks'
                ? 'No tienes tareas pendientes ni en proceso asignadas en este momento.'
                : 'No hay tareas que coincidan con los criterios de búsqueda o filtros seleccionados.'}
            </p>
            {(searchTerm || areaFilter !== 'all' || statusFilter !== 'all-pending') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setAreaFilter('all');
                  setStatusFilter('all-pending');
                }}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          filteredTasks.map(({ project, action, isOverdue, isDueSoon, isAssignedToCurrentUser }) => {
            const canEdit = canUserEditAction(currentUser, action);

            return (
              <div
                key={`${project.id}-${action.id}`}
                className={`bg-white rounded-xl border transition-all p-5 shadow-xs hover:border-slate-300 ${
                  action.status === 'Finalizada'
                    ? 'border-slate-200 opacity-80'
                    : isOverdue
                    ? 'border-rose-300 bg-rose-50/20'
                    : isDueSoon
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left Column: Project Reference & Task Details */}
                  <div className="flex-1 space-y-2">
                    {/* Project Header Tag Line */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <button
                        onClick={() => onSelectProject(project)}
                        className="inline-flex items-center gap-1 font-mono font-bold text-blue-700 hover:text-blue-900 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                        title="Abrir detalle completo del proyecto"
                      >
                        <span>{project.code}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>

                      <span className="font-semibold text-slate-800">
                        {project.title}
                      </span>

                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {project.area}
                      </span>

                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        Etapa actual: {project.state}
                      </span>
                    </div>

                    {/* Task Title / Description */}
                    <div className="flex items-start gap-3 pt-1">
                      {/* Quick check completion button */}
                      <button
                        disabled={!canEdit}
                        onClick={() =>
                          handleQuickStatusChange(
                            project,
                            action,
                            action.status === 'Finalizada' ? 'Pendiente' : 'Finalizada'
                          )
                        }
                        title={
                          !canEdit
                            ? 'Solo el responsable asignado puede modificar el estado'
                            : action.status === 'Finalizada'
                            ? 'Reabrir tarea como Pendiente'
                            : 'Marcar tarea como Finalizada'
                        }
                        className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                          action.status === 'Finalizada'
                            ? 'bg-emerald-600 text-white'
                            : 'border-2 border-slate-300 hover:border-blue-500 bg-white'
                        } ${!canEdit ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      >
                        {action.status === 'Finalizada' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      <div className="space-y-1 flex-1">
                        <h4
                          className={`text-sm font-bold text-slate-900 leading-snug ${
                            action.status === 'Finalizada' ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {action.title}
                        </h4>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span className="font-medium text-slate-600">
                            Etapa: <strong className="text-slate-800">{action.stageName}</strong>
                          </span>

                          <span className="flex items-center gap-1 text-slate-600">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{action.responsible}</span>
                            {isAssignedToCurrentUser && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-blue-100 text-blue-800 font-semibold">
                                Tú
                              </span>
                            )}
                          </span>

                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                            Creada por: <strong className="text-slate-700">{action.createdBy || action.responsible}</strong>
                          </span>

                          {action.attachments && action.attachments.length > 0 && (
                            <span className="flex items-center gap-1 text-blue-600 font-medium">
                              <Paperclip className="w-3.5 h-3.5" />
                              <span>{action.attachments.length} adjunto(s)</span>
                            </span>
                          )}

                          {action.commentsHistory && action.commentsHistory.length > 0 && (
                            <span className="flex items-center gap-1 text-slate-500 font-medium">
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>{action.commentsHistory.length} comentario(s)</span>
                            </span>
                          )}
                        </div>

                        {/* Direct Attachment Chips with Preview & Download */}
                        {action.attachments && action.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100">
                            {action.attachments.map((att) => (
                              <div
                                key={att.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100/80 text-slate-700 border border-slate-200 text-[11px] font-medium transition-colors"
                              >
                                <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onPreviewFile) {
                                      onPreviewFile(att, project.title);
                                    }
                                  }}
                                  className="hover:underline hover:text-blue-700 truncate max-w-[130px] text-left"
                                  title={`Ver vista previa de ${att.name}`}
                                >
                                  {att.name}
                                </button>
                                {onPreviewFile && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPreviewFile(att, project.title);
                                    }}
                                    className="p-0.5 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                    title="Previsualizar archivo"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                )}
                                <a
                                  href={att.dataUrl}
                                  download={att.name}
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-0.5 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                  title={`Descargar ${att.name}`}
                                >
                                  <Download className="w-3 h-3" />
                                </a>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Last execution comment */}
                        {action.executionComment && (
                          <div className="mt-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700 flex items-start gap-2">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-semibold text-slate-800">Último avance registrado: </span>
                              <span>{action.executionComment}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Due Date, Status Badges & Direct Actions */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Due Date & Urgency Badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 text-xs text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Límite: <strong>{formatDateSpanish(action.requiredDate)}</strong></span>
                      </div>

                      {action.status === 'Finalizada' ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Finalizada
                        </span>
                      ) : isOverdue ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Vencida
                        </span>
                      ) : isDueSoon ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" /> Próxima a vencer
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          En término
                        </span>
                      )}
                    </div>

                    {/* Status inline dropdown and edit button */}
                    <div className="flex items-center gap-2">
                      <select
                        disabled={!canEdit}
                        value={action.status}
                        onChange={(e) =>
                          handleQuickStatusChange(
                            project,
                            action,
                            e.target.value as ActionStatus
                          )
                        }
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
                          action.status === 'Finalizada'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : action.status === 'En proceso'
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En proceso">En proceso</option>
                        <option value="Finalizada">Finalizada</option>
                      </select>

                      {/* Edit / Comment Button */}
                      <button
                        onClick={() => onOpenEditAction(project, action)}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        title="Registrar avance, comentarios o subir adjuntos"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                        <span>Avance</span>
                      </button>

                      {/* Delete Action Button (PMO or Project Creator) */}
                      {canUserDeleteAction(currentUser, action, project) && (
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Está seguro de eliminar la acción "${action.title}"? Solo el PMO o quien creó el proyecto pueden eliminar acciones.`)) {
                              const updatedActions = project.actions.filter((a) => a.id !== action.id);
                              onUpdateProject({
                                ...project,
                                actions: updatedActions,
                                updatedAt: new Date().toISOString(),
                              });
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Eliminar tarea (PMO o quien dio de alta el proyecto)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Eliminar</span>
                        </button>
                      )}

                      {/* View Project Button */}
                      <button
                        onClick={() => onSelectProject(project)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors"
                        title="Ver proyecto completo"
                      >
                        <FolderKanban className="w-3.5 h-3.5 text-blue-600" />
                        <span className="hidden sm:inline">Proyecto</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

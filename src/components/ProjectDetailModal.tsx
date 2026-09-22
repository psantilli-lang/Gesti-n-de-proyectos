import React, { useState } from 'react';
import { 
  SAPProject, 
  UserSession, 
  StageSchedule, 
  StageAction, 
  ALL_PROJECT_STATES, 
  ProjectState, 
  SAP_MODULES_DATA,
  AttachedFile 
} from '../types/project';
import { storageService } from '../services/storageService';
import { 
  formatDateSpanish, 
  formatFileSize, 
  canUserEditAction, 
  canUserEditProjectMetadata, 
  canUserAddAction,
  canUserDeleteAction,
  canUserCancelProject,
  canUserAccessReportingAndPrioritization,
  isPMO,
  isActionOverdue, 
  isActionDueSoon 
} from '../utils/helpers';
import { 
  X, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  MessageSquare, 
  FileText, 
  Paperclip, 
  Upload, 
  Download, 
  Trash2, 
  Users, 
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Edit,
  Tag,
  Check,
  Eye
} from 'lucide-react';

interface ProjectDetailModalProps {
  project: SAPProject;
  currentUser: UserSession;
  onClose: () => void;
  onUpdateProject: (project: SAPProject) => void;
  onOpenAddAction: (project: SAPProject, defaultStageId?: number) => void;
  onOpenEditAction: (project: SAPProject, action: StageAction) => void;
  onPreviewFile?: (file: AttachedFile, projectTitle?: string) => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  currentUser,
  onClose,
  onUpdateProject,
  onOpenAddAction,
  onOpenEditAction,
  onPreviewFile,
}) => {
  const [activeTab, setActiveTab] = useState<'diagnosis' | 'schedule' | 'actions'>('schedule');
  const [selectedStageFilter, setSelectedStageFilter] = useState<number | 'all'>('all');

  const health = storageService.getProjectHealth(project);
  const canEditMetadata = canUserEditProjectMetadata(currentUser, project);
  const canCancel = canUserCancelProject(currentUser, project);
  const canAddAction = canUserAddAction(currentUser, project);
  const canPrioritize = canUserAccessReportingAndPrioritization(currentUser);

  // Update project state with security enforcement
  const handleStateChange = (newState: ProjectState) => {
    if (newState === '8- Cancelado' || newState === '08- Cancelado') {
      if (!canCancel) {
        alert(
          'Permiso denegado: El cambio de estado a "8- Cancelado" es una actividad exclusiva del rol PMO.'
        );
        return;
      }
    }

    onUpdateProject({
      ...project,
      state: newState,
      updatedAt: new Date().toISOString(),
    });
  };

  // Register real actual end date for a stage
  const handleSetActualEndDate = (stageId: number, dateStr: string) => {
    const updatedSchedule = project.schedule.map((st) => {
      if (st.stageId === stageId) {
        return {
          ...st,
          actualEndDate: dateStr || undefined,
          status: dateStr ? ('Completada' as const) : ('En curso' as const),
        };
      }
      return st;
    });

    onUpdateProject({
      ...project,
      schedule: updatedSchedule,
      updatedAt: new Date().toISOString(),
    });
  };

  // File upload simulation (using real file reading to dataUrl)
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    targetSection: 'currentSituation' | 'improvementNeed'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const newAttachment: AttachedFile = {
        id: `att-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString().split('T')[0],
        dataUrl: reader.result as string,
      };

      if (targetSection === 'currentSituation') {
        onUpdateProject({
          ...project,
          currentSituationFiles: [...(project.currentSituationFiles || []), newAttachment],
          updatedAt: new Date().toISOString(),
        });
      } else {
        onUpdateProject({
          ...project,
          improvementNeedFiles: [...(project.improvementNeedFiles || []), newAttachment],
          updatedAt: new Date().toISOString(),
        });
      }
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveFile = (targetSection: 'currentSituation' | 'improvementNeed', fileId: string) => {
    if (targetSection === 'currentSituation') {
      onUpdateProject({
        ...project,
        currentSituationFiles: project.currentSituationFiles.filter((f) => f.id !== fileId),
        updatedAt: new Date().toISOString(),
      });
    } else {
      onUpdateProject({
        ...project,
        improvementNeedFiles: project.improvementNeedFiles.filter((f) => f.id !== fileId),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Filter actions by stage
  const filteredActions = project.actions.filter((a) => {
    if (selectedStageFilter === 'all') return true;
    return a.stageId === selectedStageFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col gap-4 border-b border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                  {project.code}
                </span>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-blue-900 text-blue-200 border border-blue-700">
                  <span>Prioridad #</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    disabled={!canPrioritize}
                    value={project.priority ?? 1}
                    onChange={(e) => {
                      if (!canPrioritize) return;
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1) {
                        onUpdateProject({
                          ...project,
                          priority: val,
                          updatedAt: new Date().toISOString(),
                        });
                      }
                    }}
                    className={`w-10 text-center font-black text-xs rounded border py-0.5 px-0.5 focus:outline-none transition-colors ${
                      canPrioritize
                        ? 'text-amber-300 bg-blue-950/90 border-blue-600 focus:border-amber-400 cursor-pointer'
                        : 'text-slate-400 bg-blue-950/40 border-blue-900 cursor-not-allowed opacity-80'
                    }`}
                    title={
                      canPrioritize
                        ? 'Prioridad manual (PMO)'
                        : 'Prioridad del proyecto (Actividad exclusiva del PMO)'
                    }
                  />
                  <span>en {project.area}</span>
                </div>

                {/* SAP Module badges */}
                <div className="flex items-center gap-1 flex-wrap">
                  {project.sapModules.map((mod) => (
                    <span
                      key={mod}
                      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-white border border-white/20"
                    >
                      {mod}
                    </span>
                  ))}
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                {project.title}
              </h2>
              <p className="text-xs text-slate-300">
                Creado por: <strong className="text-white">{project.createdBy || 'Administrador General'}</strong>
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick status controls in header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold">Estado del Proyecto:</span>
              <select
                value={project.state}
                onChange={(e) => handleStateChange(e.target.value as ProjectState)}
                className="bg-slate-800 border border-slate-700 text-white font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-xs"
                title="Cambiar estado del proyecto"
              >
                {ALL_PROJECT_STATES.map((st) => {
                  const isCancel = st === '8- Cancelado';
                  const disabledOpt = isCancel && !canCancel;
                  return (
                    <option key={st} value={st} disabled={disabledOpt}>
                      {st} {disabledOpt ? ' (Solo PMO)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-center gap-3 text-slate-300">
              <span className="flex items-center gap-1">
                <strong>{health.completionPercentage}%</strong> completado
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-300">
                <Clock className="w-3.5 h-3.5" />
                <strong>{health.pendingActionsCount}</strong> acciones pendientes
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 px-6 border-b border-slate-200 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'schedule'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Cronograma Plan vs. Actual ({project.schedule.length} Etapas)</span>
          </button>

          <button
            onClick={() => setActiveTab('actions')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'actions'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Acciones y Responsables ({project.actions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('diagnosis')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'diagnosis'
                ? 'border-blue-600 text-blue-700 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 text-slate-600" />
            <span>Situación Actual, Mejora & Adjuntos</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: SCHEDULE PLAN VS ACTUAL */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900">
                <div>
                  <h4 className="font-bold text-sm text-blue-950">
                    Seguimiento de Duración por Etapa (Plan vs. Real)
                  </h4>
                  <p className="text-blue-800 mt-0.5">
                    Las fechas estimadas se cargan al dar de alta el proyecto. Al finalizar cada etapa, registrá la fecha real para calcular automáticamente el desvío.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-white border border-blue-200 font-bold text-blue-800">
                    {project.schedule.filter((s) => s.status === 'Completada').length} de 7 completadas
                  </span>
                </div>
              </div>

              {/* Stages Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Etapa</th>
                        <th className="py-3 px-4">Plan Inicio</th>
                        <th className="py-3 px-4">Plan Fin Estimado</th>
                        <th className="py-3 px-4">Fecha Real Finalización</th>
                        <th className="py-3 px-4">Cumplimiento (Plan vs Actual)</th>
                        <th className="py-3 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {project.schedule.map((stage) => {
                        const dev = storageService.calculateStageDeviation(stage);
                        const stageActions = project.actions.filter((a) => a.stageId === stage.stageId);
                        const isStageActive =
                          project.state === stage.stageName ||
                          project.state.startsWith(stage.stageName.slice(0, 3));

                        return (
                          <tr
                            key={stage.stageId}
                            className={`transition-colors ${
                              isStageActive ? 'bg-blue-50/50 font-medium' : 'hover:bg-slate-50/50'
                            }`}
                          >
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {stage.stageName.split('-')[0] || `0${stage.stageId}`}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-900 block">{stage.stageName}</span>
                              {isStageActive && (
                                <span className="inline-block mt-0.5 text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">
                                  Etapa Activa
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono">
                              {formatDateSpanish(stage.estimatedStartDate)}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono">
                              {formatDateSpanish(stage.estimatedEndDate)}
                            </td>
                            <td className="py-3 px-4">
                              {/* Actual End Date picker / button */}
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="date"
                                  value={stage.actualEndDate || ''}
                                  onChange={(e) => handleSetActualEndDate(stage.stageId, e.target.value)}
                                  className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                />
                                {!stage.actualEndDate && (
                                  <button
                                    onClick={() =>
                                      handleSetActualEndDate(
                                        stage.stageId,
                                        new Date().toISOString().split('T')[0]
                                      )
                                    }
                                    title="Marcar completada hoy"
                                    className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[11px] font-semibold border border-emerald-200 transition-colors whitespace-nowrap"
                                  >
                                    Hoy
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {/* Deviation indicator */}
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  dev.isCompleted
                                    ? dev.isDelayed
                                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : dev.isDelayed
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {dev.isCompleted && !dev.isDelayed && <Check className="w-3 h-3 text-emerald-700" />}
                                {dev.isDelayed && <AlertCircle className="w-3 h-3 text-rose-700" />}
                                {dev.statusLabel}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => {
                                  setSelectedStageFilter(stage.stageId);
                                  setActiveTab('actions');
                                }}
                                className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] underline"
                              >
                                {stageActions.length} acciones
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACTIONS PER STAGE */}
          {activeTab === 'actions' && (
            <div className="space-y-6">
              {/* Filter and Add Action Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700">Filtrar por etapa:</label>
                  <select
                    value={selectedStageFilter}
                    onChange={(e) =>
                      setSelectedStageFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                    }
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">Todas las Etapas ({project.actions.length} acciones)</option>
                    {project.schedule.map((st) => (
                      <option key={st.stageId} value={st.stageId}>
                        {st.stageName}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  disabled={!canAddAction}
                  onClick={() => onOpenAddAction(project)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs ${
                    canAddAction
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                  }`}
                  title={!canAddAction ? 'Solo los miembros del equipo del proyecto o Admin pueden agregar acciones' : undefined}
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    Agregar Acción (Etapa actual: {project.state.split('-')[0]})
                    {!canAddAction && ' - Solo miembros'}
                  </span>
                </button>
              </div>

              {/* Actions List */}
              {filteredActions.length === 0 ? (
                <div className="p-12 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
                  <CheckCircle2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">
                    No hay acciones cargadas para esta etapa
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Cargá tareas requeridas indicando fecha límite y la persona responsable.
                  </p>
                  {canAddAction && (
                    <button
                      onClick={() =>
                        onOpenAddAction(
                          project,
                          selectedStageFilter !== 'all' ? selectedStageFilter : undefined
                        )
                      }
                      className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Agregar Acción
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredActions.map((action) => {
                    const canEdit = canUserEditAction(currentUser, action);
                    const canDeleteAct = canUserDeleteAction(currentUser, action, project);
                    const isOverdue = isActionOverdue(action);

                    return (
                      <div
                        key={action.id}
                        className={`p-4 rounded-xl border transition-all ${
                          action.status === 'Finalizada'
                            ? 'bg-slate-50 border-slate-200'
                            : isOverdue
                            ? 'bg-rose-50/40 border-rose-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Status Badge */}
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-bold ${
                                  action.status === 'Finalizada'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : action.status === 'En proceso'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {action.status}
                              </span>

                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {action.stageName}
                              </span>

                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 ${
                                  isOverdue && action.status !== 'Finalizada'
                                    ? 'bg-rose-100 text-rose-800 font-bold'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                Requerida: {formatDateSpanish(action.requiredDate)}
                                {isOverdue && action.status !== 'Finalizada' && ' (Vencida)'}
                              </span>

                              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                <Users className="w-3 h-3 text-slate-500" />
                                Responsable: {action.responsible}
                              </span>

                              <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                Creada por: <strong>{action.createdBy || action.responsible}</strong>
                              </span>
                            </div>

                            <p className="text-sm font-bold text-slate-900">
                              {action.title}
                            </p>

                            {/* Execution comment block */}
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-xs">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                Comentario de avance y acción tomada:
                              </span>
                              {action.executionComment ? (
                                <p className="text-slate-800 italic leading-relaxed">
                                  "{action.executionComment}"
                                </p>
                              ) : (
                                <p className="text-slate-400 italic">
                                  Sin comentarios registrados aún.
                                </p>
                              )}

                              {/* Attached files on action */}
                              {action.attachments && action.attachments.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                    <Paperclip className="w-3 h-3 text-blue-600" />
                                    Adjuntos ({action.attachments.length}):
                                  </span>
                                  {action.attachments.map((att) => (
                                    <div
                                      key={att.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white hover:bg-slate-50 text-blue-700 border border-slate-200 text-[11px] font-medium transition-colors shadow-2xs"
                                    >
                                      <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (onPreviewFile) {
                                            onPreviewFile(att, project.title);
                                          }
                                        }}
                                        className="hover:underline hover:text-blue-900 truncate max-w-[140px] text-left"
                                        title={`Ver vista previa de ${att.name}`}
                                      >
                                        {att.name}
                                      </button>
                                      {onPreviewFile && (
                                        <button
                                          type="button"
                                          onClick={() => onPreviewFile(att, project.title)}
                                          className="p-0.5 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                          title="Previsualizar archivo"
                                        >
                                          <Eye className="w-3 h-3" />
                                        </button>
                                      )}
                                      <a
                                        href={att.dataUrl}
                                        download={att.name}
                                        className="p-0.5 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                        title={`Descargar ${att.name}`}
                                      >
                                        <Download className="w-3 h-3" />
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action update and delete buttons */}
                          <div className="flex flex-col items-end gap-1.5">
                            <button
                              onClick={() => onOpenEditAction(project, action)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                                canEdit
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>{canEdit ? 'Editar Estado / Comentario' : 'Ver Comentario'}</span>
                            </button>

                            {canDeleteAct && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`¿Está seguro de eliminar la acción "${action.title}"? Solo el PMO o quien dio de alta el proyecto pueden eliminarla.`)) {
                                    const updatedActions = project.actions.filter((a) => a.id !== action.id);
                                    onUpdateProject({
                                      ...project,
                                      actions: updatedActions,
                                      updatedAt: new Date().toISOString(),
                                    });
                                  }
                                }}
                                className="px-2.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200 flex items-center gap-1 text-[11px] font-medium"
                                title="Eliminar acción (Solo PMO o quien dio de alta el proyecto)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Eliminar Acción</span>
                              </button>
                            )}

                            {!canEdit && !canDeleteAct && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3 text-slate-400" />
                                Solo {action.responsible} o PMO
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIAGNOSIS, SITUATION, IMPROVEMENT NEED & ATTACHMENTS */}
          {activeTab === 'diagnosis' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Situación Actual */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Situación Actual (Diagnóstico)
                    </h4>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {(project.currentSituationFiles || []).length} archivos
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-white p-3.5 rounded-lg border border-slate-200">
                    {project.currentSituation || 'Sin descripción cargada.'}
                  </p>

                  {/* Attached Files for Current Situation */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Archivos Adjuntos:</span>
                      {canEditMetadata ? (
                        <label className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Adjuntar archivo</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, 'currentSituation')}
                          />
                        </label>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Solo PMO o Creador pueden adjuntar</span>
                      )}
                    </div>

                    {(project.currentSituationFiles || []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No se han adjuntado archivos.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {project.currentSituationFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Paperclip className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="font-medium text-slate-800 truncate" title={file.name}>
                                {file.name}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ({formatFileSize(file.size)})
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {file.dataUrl && (
                                <>
                                  {onPreviewFile && (
                                    <button
                                      type="button"
                                      onClick={() => onPreviewFile(file, project.title)}
                                      className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                      title="Previsualizar archivo"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <a
                                    href={file.dataUrl}
                                    download={file.name}
                                    className="p-1 text-slate-500 hover:text-blue-600 rounded transition-colors"
                                    title="Descargar"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                </>
                              )}
                              {canEditMetadata && (
                                <button
                                  onClick={() => handleRemoveFile('currentSituation', file.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                  title="Eliminar adjunto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Necesidad de Mejora */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-600" />
                      Necesidad de Mejora (Objetivo)
                    </h4>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {(project.improvementNeedFiles || []).length} archivos
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-white p-3.5 rounded-lg border border-slate-200">
                    {project.improvementNeed || 'Sin descripción cargada.'}
                  </p>

                  {/* Attached Files for Improvement Need */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Archivos Adjuntos:</span>
                      {canEditMetadata ? (
                        <label className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Adjuntar archivo</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, 'improvementNeed')}
                          />
                        </label>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Solo PMO o Creador pueden adjuntar</span>
                      )}
                    </div>

                    {(project.improvementNeedFiles || []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No se han adjuntado archivos.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {project.improvementNeedFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <Paperclip className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="font-medium text-slate-800 truncate" title={file.name}>
                                {file.name}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ({formatFileSize(file.size)})
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {file.dataUrl && (
                                <>
                                  {onPreviewFile && (
                                    <button
                                      type="button"
                                      onClick={() => onPreviewFile(file, project.title)}
                                      className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                      title="Previsualizar archivo"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <a
                                    href={file.dataUrl}
                                    download={file.name}
                                    className="p-1 text-slate-500 hover:text-blue-600 rounded transition-colors"
                                    title="Descargar"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                </>
                              )}
                              {canEditMetadata && (
                                <button
                                  onClick={() => handleRemoveFile('improvementNeed', file.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                  title="Eliminar adjunto"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Equipo del Proyecto */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Equipo de Proyecto
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {project.team.map((member) => (
                    <div
                      key={member.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          {member.name}
                        </span>
                        <span className="text-[11px] text-slate-500 block truncate">
                          {member.role}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-mono">
            Última actualización: {new Date(project.updatedAt || project.createdAt).toLocaleDateString()}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg text-xs transition-colors"
          >
            Cerrar Ficha
          </button>
        </div>

      </div>
    </div>
  );
};

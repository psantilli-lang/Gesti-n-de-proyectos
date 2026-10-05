import React from 'react';
import { 
  SAPProject, 
  StageAction, 
  UserSession, 
  ALL_PROJECT_STATES, 
  ProjectState, 
  AttachedFile,
  ActionStatus 
} from '../types/project';
import { 
  formatDateSpanish, 
  canUserEditAction, 
  canUserAddAction,
  canUserCancelProject,
  canUserAccessReportingAndPrioritization,
  isActionOverdue,
  isActionDueSoon
} from '../utils/helpers';
import { 
  ExternalLink, 
  Plus, 
  MessageSquare, 
  Clock, 
  User, 
  Paperclip,
  Edit3,
} from 'lucide-react';

interface WeeklyReviewTableProps {
  projects: SAPProject[];
  currentUser: UserSession;
  onUpdateProject: (project: SAPProject) => void;
  onSelectProject: (project: SAPProject) => void;
  onOpenAddAction: (project: SAPProject) => void;
  onOpenEditAction: (project: SAPProject, action: StageAction) => void;
  onPreviewFile?: (file: AttachedFile, projectTitle?: string) => void;
  onStateChange: (project: SAPProject, newState: ProjectState) => void;
  onPriorityChange: (project: SAPProject, newPriority: number) => void;
  onActionStatusChange: (project: SAPProject, action: StageAction, newStatus: ActionStatus) => void;
}

export const WeeklyReviewTable: React.FC<WeeklyReviewTableProps> = ({
  projects,
  currentUser,
  onUpdateProject,
  onSelectProject,
  onOpenAddAction,
  onOpenEditAction,
  onPreviewFile,
  onStateChange,
  onPriorityChange,
  onActionStatusChange,
}) => {
  const canPrioritize = canUserAccessReportingAndPrioritization(currentUser);

  if (projects.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
        No hay proyectos que coincidan con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-800 text-white font-semibold text-[10.5px] uppercase tracking-wider select-none">
              {/* 1. N° Proyecto */}
              <th className="py-2.5 px-1.5 text-center w-[68px] min-w-[64px] border-r border-slate-700">N° Proy.</th>
              {/* 2. Prioridad */}
              <th className="py-2.5 px-1 text-center w-[38px] min-w-[36px] border-r border-slate-700">Prio.</th>
              {/* 3. Título del Proyecto */}
              <th className="py-2.5 px-2 w-[14%] min-w-[110px] border-r border-slate-700">Título Proyecto</th>
              {/* 4. Área */}
              <th className="py-2.5 px-1.5 text-center w-[76px] min-w-[72px] border-r border-slate-700">Área</th>
              {/* 5. Estado Proyecto */}
              <th className="py-2.5 px-1.5 w-[118px] min-w-[115px] border-r border-slate-700">Estado Proy.</th>
              {/* 6. Acción Pendiente */}
              <th className="py-2.5 px-2 w-[13%] min-w-[95px] border-r border-slate-700">Acción Pendiente</th>
              {/* 7. Responsable */}
              <th className="py-2.5 px-1.5 w-[92px] min-w-[88px] border-r border-slate-700">Responsable</th>
              {/* 8. Vencimiento */}
              <th className="py-2.5 px-1 text-center w-[76px] min-w-[72px] border-r border-slate-700">Vencimiento</th>
              {/* 9. Estado Acción */}
              <th className="py-2.5 px-1.5 text-center w-[124px] min-w-[122px] border-r border-slate-700">Estado Acción</th>
              {/* 10. Comentario / Avance */}
              <th className="py-2.5 px-2 w-[14%] min-w-[105px] border-r border-slate-700">Comentario / Avance</th>
              {/* 11. Operaciones */}
              <th className="py-2.5 px-1 text-center w-[46px] min-w-[44px]">Acción</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {projects.map((project, pIndex) => {
              // Get active (pending or in process) actions
              const activeActions = project.actions.filter(
                (a) => a.status === 'Pendiente' || a.status === 'En proceso'
              );

              // If project has no active actions, display 1 row with empty action columns
              const rowsToRender = activeActions.length > 0 ? activeActions : [null];
              const spanCount = rowsToRender.length;
              const isEvenProject = pIndex % 2 === 0;
              const projectBgClass = isEvenProject ? 'bg-white' : 'bg-slate-50/70';
              const canAdd = canUserAddAction(currentUser, project);

              return rowsToRender.map((action, actionIdx) => {
                const isFirstRowOfProject = actionIdx === 0;
                const canEditAct = action ? canUserEditAction(currentUser, action) : false;
                const isOverdue = action ? isActionOverdue(action) : false;
                const isDueSoon = action ? isActionDueSoon(action) : false;

                return (
                  <tr
                    key={action ? `${project.id}-${action.id}` : `${project.id}-empty`}
                    className={`${projectBgClass} hover:bg-blue-50/30 transition-colors ${
                      isFirstRowOfProject && pIndex > 0 ? 'border-t-2 border-slate-300' : 'border-t border-slate-200'
                    }`}
                  >
                    {/* 1. N° Proyecto (Primera columna, concatenada / unificada con rowSpan) */}
                    {isFirstRowOfProject && (
                      <td 
                        rowSpan={spanCount}
                        className={`${projectBgClass} py-2 px-1.5 text-center border-r border-slate-200 align-top`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectProject(project)}
                          className="inline-flex items-center justify-center gap-1 font-mono text-[11px] font-black text-blue-700 hover:text-blue-900 hover:underline bg-blue-50 hover:bg-blue-100 px-1.5 py-1 rounded border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                          title="Hacé clic para ver la ficha técnica completa y el cronograma"
                        >
                          <span>{project.code}</span>
                          <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
                        </button>
                      </td>
                    )}

                    {/* 2. Prioridad (Concatenada / unificada con rowSpan) */}
                    {isFirstRowOfProject && (
                      <td 
                        rowSpan={spanCount}
                        className={`${projectBgClass} py-2 px-1 text-center border-r border-slate-200 align-top`}
                      >
                        <div className="flex items-center justify-center">
                          <input
                            type="number"
                            min="1"
                            max="99"
                            disabled={!canPrioritize}
                            value={project.priority ?? 1}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val >= 1) {
                                onPriorityChange(project, val);
                              }
                            }}
                            className={`w-9 text-center font-black text-[11px] rounded border py-1 px-0.5 focus:outline-none transition-colors ${
                              canPrioritize
                                ? 'text-blue-800 bg-white hover:bg-blue-50 focus:border-blue-500 border-slate-300 shadow-2xs cursor-pointer'
                                : 'text-slate-600 bg-slate-100 border-slate-200 cursor-not-allowed opacity-80'
                            }`}
                            title={
                              canPrioritize
                                ? 'Prioridad del proyecto (PMO)'
                                : 'Prioridad (Solo PMO)'
                            }
                          />
                        </div>
                      </td>
                    )}

                    {/* 3. Título del Proyecto (Concatenado / unificado con rowSpan) */}
                    {isFirstRowOfProject && (
                      <td 
                        rowSpan={spanCount}
                        className={`${projectBgClass} py-2 px-2.5 border-r border-slate-200 align-top`}
                      >
                        <div>
                          <button
                            type="button"
                            onClick={() => onSelectProject(project)}
                            className="font-bold text-slate-900 hover:text-blue-600 text-left text-xs leading-snug transition-colors cursor-pointer block line-clamp-2"
                            title="Ver detalle del proyecto"
                          >
                            {project.title}
                          </button>
                          {project.sapModules && project.sapModules.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {project.sapModules.map((m) => (
                                <span
                                  key={m}
                                  className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    )}

                    {/* 4. Área (Concatenada / unificada con rowSpan) */}
                    {isFirstRowOfProject && (
                      <td 
                        rowSpan={spanCount}
                        className={`${projectBgClass} py-2 px-1.5 border-r border-slate-200 align-top`}
                      >
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-white text-slate-800 border border-slate-200 whitespace-nowrap shadow-2xs">
                          {project.area}
                        </span>
                      </td>
                    )}

                    {/* 5. Estado Proyecto (Concatenado / unificado con rowSpan, no se duplica) */}
                    {isFirstRowOfProject && (
                      <td 
                        rowSpan={spanCount}
                        className={`${projectBgClass} py-2 px-1.5 border-r border-slate-200 align-top`}
                      >
                        <select
                          value={project.state}
                          onChange={(e) => onStateChange(project, e.target.value as ProjectState)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-[11px] font-semibold text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                          title="Cambiar estado del proyecto"
                        >
                          {ALL_PROJECT_STATES.map((st) => {
                            const isCancel = st === '8- Cancelado' || st === '08- Cancelado';
                            const disabledOpt = isCancel && !canUserCancelProject(currentUser, project);
                            return (
                              <option key={st} value={st} disabled={disabledOpt}>
                                {st} {disabledOpt ? ' (Solo PMO)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                    )}

                    {/* 6. Acción Pendiente (o celda vacía para agregar) */}
                    <td className="py-2 px-2 border-r border-slate-200 align-top">
                      {action ? (
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1 group">
                            <span 
                              onClick={() => canEditAct && onOpenEditAction(project, action)}
                              className={`font-semibold text-slate-900 block text-[11px] leading-snug break-words whitespace-normal ${
                                canEditAct ? 'hover:text-blue-700 cursor-pointer' : ''
                              }`} 
                              title={canEditAct ? 'Hacé clic para editar la acción o corregir faltas ortográficas' : action.title}
                            >
                              {action.title}
                            </span>
                            {canEditAct && (
                              <button
                                type="button"
                                onClick={() => onOpenEditAction(project, action)}
                                className="p-0.5 text-slate-400 hover:text-blue-600 rounded transition-colors shrink-0 opacity-60 hover:opacity-100 cursor-pointer"
                                title="Editar texto de la acción / corregir ortografía"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-slate-400 italic text-[11px] py-0.5">
                          <span>— Sin pendientes —</span>
                          <button
                            type="button"
                            disabled={!canAdd}
                            onClick={() => onOpenAddAction(project)}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                              canAdd
                                ? 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer'
                                : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed opacity-60'
                            }`}
                            title={canAdd ? 'Agregar acción a este proyecto' : 'Solo miembros del proyecto o PMO'}
                          >
                            <Plus className="w-3 h-3" />
                            <span>Agregar</span>
                          </button>
                        </div>
                      )}
                    </td>

                    {/* 7. Responsable */}
                    <td className="py-2 px-1.5 border-r border-slate-200 align-top">
                      {action ? (
                        <span className="inline-flex items-center gap-1 text-slate-700 font-semibold text-[10.5px]" title={action.responsible}>
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[74px]">
                            {action.responsible}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-300 text-center block">—</span>
                      )}
                    </td>

                    {/* 8. Vencimiento */}
                    <td className="py-2 px-1.5 text-center border-r border-slate-200 align-top">
                      {action ? (
                        <div
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium text-[10.5px] ${
                            isOverdue
                              ? 'bg-rose-100 text-rose-800 font-bold border border-rose-200'
                              : isDueSoon
                              ? 'bg-amber-100 text-amber-800 font-semibold border border-amber-200'
                              : 'text-slate-700 bg-slate-100/70 border border-slate-200'
                          }`}
                          title={isOverdue ? 'Acción vencida' : isDueSoon ? 'Vence pronto' : 'Fecha límite'}
                        >
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          <span className="whitespace-nowrap font-mono">{formatDateSpanish(action.requiredDate)}</span>
                          {isOverdue && <span className="text-[10px] text-rose-600 font-bold">!</span>}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-center block">—</span>
                      )}
                    </td>

                    {/* 9. Estado Acción (Desplegable para evitar clics accidentales) */}
                    <td className="py-2 px-1.5 text-center border-r border-slate-200 align-top">
                      {action ? (
                        <select
                          value={action.status}
                          disabled={!canEditAct}
                          onChange={(e) => onActionStatusChange(project, action, e.target.value as ActionStatus)}
                          className={`w-full text-[10.5px] font-bold rounded px-1.5 py-1 border shadow-2xs cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            action.status === 'Finalizada'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : action.status === 'En proceso'
                              ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                              : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                          } ${!canEditAct ? 'opacity-70 cursor-not-allowed' : ''}`}
                          title={
                            canEditAct
                              ? `Cambiar estado de la acción`
                              : `Solo ${action.responsible} o Admin pueden editar`
                          }
                        >
                          <option value="Pendiente" className="bg-white text-slate-800 font-semibold">
                            Pendiente
                          </option>
                          <option value="En proceso" className="bg-white text-slate-800 font-semibold">
                            En proceso
                          </option>
                          <option value="Finalizada" className="bg-white text-slate-800 font-semibold">
                            Finalizada
                          </option>
                        </select>
                      ) : (
                        <span className="text-slate-300 text-center block">—</span>
                      )}
                    </td>

                    {/* 10. Comentario / Avance */}
                    <td className="py-2 px-2.5 border-r border-slate-200 align-top">
                      {action ? (
                        <div className="space-y-1">
                          {action.executionComment ? (
                            <p className="text-[10.5px] text-slate-800 italic leading-snug line-clamp-2" title={action.executionComment}>
                              "{action.executionComment}"
                            </p>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic block">
                              Sin comentarios.
                            </span>
                          )}

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenEditAction(project, action)}
                              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              <MessageSquare className="w-2.5 h-2.5" />
                              <span>{canEditAct ? 'Comentar' : 'Ver'}</span>
                            </button>

                            {action.attachments && action.attachments.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (onPreviewFile && action.attachments?.[0]) {
                                    onPreviewFile(action.attachments[0], project.title);
                                  }
                                }}
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-1 py-0.2 rounded cursor-pointer transition-colors"
                                title={`${action.attachments.length} archivo(s) adjunto(s)`}
                              >
                                <Paperclip className="w-2.5 h-2.5 text-blue-600" />
                                <span>{action.attachments.length}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-center block">—</span>
                      )}
                    </td>

                    {/* 11. Operaciones */}
                    <td className="py-2 px-1 text-center align-top">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          disabled={!canAdd}
                          onClick={() => onOpenAddAction(project)}
                          className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
                            canAdd
                              ? 'text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-200 shadow-2xs cursor-pointer'
                              : 'text-slate-400 bg-slate-50 border border-slate-200 cursor-not-allowed opacity-50'
                          }`}
                          title="Agregar nueva acción a este proyecto"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

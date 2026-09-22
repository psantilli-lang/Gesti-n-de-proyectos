import React, { useState, useMemo } from 'react';
import { 
  SAPProject, 
  UserSession, 
  SAPModule, 
  SAP_MODULES_DATA, 
  ALL_PROJECT_STATES, 
  ProjectState 
} from '../types/project';
import { storageService } from '../services/storageService';
import { 
  canUserEditProjectMetadata, 
  canUserDeleteProject,
  canUserCancelProject,
  isPMO,
  formatDateSpanish 
} from '../utils/helpers';
import { 
  FolderKanban, 
  Search, 
  Filter, 
  Plus, 
  ExternalLink, 
  Edit3, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Users,
  Paperclip,
  LayoutGrid,
  List
} from 'lucide-react';

interface ProjectsListViewProps {
  projects: SAPProject[];
  currentUser: UserSession;
  onSelectProject: (project: SAPProject) => void;
  onEditProject: (project: SAPProject) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onUpdateProject: (project: SAPProject) => void;
}

export const ProjectsListView: React.FC<ProjectsListViewProps> = ({
  projects,
  currentUser,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onOpenNewProject,
  onUpdateProject,
}) => {
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const areas = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.area))).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (selectedArea !== 'all' && p.area !== selectedArea) return false;
      if (selectedModule !== 'all' && !p.sapModules.includes(selectedModule as SAPModule)) return false;
      if (selectedState !== 'all' && p.state !== selectedState) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchCode = p.code.toLowerCase().includes(q);
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchArea = p.area.toLowerCase().includes(q);
        const matchTeam = p.team.some((t) => t.name.toLowerCase().includes(q) || t.role.toLowerCase().includes(q));
        if (!matchCode && !matchTitle && !matchArea && !matchTeam) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.area !== b.area) return a.area.localeCompare(b.area);
      return a.priority - b.priority;
    });
  }, [projects, selectedArea, selectedModule, selectedState, searchTerm]);

  const handleStateChange = (project: SAPProject, newState: ProjectState) => {
    if (newState === '8- Cancelado') {
      if (!canUserCancelProject(currentUser, project)) {
        alert(
          `Permiso denegado: El cambio de estado a "8- Cancelado" es exclusivo del rol PMO.`
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

  return (
    <div className="space-y-6 pb-16">
      {/* Top action bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-blue-600" />
            Proyectos SAP
          </h2>
          <p className="text-xs text-slate-500">
            Administración integral de iniciativas, asignación de prioridades por área y trazabilidad
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'cards' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Vista de Tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'table' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Vista de Tabla"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onOpenNewProject}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Proyecto</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar proyecto o integrante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Area filter */}
          <div>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todas las Áreas ({projects.length})</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* SAP Module filter */}
          <div>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todos los Módulos SAP</option>
              {SAP_MODULES_DATA.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} - {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* State filter */}
          <div>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todos los Estados ({ALL_PROJECT_STATES.length})</option>
              {ALL_PROJECT_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content Rendering: Cards or Table */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
          <FolderKanban className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No hay proyectos para los criterios seleccionados</h3>
          <p className="text-xs text-slate-500 mt-1">Revisá los filtros aplicados o creá un nuevo proyecto.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const health = storageService.getProjectHealth(project);
            const totalFiles = (project.currentSituationFiles?.length || 0) + (project.improvementNeedFiles?.length || 0);

            return (
              <div
                key={project.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5 space-y-3">
                  {/* Top Bar: Priority and Code */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {project.code}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                        Prioridad #{project.priority}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                        health.overallStatus === 'Cancelado'
                          ? 'bg-slate-100 text-slate-500 border border-slate-300'
                          : health.overallStatus === 'Pendiente'
                          ? 'bg-slate-100 text-slate-700 border border-slate-200'
                          : health.overallStatus === 'A tiempo'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : health.overallStatus === 'Demorado'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {health.overallStatus}
                    </span>
                  </div>

                  {/* Title & Area */}
                  <div>
                    <span className="text-[11px] font-semibold text-blue-700 block mb-0.5">
                      {project.area}
                    </span>
                    <h3
                      onClick={() => onSelectProject(project)}
                      className="text-sm font-bold text-slate-900 line-clamp-2 hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      {project.title}
                    </h3>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Creado por: <strong className="text-slate-700">{project.createdBy || 'Administrador General'}</strong>
                    </span>
                  </div>

                  {/* SAP Modules badges */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {project.sapModules.map((mod) => {
                      const modInfo = SAP_MODULES_DATA.find((m) => m.id === mod);
                      return (
                        <span
                          key={mod}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            modInfo?.badgeBg || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {mod}
                        </span>
                      );
                    })}
                  </div>

                  {/* State dropdown */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Estado Actual del Proyecto:
                      </label>
                    </div>
                    <select
                      value={project.state}
                      onChange={(e) => handleStateChange(project, e.target.value as ProjectState)}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      title="Cambiar estado del proyecto"
                    >
                      {ALL_PROJECT_STATES.map((st) => {
                        const isCancel = st === '8- Cancelado';
                        const disabledOpt = isCancel && !canUserCancelProject(currentUser, project);
                        return (
                          <option key={st} value={st} disabled={disabledOpt}>
                            {st} {disabledOpt ? ' (Solo PMO)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Progress & Indicators */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Progreso de Etapas:</span>
                      <span className="font-bold">{health.completionPercentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full"
                        style={{ width: `${health.completionPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta stats: Team, Actions, Files */}
                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
                    <span className="flex items-center gap-1" title="Miembros del equipo">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {project.team.length} miembros
                    </span>
                    <span className="flex items-center gap-1" title="Acciones pendientes">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      {health.pendingActionsCount} acc. pendientes
                    </span>
                    <span className="flex items-center gap-1" title="Archivos adjuntos">
                      <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                      {totalFiles} adjuntos
                    </span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => onSelectProject(project)}
                    className="flex-1 py-1.5 px-2.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200 transition-colors flex items-center justify-center gap-1"
                  >
                    <span>Ver Ficha y Cronograma</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  </button>

                  <div className="flex items-center gap-1">
                    {canUserEditProjectMetadata(currentUser, project) && (
                      <button
                        onClick={() => onEditProject(project)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200"
                        title={
                          isPMO(currentUser)
                            ? 'Editar datos del proyecto (PMO)'
                            : 'Editar información general (Proyecto dado de alta por ti)'
                        }
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canUserDeleteProject(currentUser, project) && (
                      <button
                        onClick={() => {
                          if (window.confirm(`¿Está seguro de eliminar el proyecto ${project.code}? Solo el PMO o quien dio de alta el proyecto pueden eliminarlo.`)) {
                            onDeleteProject(project.id);
                          }
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200"
                        title="Eliminar proyecto (PMO o quien dio el alta)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Prior.</th>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Área</th>
                  <th className="py-3 px-4">Módulos SAP</th>
                  <th className="py-3 px-4 min-w-[240px]">Título del Proyecto</th>
                  <th className="py-3 px-4 min-w-[200px]">Estado Actual</th>
                  <th className="py-3 px-4 text-center">Avance</th>
                  <th className="py-3 px-4 text-center">Acc. Pend.</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((project) => {
                  const health = storageService.getProjectHealth(project);

                  return (
                    <tr key={project.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-blue-700">
                        #{project.priority}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {project.code}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {project.area}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {project.sapModules.map((mod) => (
                            <span
                              key={mod}
                              className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200"
                            >
                              {mod}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <button
                          onClick={() => onSelectProject(project)}
                          className="hover:text-blue-600 text-left font-bold"
                        >
                          {project.title}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={project.state}
                          onChange={(e) => handleStateChange(project, e.target.value as ProjectState)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                          title="Cambiar estado del proyecto"
                        >
                          {ALL_PROJECT_STATES.map((st) => {
                            const isCancel = st === '8- Cancelado';
                            const disabledOpt = isCancel && !canUserCancelProject(currentUser, project);
                            return (
                              <option key={st} value={st} disabled={disabledOpt}>
                                {st} {disabledOpt ? ' (Solo PMO)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-900">{health.completionPercentage}%</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            health.pendingActionsCount > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {health.pendingActionsCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onSelectProject(project)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-blue-700 rounded font-semibold transition-colors"
                          >
                            Ver Ficha
                          </button>
                          {canUserEditProjectMetadata(currentUser, project) && (
                            <button
                              onClick={() => onEditProject(project)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                              title={
                                isPMO(currentUser)
                                  ? 'Editar datos (PMO)'
                                  : 'Editar datos (Proyecto dado de alta por ti)'
                              }
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canUserDeleteProject(currentUser, project) && (
                            <button
                              onClick={() => {
                                if (window.confirm(`¿Está seguro de eliminar el proyecto ${project.code}? Solo el PMO o quien dio de alta el proyecto pueden eliminarlo.`)) {
                                  onDeleteProject(project.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              title="Eliminar proyecto (PMO o quien dio el alta)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
  );
};

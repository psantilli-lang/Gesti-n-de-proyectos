import React, { useState, useMemo, useEffect } from 'react';
import {
  SAPProject,
  UserSession,
  ALL_PROJECT_STATES,
  SAP_MODULES_DATA,
  SAPModule,
} from '../types/project';
import {
  ArrowUpDown,
  Filter,
  Search,
  ExternalLink,
  Layers,
  CheckCircle2,
  RotateCcw,
  Info,
} from 'lucide-react';

interface PrioritizationViewProps {
  projects: SAPProject[];
  currentUser: UserSession;
  onUpdateProject: (project: SAPProject) => void;
  onSelectProject: (project: SAPProject) => void;
}

export const PrioritizationView: React.FC<PrioritizationViewProps> = ({
  projects,
  currentUser,
  onUpdateProject,
  onSelectProject,
}) => {
  // 3 independent and combined filters
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Local feedback indicator when a project priority is updated
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null);

  // Available unique areas from loaded projects
  const uniqueAreas = useMemo(() => {
    const areas = new Set<string>();
    projects.forEach((p) => {
      if (p.area) areas.add(p.area);
    });
    return Array.from(areas).sort();
  }, [projects]);

  // Available SAP modules list
  const allModules: SAPModule[] = ['PP', 'MM', 'WM', 'QM', 'SD', 'FI', 'CO'];

  // Filter projects according to the 3 combined filters + optional search query
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      // 1. Filter by Area
      if (selectedArea !== 'all' && project.area !== selectedArea) {
        return false;
      }

      // 2. Filter by State
      if (selectedState !== 'all' && project.state !== selectedState) {
        return false;
      }

      // 3. Filter by SAP Module (using project.sapModules)
      if (selectedModule !== 'all') {
        if (!project.sapModules || !project.sapModules.includes(selectedModule as SAPModule)) {
          return false;
        }
      }

      // 4. Search query (code, title, responsible, area)
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchesCode = project.code?.toLowerCase().includes(query);
        const matchesTitle = project.title.toLowerCase().includes(query);
        const matchesArea = project.area.toLowerCase().includes(query);
        const matchesCreator = project.createdBy?.toLowerCase().includes(query);
        if (!matchesCode && !matchesTitle && !matchesArea && !matchesCreator) {
          return false;
        }
      }

      return true;
    });
  }, [projects, selectedArea, selectedState, selectedModule, searchTerm]);

  // Sorting configuration
  type SortColumn = 'priority' | 'area' | 'code' | 'title' | 'state';
  const [sortColumn, setSortColumn] = useState<SortColumn>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Stable sequence of project IDs so editing priorities in-place NEVER jumps rows
  const [orderedProjectIds, setOrderedProjectIds] = useState<string[]>([]);
  const [hasUnsortedChanges, setHasUnsortedChanges] = useState<boolean>(false);

  // Helper function to sort a list of projects cleanly
  const sortProjects = (
    list: SAPProject[],
    col: SortColumn,
    dir: 'asc' | 'desc'
  ) => {
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (col === 'priority') {
        const pA = typeof a.priority === 'number' ? a.priority : 999;
        const pB = typeof b.priority === 'number' ? b.priority : 999;
        cmp = pA - pB;
        if (cmp === 0) {
          cmp = a.area.localeCompare(b.area) || (a.code || '').localeCompare(b.code || '');
        }
      } else if (col === 'area') {
        cmp = a.area.localeCompare(b.area);
        if (cmp === 0) {
          const pA = typeof a.priority === 'number' ? a.priority : 999;
          const pB = typeof b.priority === 'number' ? b.priority : 999;
          cmp = pA - pB;
        }
      } else if (col === 'code') {
        cmp = (a.code || '').localeCompare(b.code || '');
      } else if (col === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (col === 'state') {
        cmp = a.state.localeCompare(b.state);
      }
      return dir === 'asc' ? cmp : -cmp;
    });
  };

  // When filters or search change, initialize or update orderedProjectIds
  useEffect(() => {
    const sorted = sortProjects(filteredProjects, sortColumn, sortDirection);
    setOrderedProjectIds(sorted.map((p) => p.id));
    setHasUnsortedChanges(false);
  }, [selectedArea, selectedState, selectedModule, searchTerm]);

  // Handler to explicitly sort when user clicks a column header or button
  const handleSortBy = (col: SortColumn) => {
    let nextDir: 'asc' | 'desc' = 'asc';
    if (sortColumn === col) {
      nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
    }
    setSortColumn(col);
    setSortDirection(nextDir);
    const sorted = sortProjects(filteredProjects, col, nextDir);
    setOrderedProjectIds(sorted.map((p) => p.id));
    setHasUnsortedChanges(false);
  };

  const handleApplyPrioritySort = () => {
    setSortColumn('priority');
    setSortDirection('asc');
    const sorted = sortProjects(filteredProjects, 'priority', 'asc');
    setOrderedProjectIds(sorted.map((p) => p.id));
    setHasUnsortedChanges(false);
  };

  // Map ordered IDs to project objects so rows stay perfectly stable while editing
  const displayedProjects = useMemo(() => {
    const projectMap = new Map<string, SAPProject>(filteredProjects.map((p) => [p.id, p]));
    const result: SAPProject[] = [];

    // Follow current stable order
    orderedProjectIds.forEach((id) => {
      const p = projectMap.get(id);
      if (p) {
        result.push(p);
        projectMap.delete(id);
      }
    });

    // Append any newly added / remaining projects
    projectMap.forEach((p) => {
      result.push(p);
    });

    return result;
  }, [filteredProjects, orderedProjectIds]);

  // Check if any filter is active
  const hasActiveFilters =
    selectedArea !== 'all' ||
    selectedState !== 'all' ||
    selectedModule !== 'all' ||
    searchTerm.trim() !== '';

  const handleResetFilters = () => {
    setSelectedArea('all');
    setSelectedState('all');
    setSelectedModule('all');
    setSearchTerm('');
  };

  // Manual & independent Priority change handler with feedback
  const handlePriorityChange = (project: SAPProject, newPriorityVal: number) => {
    if (isNaN(newPriorityVal) || newPriorityVal < 1) return;
    if (project.priority === newPriorityVal) return;

    const updatedProject: SAPProject = {
      ...project,
      priority: newPriorityVal,
      updatedAt: new Date().toISOString(),
    };

    onUpdateProject(updatedProject);
    setHasUnsortedChanges(true);
    setRecentlyUpdatedId(project.id);
    setTimeout(() => {
      setRecentlyUpdatedId((curr) => (curr === project.id ? null : curr));
    }, 2000);
  };

  // Helper for state badge styling
  const getStateBadgeClass = (state: string) => {
    if (state.includes('01')) return 'bg-slate-100 text-slate-700 border-slate-300';
    if (state.includes('02')) return 'bg-sky-50 text-sky-700 border-sky-300';
    if (state.includes('03')) return 'bg-amber-50 text-amber-700 border-amber-300';
    if (state.includes('05')) return 'bg-blue-50 text-blue-700 border-blue-300';
    if (state.includes('06')) return 'bg-purple-50 text-purple-700 border-purple-300';
    if (state.includes('07')) return 'bg-emerald-50 text-emerald-700 border-emerald-300';
    if (state.includes('Cancelado') || state.includes('8')) return 'bg-rose-50 text-rose-700 border-rose-300';
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Banner de Presentación */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            <ArrowUpDown className="w-4 h-4 text-amber-400" />
            <span>Gestión y Revisión Manual de Prioridades</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Matriz de Priorización de Proyectos
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
            Cada iniciativa posee una <strong>prioridad totalmente independiente</strong>. Modifica manualmente
            el valor de cualquier proyecto sin que se produzcan alteraciones ni desplazamientos en cascada en el resto.
            Múltiples proyectos pueden compartir la misma prioridad si así lo requiere el área.
          </p>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 shrink-0">
          <div className="text-center px-2">
            <div className="text-2xl font-black text-amber-400">{displayedProjects.length}</div>
            <div className="text-[11px] font-medium text-slate-300 uppercase tracking-wide">
              {hasActiveFilters ? 'Filtrados' : 'Proyectos'}
            </div>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div className="text-center px-2">
            <div className="text-2xl font-black text-white">{projects.length}</div>
            <div className="text-[11px] font-medium text-slate-300 uppercase tracking-wide">Total</div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros (Área, Estado, Módulo SAP) + Búsqueda */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs uppercase tracking-wide">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Filtros Combinables:</span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 rounded-md hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer filtros</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* 1. FILTRO POR ÁREA */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              1. Área
            </label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="all">Todas las Áreas ({projects.length})</option>
              {uniqueAreas.map((area) => {
                const count = projects.filter((p) => p.area === area).length;
                return (
                  <option key={area} value={area}>
                    {area} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* 2. FILTRO POR ESTADO */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              2. Estado
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="all">Todos los Estados ({projects.length})</option>
              {ALL_PROJECT_STATES.map((state) => {
                const count = projects.filter((p) => p.state === state).length;
                return (
                  <option key={state} value={state}>
                    {state} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* 3. FILTRO POR MÓDULO SAP */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              3. Módulo SAP
            </label>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all cursor-pointer"
            >
              <option value="all">Todos los Módulos ({projects.length})</option>
              {allModules.map((mod) => {
                const count = projects.filter((p) => p.sapModules?.includes(mod)).length;
                const desc = SAP_MODULES_DATA.find((m) => m.id === mod)?.name || mod;
                return (
                  <option key={mod} value={mod}>
                    {mod} - {desc} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* 4. BÚSQUEDA RÁPIDA */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
              Búsqueda
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Código, título, líder..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Chips de filtros activos */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] text-slate-500 font-medium">Activos:</span>
            {selectedArea !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                Área: {selectedArea}
                <button onClick={() => setSelectedArea('all')} className="hover:text-blue-950 font-bold ml-0.5">
                  ×
                </button>
              </span>
            )}
            {selectedState !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                Estado: {selectedState}
                <button onClick={() => setSelectedState('all')} className="hover:text-indigo-950 font-bold ml-0.5">
                  ×
                </button>
              </span>
            )}
            {selectedModule !== 'all' && (
              <span className="inline-flex items-center gap-1 bg-cyan-50 border border-cyan-200 text-cyan-800 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                Módulo: {selectedModule}
                <button onClick={() => setSelectedModule('all')} className="hover:text-cyan-950 font-bold ml-0.5">
                  ×
                </button>
              </span>
            )}
            {searchTerm.trim() !== '' && (
              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                "{searchTerm}"
                <button onClick={() => setSearchTerm('')} className="hover:text-amber-950 font-bold ml-0.5">
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabla Principal de Priorización */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Listado de Proyectos ({displayedProjects.length})
            </h3>
            <span className="text-[11px] text-slate-500 font-normal">
              — Prioridad independiente por proyecto (no afecta a los demás)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsortedChanges && (
              <button
                type="button"
                onClick={handleApplyPrioritySort}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer animate-in fade-in"
                title="Alinear las filas según las prioridades que acabas de modificar"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-amber-700" />
                <span>Reordenar tabla por prioridad</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleApplyPrioritySort}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-2xs cursor-pointer"
              title="Ordenar la lista por número de prioridad"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Ordenar por prioridad</span>
            </button>
          </div>
        </div>

        {displayedProjects.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Filter className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              No se encontraron proyectos con los filtros seleccionados
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Prueba cambiando o restableciendo los filtros de Área, Estado o Módulo SAP para ver los proyectos.
            </p>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ver todos los proyectos</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <th
                    onClick={() => handleSortBy('priority')}
                    className="py-3 px-4 w-32 text-center cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                    title="Clic para ordenar por Prioridad"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Prioridad</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortColumn === 'priority' ? 'text-blue-600' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortBy('area')}
                    className="py-3 px-4 w-40 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                    title="Clic para ordenar por Área"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Área</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortColumn === 'area' ? 'text-blue-600' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortBy('title')}
                    className="py-3 px-4 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                    title="Clic para ordenar por Título"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Proyecto (Haz clic para ver ficha)</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortColumn === 'title' ? 'text-blue-600' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSortBy('state')}
                    className="py-3 px-4 w-48 cursor-pointer hover:bg-slate-200/70 select-none transition-colors"
                    title="Clic para ordenar por Estado"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Estado / Etapa</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortColumn === 'state' ? 'text-blue-600' : 'text-slate-400'}`} />
                    </div>
                  </th>
                  <th className="py-3 px-4 w-36">Módulos SAP</th>
                  <th className="py-3 px-4 w-20 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedProjects.map((project) => {
                  const isUpdated = recentlyUpdatedId === project.id;

                  return (
                    <tr
                      key={project.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isUpdated ? 'bg-emerald-50/60' : ''
                      }`}
                    >
                      {/* 1. PRIORIDAD (EDITABLE MANUAL E INDEPENDIENTE) */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="number"
                              min="1"
                              max="99"
                              value={project.priority ?? 1}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val >= 1) {
                                  handlePriorityChange(project, val);
                                }
                              }}
                              className={`w-14 text-center font-black text-sm rounded-lg border py-1.5 px-1 shadow-2xs transition-all focus:outline-none focus:ring-2 ${
                                project.priority === 1
                                  ? 'bg-amber-400 text-amber-950 border-amber-500 font-black focus:ring-amber-500'
                                  : project.priority === 2
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold focus:ring-amber-400'
                                  : 'bg-slate-50 text-slate-800 border-slate-300 font-bold focus:ring-blue-500'
                              }`}
                              title="Prioridad manual independiente (no altera los demás proyectos)"
                            />

                            {/* Stepper buttons */}
                            <div className="flex flex-col ml-1">
                              <button
                                type="button"
                                onClick={() => handlePriorityChange(project, (project.priority || 1) + 1)}
                                className="text-slate-400 hover:text-blue-600 hover:bg-slate-200 rounded px-1 text-[10px] font-bold leading-tight cursor-pointer"
                                title="Aumentar prioridad"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handlePriorityChange(
                                    project,
                                    Math.max(1, (project.priority || 1) - 1)
                                  )
                                }
                                className="text-slate-400 hover:text-blue-600 hover:bg-slate-200 rounded px-1 text-[10px] font-bold leading-tight cursor-pointer"
                                title="Disminuir prioridad"
                              >
                                ▼
                              </button>
                            </div>
                          </div>

                          {/* Feedback status */}
                          {isUpdated && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 font-bold animate-in fade-in">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Guardado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. ÁREA */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {project.area}
                        </span>
                      </td>

                      {/* 3. TÍTULO Y CÓDIGO (LINK A LA TARJETA DEL PROYECTO) */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() => onSelectProject(project)}
                            className="text-left font-bold text-slate-900 hover:text-blue-600 hover:underline flex items-start gap-1.5 group transition-colors cursor-pointer"
                            title="Haz clic para ver la ficha completa, cronograma y acciones del proyecto"
                          >
                            <span className="text-xs sm:text-sm leading-snug">{project.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0 mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                          </button>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            {project.code && (
                              <span className="font-mono font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {project.code}
                              </span>
                            )}
                            {project.createdBy && (
                              <span>Por: {project.createdBy}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. ESTADO */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStateBadgeClass(
                            project.state
                          )}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span className="truncate max-w-[170px]">{project.state}</span>
                        </span>
                      </td>

                      {/* 5. MÓDULOS SAP */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {project.sapModules && project.sapModules.length > 0 ? (
                            project.sapModules.map((mod) => (
                              <span
                                key={mod}
                                className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-bold text-[10px]"
                                title={SAP_MODULES_DATA.find((m) => m.id === mod)?.name || mod}
                              >
                                {mod}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          )}
                        </div>
                      </td>

                      {/* 6. ACCIONES (BOTÓN VER DETALLES) */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onSelectProject(project)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold transition-all border border-slate-200 hover:border-blue-600 shadow-2xs cursor-pointer"
                          title="Abrir Ficha de Proyecto y Cronograma"
                        >
                          <span>Ficha</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Guía de Buenas Prácticas */}
      <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-3 text-xs text-blue-900">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold">Priorización independiente y manual</span>
          <p className="text-blue-800 leading-relaxed text-[11px]">
            La prioridad de cada proyecto es un valor individual que puedes alterar libremente. Modificar un proyecto
            <strong> no afecta ni altera la prioridad de los demás</strong>. Además, la posición de las filas se mantiene estable mientras editas para evitar saltos molestos, pudiendo hacer clic en "Ordenar por prioridad" cuando desees reagrupar la vista.
          </p>
        </div>
      </div>
    </div>
  );
};

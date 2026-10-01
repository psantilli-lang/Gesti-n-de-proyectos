import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  SAPProject, 
  StageAction, 
  UserSession, 
  ALL_PROJECT_STATES, 
  ProjectState, 
  SAP_MODULES_DATA,
  AttachedFile
} from '../types/project';
import { storageService } from '../services/storageService';
import { 
  formatDateSpanish, 
  canUserEditAction, 
  canUserAddAction,
  canUserDeleteAction,
  canUserCancelProject,
  canUserAccessReportingAndPrioritization,
  isPMO,
  isActionOverdue, 
  isActionDueSoon 
} from '../utils/helpers';
import { 
  CalendarCheck, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  Plus, 
  MessageSquare, 
  User, 
  Filter, 
  Search, 
  ExternalLink, 
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  Layers,
  Sparkles,
  RotateCcw,
  Paperclip,
  FileText,
  Download,
  Ban,
  Trash2,
  Eye,
  Check,
  X,
  Edit3,
  Table,
  LayoutGrid,
} from 'lucide-react';
import { WeeklyReviewTable } from './WeeklyReviewTable';

interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectDropdownProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  allLabel: string;
  totalCount: number;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  allLabel,
  totalCount,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const selectAll = () => {
    onChange([]);
  };

  const clearAll = () => {
    onChange([]);
  };

  const filteredOptions = useMemo(() => {
    if (!filterSearch.trim()) return options;
    const q = filterSearch.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, filterSearch]);

  const isAllSelected = selectedValues.length === 0;

  // Compute trigger button label
  let triggerText = `${allLabel} (${totalCount})`;
  if (selectedValues.length === 1) {
    const match = options.find((opt) => opt.value === selectedValues[0]);
    triggerText = match ? `${match.label} (${match.count ?? 0})` : selectedValues[0];
  } else if (selectedValues.length > 1) {
    triggerText = `${selectedValues.length} seleccionados`;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
          selectedValues.length > 0
            ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold shadow-xs'
            : 'bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100'
        }`}
      >
        <span className="truncate max-w-[170px]" title={triggerText}>
          {triggerText}
        </span>
        {selectedValues.length > 1 && (
          <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px] font-bold">
            {selectedValues.length}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-64 max-h-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs flex flex-col">
          {/* Header with quick actions */}
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 px-1">
            <span className="font-semibold text-slate-700">{label}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className={`text-[11px] font-medium transition-colors cursor-pointer ${
                  isAllSelected ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-blue-600'
                }`}
              >
                Todos
              </button>
              {selectedValues.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Search inside dropdown if > 5 options */}
          {options.length > 5 && (
            <div className="px-1 mb-1.5">
              <input
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Buscar opción..."
                className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
              />
            </div>
          )}

          {/* Options list */}
          <div className="overflow-y-auto space-y-0.5 flex-1 pr-1 max-h-56">
            {/* "Todas" Option */}
            <label
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 cursor-pointer select-none"
              onClick={selectAll}
            >
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={selectAll}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span className={`flex-1 text-xs ${isAllSelected ? 'font-bold text-blue-900' : 'text-slate-700'}`}>
                {allLabel}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">({totalCount})</span>
            </label>

            <div className="h-px bg-slate-100 my-1" />

            {filteredOptions.map((opt) => {
              const isChecked = selectedValues.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer select-none transition-colors ${
                    isChecked ? 'bg-blue-50/70 font-semibold text-blue-900' : 'text-slate-700'
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    toggleValue(opt.value);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 pointer-events-none"
                  />
                  <span className="flex-1 truncate text-xs" title={opt.label}>
                    {opt.label}
                  </span>
                  {typeof opt.count === 'number' && (
                    <span className="text-[10px] text-slate-400 font-mono">({opt.count})</span>
                  )}
                </label>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="p-3 text-center text-slate-400 text-xs">
                No hay coincidencias
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface WeeklyReviewViewProps {
  projects: SAPProject[];
  currentUser: UserSession;
  onUpdateProject: (updated: SAPProject) => void;
  onSelectProject: (project: SAPProject) => void;
  onOpenAddAction: (project: SAPProject) => void;
  onOpenEditAction: (project: SAPProject, action: StageAction) => void;
  onPreviewFile?: (file: AttachedFile, projectTitle?: string) => void;
  onEditProject?: (project: SAPProject) => void;
}

export const WeeklyReviewView: React.FC<WeeklyReviewViewProps> = ({
  projects,
  currentUser,
  onUpdateProject,
  onSelectProject,
  onOpenAddAction,
  onOpenEditAction,
  onPreviewFile,
  onEditProject,
}) => {
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedProjectCodes, setSelectedProjectCodes] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending-actions' | 'delayed'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingTitleProjectId, setEditingTitleProjectId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState<string>('');

  const handleSaveTitle = (project: SAPProject) => {
    const trimmed = tempTitle.trim();
    if (trimmed && trimmed !== project.title) {
      onUpdateProject({
        ...project,
        title: trimmed,
        updatedAt: new Date().toISOString(),
      });
    }
    setEditingTitleProjectId(null);
  };

  // Distinct areas from loaded projects
  const uniqueAreas = useMemo(() => {
    const areas = new Set(projects.map((p) => p.area));
    return Array.from(areas).sort();
  }, [projects]);

  // Distinct priorities automatically extracted from ALL loaded projects
  const uniquePriorities = useMemo(() => {
    const prioritiesSet = new Set<number>();
    projects.forEach((p) => {
      if (typeof p.priority === 'number' && !isNaN(p.priority)) {
        prioritiesSet.add(p.priority);
      }
    });

    return Array.from(prioritiesSet).sort((a, b) => a - b);
  }, [projects]);

  // Multi-select options prepared for the dropdowns
  const areaOptions: MultiSelectOption[] = useMemo(() => {
    return uniqueAreas.map((area) => ({
      value: area,
      label: area,
      count: projects.filter((p) => p.area === area).length,
    }));
  }, [uniqueAreas, projects]);

  const stateOptions: MultiSelectOption[] = useMemo(() => {
    return ALL_PROJECT_STATES.map((st) => ({
      value: st,
      label: st,
      count: projects.filter((p) => {
        const pCode = p.state.split('-')[0].trim();
        const sCode = st.split('-')[0].trim();
        return p.state === st || (pCode && pCode === sCode);
      }).length,
    }));
  }, [projects]);

  const priorityOptions: MultiSelectOption[] = useMemo(() => {
    return uniquePriorities.map((prio) => ({
      value: prio.toString(),
      label: `Prioridad #${prio}`,
      count: projects.filter((p) => p.priority === prio).length,
    }));
  }, [uniquePriorities, projects]);

  const codeOptions: MultiSelectOption[] = useMemo(() => {
    return projects
      .map((p) => ({
        value: p.code,
        label: `${p.code} - ${p.title}`,
        count: 1,
      }))
      .sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
  }, [projects]);

  // Check if any filter is actively restricting results
  const hasActiveFilters =
    selectedAreas.length > 0 ||
    selectedStates.length > 0 ||
    selectedPriorities.length > 0 ||
    selectedProjectCodes.length > 0 ||
    statusFilter !== 'all' ||
    searchTerm.trim() !== '';

  const handleClearFilters = () => {
    setSelectedAreas([]);
    setSelectedStates([]);
    setSelectedPriorities([]);
    setSelectedProjectCodes([]);
    setStatusFilter('all');
    setSearchTerm('');
  };

  // Filtered list of projects applying ALL filters simultaneously
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // 1. Area match (multi-select)
      if (selectedAreas.length > 0 && !selectedAreas.includes(p.area)) {
        return false;
      }

      // 2. State match (multi-select with code matching)
      if (selectedStates.length > 0) {
        const pCode = p.state.split('-')[0].trim();
        const matchesAnyState = selectedStates.some((st) => {
          const sCode = st.split('-')[0].trim();
          return p.state === st || (pCode && pCode === sCode);
        });
        if (!matchesAnyState) return false;
      }

      // 3. Priority match (multi-select)
      if (selectedPriorities.length > 0 && !selectedPriorities.includes(p.priority.toString())) {
        return false;
      }

      // 4. Project Number / Code match (multi-select)
      if (selectedProjectCodes.length > 0 && !selectedProjectCodes.includes(p.code)) {
        return false;
      }

      // 4. Status/Condition filters (pending actions / delayed)
      const health = storageService.getProjectHealth(p);
      if (statusFilter === 'pending-actions' && health.pendingActionsCount === 0) return false;
      if (statusFilter === 'delayed' && health.delayedStagesCount === 0 && health.overdueActionsCount === 0) return false;

      // 5. Search match (code, title, area, state, action title, responsible)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesCode = p.code.toLowerCase().includes(query);
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesArea = p.area.toLowerCase().includes(query);
        const matchesState = p.state.toLowerCase().includes(query);
        const matchesAction = p.actions.some(
          (a) => a.title.toLowerCase().includes(query) || a.responsible.toLowerCase().includes(query)
        );
        if (!matchesCode && !matchesTitle && !matchesArea && !matchesState && !matchesAction) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort primarily by Area, then by Priority within Area
      if (a.area !== b.area) return a.area.localeCompare(b.area);
      return a.priority - b.priority;
    });
  }, [projects, selectedAreas, selectedStates, selectedPriorities, statusFilter, searchTerm]);

  // Group filtered projects by area for structured sweeping
  const groupedByArea = useMemo<Record<string, SAPProject[]>>(() => {
    const groups: Record<string, SAPProject[]> = {};
    filteredProjects.forEach((p) => {
      if (!groups[p.area]) groups[p.area] = [];
      groups[p.area].push(p);
    });
    return groups;
  }, [filteredProjects]);

  // Quick state update for project with security enforcement
  const handleStateChange = (project: SAPProject, newState: ProjectState) => {
    if (newState === '8- Cancelado' || newState === '08- Cancelado') {
      if (!canUserCancelProject(currentUser, project)) {
        alert(
          'Permiso denegado: El cambio de estado a "08- Cancelado" es una actividad exclusiva del rol PMO.'
        );
        return;
      }
    }

    const updated: SAPProject = {
      ...project,
      state: newState,
      updatedAt: new Date().toISOString(),
    };
    onUpdateProject(updated);
  };

  // Quick manual priority update for project (exclusive to PMO)
  const handlePriorityChange = (project: SAPProject, newPriorityVal: number) => {
    if (!canUserAccessReportingAndPrioritization(currentUser)) {
      alert('Permiso denegado: La priorización de proyectos es una actividad exclusiva del PMO.');
      return;
    }
    if (isNaN(newPriorityVal) || newPriorityVal < 1) return;
    if (project.priority === newPriorityVal) return;
    const updated: SAPProject = {
      ...project,
      priority: newPriorityVal,
      updatedAt: new Date().toISOString(),
    };
    onUpdateProject(updated);
  };

  // Quick toggle of action status if authorized
  const handleQuickActionStatusChange = (
    project: SAPProject,
    action: StageAction,
    newStatus: 'Pendiente' | 'En proceso' | 'Finalizada'
  ) => {
    if (!canUserEditAction(currentUser, action)) {
      alert(`Permiso denegado: Solo el responsable asignado (${action.responsible}) o el Administrador pueden modificar esta acción.`);
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
  };

  // Overall metrics for the sweep
  const totalProjectsCount = projects.length;
  const totalPendingActions = projects.reduce(
    (acc, p) => acc + p.actions.filter((a) => a.status !== 'Finalizada').length,
    0
  );
  const totalOverdueActions = projects.reduce(
    (acc, p) => acc + p.actions.filter((a) => isActionOverdue(a)).length,
    0
  );

  return (
    <div className="space-y-6 pb-16">
      {/* Header Banner for Weekly Review */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-blue-200 text-xs font-semibold uppercase tracking-wider mb-2">
              <CalendarCheck className="w-4 h-4 text-blue-300" />
              Reunión de Comité de Mejora Continua
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Barrida Semanal de Proyectos (100%)
            </h2>
            <p className="mt-2 text-sm text-blue-100/90 leading-relaxed">
              Revisión exhaustiva proyecto por proyecto organizada por área. Controlá el cumplimiento del cronograma, asigná o actualizá las acciones pendientes y modificá los estados en tiempo real.
            </p>
          </div>

          {/* Quick KPI stats in banner */}
          <div className="grid grid-cols-3 gap-3 bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/10">
            <div className="text-center">
              <span className="block text-2xl font-extrabold text-white">{totalProjectsCount}</span>
              <span className="text-[11px] text-blue-200 font-medium">Proyectos Totales</span>
            </div>
            <div className="text-center border-x border-white/15 px-3">
              <span className="block text-2xl font-extrabold text-amber-300">{totalPendingActions}</span>
              <span className="text-[11px] text-blue-200 font-medium">Acciones Pendientes</span>
            </div>
            <div className="text-center">
              <span className="block text-2xl font-extrabold text-rose-300">{totalOverdueActions}</span>
              <span className="text-[11px] text-blue-200 font-medium">Acciones Vencidas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and search toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Area multi-select filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Área:</span>
              <MultiSelectDropdown
                label="Filtrar por Área"
                options={areaOptions}
                selectedValues={selectedAreas}
                onChange={setSelectedAreas}
                allLabel="Todas las Áreas"
                totalCount={projects.length}
              />
            </div>

            {/* State multi-select filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600">Estado:</span>
              <MultiSelectDropdown
                label="Filtrar por Estado"
                options={stateOptions}
                selectedValues={selectedStates}
                onChange={setSelectedStates}
                allLabel="Todos los Estados"
                totalCount={projects.length}
              />
            </div>

            {/* Priority multi-select filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600">Prioridad:</span>
              <MultiSelectDropdown
                label="Filtrar por Prioridad"
                options={priorityOptions}
                selectedValues={selectedPriorities}
                onChange={setSelectedPriorities}
                allLabel="Todas"
                totalCount={projects.length}
              />
            </div>

            {/* Project Code / Number multi-select filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-600">N° Proyecto:</span>
              <MultiSelectDropdown
                label="Filtrar por N° Proyecto"
                options={codeOptions}
                selectedValues={selectedProjectCodes}
                onChange={setSelectedProjectCodes}
                allLabel="Todos los N°"
                totalCount={projects.length}
              />
            </div>

            {/* Status / Condition Quick Buttons */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos (100%)
              </button>
              <button
                onClick={() => setStatusFilter('pending-actions')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'pending-actions' ? 'bg-white text-amber-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Con Acciones Pendientes
              </button>
              <button
                onClick={() => setStatusFilter('delayed')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  statusFilter === 'delayed' ? 'bg-white text-rose-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Con Atraso
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle: Tabla vs Tarjetas */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Vista Formato Tabla (Recomendada para la Barrida Semanal)"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Vista Tabla</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Vista Tarjetas Agrupadas por Área"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Vista Tarjetas</span>
              </button>
            </div>

            {/* Search input */}
            <div className="relative min-w-[220px] sm:min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar proyecto o acción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Simultaneous Filters indicator */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
              <span className="font-semibold text-slate-600 text-[11px]">Filtros activos:</span>
              {selectedAreas.map((area) => (
                <span
                  key={area}
                  className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-md font-medium text-[11px]"
                >
                  Área: {area}
                  <button
                    onClick={() => setSelectedAreas(selectedAreas.filter((a) => a !== area))}
                    className="hover:text-blue-950 font-bold ml-0.5 text-xs cursor-pointer"
                    title={`Quitar área ${area}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedStates.map((st) => (
                <span
                  key={st}
                  className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-md font-medium text-[11px]"
                >
                  Estado: {st}
                  <button
                    onClick={() => setSelectedStates(selectedStates.filter((s) => s !== st))}
                    className="hover:text-blue-950 font-bold ml-0.5 text-xs cursor-pointer"
                    title={`Quitar estado ${st}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedPriorities.map((prio) => (
                <span
                  key={prio}
                  className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-medium text-[11px]"
                >
                  Prioridad #{prio}
                  <button
                    onClick={() => setSelectedPriorities(selectedPriorities.filter((p) => p !== prio))}
                    className="hover:text-amber-950 font-bold ml-0.5 text-xs cursor-pointer"
                    title={`Quitar prioridad #${prio}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {selectedProjectCodes.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded-md font-medium text-[11px]"
                >
                  N° Proy: {code}
                  <button
                    onClick={() => setSelectedProjectCodes(selectedProjectCodes.filter((c) => c !== code))}
                    className="hover:text-indigo-950 font-bold ml-0.5 text-xs cursor-pointer"
                    title={`Quitar proyecto ${code}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-medium text-[11px]">
                  Condición: {statusFilter === 'pending-actions' ? 'Con Acciones Pendientes' : 'Con Atraso'}
                  <button onClick={() => setStatusFilter('all')} className="hover:text-amber-950 font-bold ml-0.5 text-xs" title="Quitar filtro de condición">×</button>
                </span>
              )}
              {searchTerm.trim() !== '' && (
                <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-300 text-slate-800 px-2 py-0.5 rounded-md font-medium text-[11px]">
                  Búsqueda: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="hover:text-slate-950 font-bold ml-0.5 text-xs" title="Limpiar búsqueda">×</button>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600">
                Mostrando {filteredProjects.length} de {projects.length} proyectos
              </span>
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer todo</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grouped Area View */}
      {Object.keys(groupedByArea).length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">
            {projects.length === 0 ? 'Base de datos limpia y lista para importar' : 'No se encontraron proyectos'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            {projects.length === 0
              ? 'Se han eliminado todos los proyectos viejos de prueba. Ahora podés cargar la lista oficial de los 74 proyectos desde el botón "Google Sheets" en la barra superior o subir un archivo CSV.'
              : 'No hay proyectos que coincidan con la combinación de filtros seleccionada.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer filtros y ver todos los proyectos</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <WeeklyReviewTable
          projects={filteredProjects}
          currentUser={currentUser}
          onUpdateProject={onUpdateProject}
          onSelectProject={onSelectProject}
          onOpenAddAction={onOpenAddAction}
          onOpenEditAction={onOpenEditAction}
          onPreviewFile={onPreviewFile}
          onStateChange={handleStateChange}
          onPriorityChange={handlePriorityChange}
          onActionStatusChange={handleQuickActionStatusChange}
        />
      ) : (
        <div className="space-y-8">
          {(Object.entries(groupedByArea) as [string, SAPProject[]][]).map(([areaName, areaProjects]) => (
            <section key={areaName} className="space-y-4">
              {/* Area Section Title */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-6 bg-blue-600 rounded-full inline-block" />
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">{areaName}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {areaProjects.length} {areaProjects.length === 1 ? 'proyecto' : 'proyectos'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium hidden sm:block">
                  Priorización 1 a {areaProjects.length}
                </div>
              </div>

              {/* Projects Grid / Stack for this Area */}
              <div className="space-y-4">
                {areaProjects.map((project) => {
                  const health = storageService.getProjectHealth(project);
                  const activeActions = project.actions.filter(
                    (a) => a.status === 'Pendiente' || a.status === 'En proceso'
                  );
                  const completedActions = project.actions.filter((a) => a.status === 'Finalizada');

                  return (
                    <div
                      key={project.id}
                      className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all overflow-hidden"
                    >
                      {/* Top Bar of Project Card */}
                      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            {/* Area Priority Badge - Editable & Independent */}
                            <div className="flex flex-col items-center justify-center min-w-[54px] p-1.5 bg-white rounded-lg border border-slate-200 text-center shadow-2xs">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                Prior.
                              </span>
                              <div className="flex items-center justify-center mt-0.5">
                                <input
                                  type="number"
                                  min="1"
                                  max="99"
                                  disabled={!canUserAccessReportingAndPrioritization(currentUser)}
                                  value={project.priority ?? 1}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val) && val >= 1) {
                                      handlePriorityChange(project, val);
                                    }
                                  }}
                                  className={`w-10 text-center font-black text-sm rounded border py-0.5 px-0.5 focus:outline-none transition-colors ${
                                    canUserAccessReportingAndPrioritization(currentUser)
                                      ? 'text-blue-700 bg-slate-50 hover:bg-blue-50 focus:bg-white border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer'
                                      : 'text-slate-600 bg-slate-100 border-slate-200 cursor-not-allowed opacity-80'
                                  }`}
                                  title={
                                    canUserAccessReportingAndPrioritization(currentUser)
                                      ? "Prioridad manual del proyecto (PMO)"
                                      : "Prioridad del proyecto (Actividad exclusiva del PMO)"
                                  }
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-blue-900 text-white shadow-2xs border border-blue-950">
                                  {project.code}
                                </span>

                                {/* SAP Module tags */}
                                <div className="flex items-center gap-1 flex-wrap">
                                  {project.sapModules.map((mod) => {
                                    const modInfo = SAP_MODULES_DATA.find((m) => m.id === mod);
                                    return (
                                      <span
                                        key={mod}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                                          modInfo?.badgeBg || 'bg-slate-100 text-slate-700'
                                        }`}
                                      >
                                        {mod}
                                      </span>
                                    );
                                  })}
                                </div>

                                {/* Health badge */}
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
                                    health.overallStatus === 'Cancelado'
                                      ? 'bg-slate-100 text-slate-500 border border-slate-300'
                                      : health.overallStatus === 'Pendiente'
                                      ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                      : health.overallStatus === 'A tiempo'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : health.overallStatus === 'Demorado'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : health.overallStatus === 'En riesgo'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                                  }`}
                                >
                                  {health.overallStatus === 'Cancelado' && <Ban className="w-3 h-3 text-slate-400" />}
                                  {health.overallStatus === 'Pendiente' && <Clock className="w-3 h-3 text-slate-500" />}
                                  {health.overallStatus === 'A tiempo' && <CheckCircle2 className="w-3 h-3" />}
                                  {health.overallStatus === 'Demorado' && <AlertCircle className="w-3 h-3" />}
                                  {health.overallStatus === 'En riesgo' && <Clock className="w-3 h-3" />}
                                  {health.overallStatus === 'Pendiente' ? 'Pendiente' : health.overallStatus}
                                </span>
                              </div>

                              {/* Título del Proyecto con etiqueta explícita y edición rápida */}
                              <div className="pt-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded border border-slate-300/80">
                                    Título del Proyecto:
                                  </span>

                                  {editingTitleProjectId === project.id ? (
                                    <div className="flex items-center gap-1.5 flex-1 min-w-[280px]">
                                      <input
                                        type="text"
                                        value={tempTitle}
                                        onChange={(e) => setTempTitle(e.target.value)}
                                        className="flex-1 px-2.5 py-1 text-sm font-bold border-2 border-blue-500 rounded-lg bg-white focus:outline-none shadow-xs text-slate-900"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveTitle(project);
                                          if (e.key === 'Escape') setEditingTitleProjectId(null);
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSaveTitle(project)}
                                        className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                                      >
                                        Guardar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingTitleProjectId(null)}
                                        className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-300 transition-colors cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 group">
                                      <h4
                                        className="text-base font-bold text-slate-900 leading-snug hover:text-blue-600 transition-colors cursor-pointer"
                                        onClick={() => onSelectProject(project)}
                                        title="Ver ficha técnica y cronograma completo"
                                      >
                                        {project.title}
                                      </h4>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingTitleProjectId(project.id);
                                          setTempTitle(project.title);
                                        }}
                                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                                        title="Editar título del proyecto"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 block mt-0.5">
                                  Creado por: <strong className="text-slate-700">{project.createdBy || 'Administrador General'}</strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right Controls: State Selector & Details Button */}
                          <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
                            {/* Project State Selector */}
                            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                              <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                                Estado:
                              </span>
                              <select
                                value={project.state}
                                onChange={(e) => handleStateChange(project, e.target.value as ProjectState)}
                                className="bg-transparent text-xs font-bold text-blue-900 focus:outline-none cursor-pointer"
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
                            </div>

                            <button
                              onClick={() => onSelectProject(project)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                            >
                              <span>Ficha y Cronograma</span>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                          </div>
                        </div>

                        {/* Schedule progress mini-bar */}
                        <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700">Avance de Etapas:</span>
                            <div className="w-32 bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${health.completionPercentage}%` }}
                              />
                            </div>
                            <span className="font-bold text-slate-800">{health.completionPercentage}%</span>
                          </div>

                          <div className="flex items-center gap-4 text-[11px]">
                            <span>
                              <strong>{project.schedule.filter((s) => s.status === 'Completada').length}</strong> de {project.schedule.length} etapas concluidas
                            </span>
                            {health.delayedStagesCount > 0 && (
                              <span className="text-rose-600 font-semibold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {health.delayedStagesCount} etapa con desvío
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Section: Weekly Actions and Execution Comments */}
                      <div className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                              Acciones y Compromisos Semanales
                            </h5>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {activeActions.length} activas ({activeActions.filter((a) => a.status === 'Pendiente').length} pendientes, {activeActions.filter((a) => a.status === 'En proceso').length} en proceso)
                            </span>
                            {completedActions.length > 0 && (
                              <span 
                                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                                title={`${completedActions.length} acción(es) finalizada(s) no se muestran en la barrida semanal`}
                              >
                                {completedActions.length} finalizadas (ocultas)
                              </span>
                            )}
                          </div>

                          <button
                            disabled={!canUserAddAction(currentUser, project)}
                            onClick={() => onOpenAddAction(project)}
                            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors ${
                              canUserAddAction(currentUser, project)
                                ? 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 cursor-pointer'
                                : 'text-slate-400 bg-slate-100 border-slate-200 cursor-not-allowed opacity-75'
                            }`}
                            title={!canUserAddAction(currentUser, project) ? 'Solo miembros del equipo del proyecto o Admin pueden agregar acciones' : 'Agregar Acción'}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar Acción {!canUserAddAction(currentUser, project) && '(Solo miembros)'}</span>
                          </button>
                        </div>

                        {/* List of active actions only (Pendiente / En proceso) */}
                        {activeActions.length === 0 ? (
                          <div className="p-4 text-center rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-500">
                            {project.actions.length === 0 ? (
                              <>
                                No hay acciones registradas para este proyecto aún.{' '}
                                {canUserAddAction(currentUser, project) && (
                                  <button
                                    onClick={() => onOpenAddAction(project)}
                                    className="text-blue-600 font-semibold underline ml-1 hover:text-blue-800"
                                  >
                                    Agregar primera acción
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-600 font-medium">
                                ✓ No hay acciones pendientes ni en proceso. Todas las acciones de este proyecto ({completedActions.length}) están finalizadas.
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                            {activeActions.map((action) => {
                              const canEdit = canUserEditAction(currentUser, action);
                              const canDeleteAct = canUserDeleteAction(currentUser, action, project);
                              const isOverdue = isActionOverdue(action);
                              const isDueSoon = isActionDueSoon(action);

                              return (
                                <div
                                  key={action.id}
                                  className={`p-3 sm:p-4 text-xs transition-colors ${
                                    action.status === 'Finalizada'
                                      ? 'bg-slate-50/70 text-slate-500'
                                      : isOverdue
                                      ? 'bg-rose-50/30'
                                      : 'bg-white hover:bg-slate-50/50'
                                  }`}
                                >
                                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                    <div className="space-y-1.5 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {/* Status selector pill */}
                                        <div className="inline-flex items-center rounded-lg border border-slate-200 p-0.5 bg-white text-[11px]">
                                          {(['Pendiente', 'En proceso', 'Finalizada'] as const).map((st) => {
                                            const isActive = action.status === st;
                                            return (
                                              <button
                                                key={st}
                                                type="button"
                                                onClick={() => handleQuickActionStatusChange(project, action, st)}
                                                disabled={!canEdit}
                                                className={`px-2 py-0.5 rounded font-medium transition-all ${
                                                  isActive
                                                    ? st === 'Finalizada'
                                                      ? 'bg-emerald-600 text-white font-bold'
                                                      : st === 'En proceso'
                                                      ? 'bg-blue-600 text-white font-bold'
                                                      : 'bg-amber-500 text-white font-bold'
                                                    : canEdit
                                                    ? 'text-slate-600 hover:bg-slate-100'
                                                    : 'text-slate-400 cursor-not-allowed opacity-75'
                                                }`}
                                                title={
                                                  canEdit
                                                    ? `Cambiar estado a ${st}`
                                                    : `Solo ${action.responsible} o el Administrador pueden editar esta acción`
                                                }
                                              >
                                                {st}
                                              </button>
                                            );
                                          })}
                                        </div>

                                        {/* Stage Tag */}
                                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200" title="Etapa fijada al momento de creación de la acción">
                                          Etapa: {action.stageName}
                                        </span>

                                        {/* Required date */}
                                        <span
                                          className={`px-2 py-0.5 rounded font-medium text-[11px] flex items-center gap-1 ${
                                            action.status === 'Finalizada'
                                              ? 'bg-slate-100 text-slate-600'
                                              : isOverdue
                                              ? 'bg-rose-100 text-rose-800 font-bold'
                                              : isDueSoon
                                              ? 'bg-amber-100 text-amber-800 font-semibold'
                                              : 'bg-slate-100 text-slate-700'
                                          }`}
                                        >
                                          <Clock className="w-3 h-3" />
                                          Vence: {formatDateSpanish(action.requiredDate)}
                                          {isOverdue && ' (Vencida)'}
                                        </span>

                                        {/* Responsible */}
                                        <span className="flex items-center gap-1 text-slate-700 font-semibold text-[11px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                          <User className="w-3 h-3 text-slate-500" />
                                          {action.responsible}
                                        </span>

                                        <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                          Creada por: <strong>{action.createdBy || action.responsible}</strong>
                                        </span>
                                      </div>

                                      {/* Action Title */}
                                      <p className={`text-sm font-semibold ${
                                        action.status === 'Finalizada' ? 'line-through text-slate-400' : 'text-slate-900'
                                      }`}>
                                        {action.title}
                                      </p>

                                      {/* Execution Comment */}
                                      <div className="mt-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
                                        <div className="flex items-center gap-1.5 text-slate-500 font-medium mb-1">
                                          <MessageSquare className="w-3 h-3 text-blue-600" />
                                          <span className="text-[10px] uppercase font-bold text-slate-600">
                                            Comentario de ejecución / Avance:
                                          </span>
                                        </div>
                                        {action.executionComment ? (
                                          <p className="text-slate-800 italic pl-1 leading-relaxed">
                                            "{action.executionComment}"
                                          </p>
                                        ) : (
                                          <p className="text-slate-400 italic pl-1">
                                            Sin comentarios registrados aún por el responsable.
                                          </p>
                                        )}

                                        {/* Action Attachments */}
                                        {action.attachments && action.attachments.length > 0 && (
                                          <div className="mt-2 pt-1.5 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
                                            <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                                              <Paperclip className="w-3 h-3 text-blue-600" />
                                              Adjuntos ({action.attachments.length}):
                                            </span>
                                            {action.attachments.map((att) => (
                                              <div
                                                key={att.id}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-slate-50 text-blue-700 border border-slate-200 text-[11px] font-medium transition-colors shadow-2xs"
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
                                                  className="hover:underline hover:text-blue-900 truncate max-w-[130px] text-left"
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
                                      </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex md:flex-col items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => onOpenEditAction(project, action)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap ${
                                          canEdit
                                            ? 'bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-300'
                                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                                        }`}
                                      >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        <span>{canEdit ? 'Actualizar Comentario' : 'Ver Comentario'}</span>
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
                                          className="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded text-[11px] font-medium transition-colors flex items-center gap-1 border border-transparent hover:border-rose-200"
                                          title="Eliminar acción (Solo PMO o quien dio de alta el proyecto)"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>Eliminar</span>
                                        </button>
                                      )}

                                      {!canEdit && !canDeleteAct && (
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1" title="Solo editable por el responsable asignado o Administrador">
                                          <ShieldAlert className="w-3 h-3 text-slate-400" />
                                          Solo responsable
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
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

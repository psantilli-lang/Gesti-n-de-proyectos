import React, { useState, useEffect } from 'react';
import { 
  SAPProject, 
  SAPModule, 
  SAP_MODULES_DATA, 
  SAP_AREAS, 
  PROJECT_STAGES, 
  ALL_PROJECT_STATES, 
  ProjectState, 
  TeamMember, 
  AttachedFile, 
  StageSchedule,
  StageAction,
  UserSession
} from '../types/project';
import { storageService } from '../services/storageService';
import { 
  formatFileSize, 
  canUserAccessReportingAndPrioritization, 
  canUserCancelProject, 
  canUserEditProjectMetadata 
} from '../utils/helpers';
import { 
  X, 
  Plus, 
  Trash2, 
  Upload, 
  Paperclip, 
  Calendar, 
  Check, 
  Sparkles, 
  Users, 
  Layers, 
  FileText,
  ListTodo,
  Clock,
  User,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface ProjectFormModalProps {
  projectToEdit?: SAPProject | null;
  existingProjects: SAPProject[];
  currentUser?: UserSession;
  allUsers?: UserSession[];
  onClose: () => void;
  onSave: (project: SAPProject, options?: { openAddAction?: boolean }) => void;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  projectToEdit,
  existingProjects,
  currentUser,
  allUsers,
  onClose,
  onSave,
}) => {
  const isEditing = !!projectToEdit;
  const canPrioritize = canUserAccessReportingAndPrioritization(currentUser);
  const canCancel = canUserCancelProject(currentUser, projectToEdit || undefined);

  // Auto-generate code if new
  const [code, setCode] = useState<string>(() => {
    if (projectToEdit) return projectToEdit.code;
    return storageService.generateProjectCode(existingProjects);
  });

  const [area, setArea] = useState<string>(() => {
    if (projectToEdit) return projectToEdit.area;
    return SAP_AREAS[0];
  });

  const [customArea, setCustomArea] = useState<string>('');

  const [priority, setPriority] = useState<number>(() => {
    if (projectToEdit) return projectToEdit.priority;
    return storageService.getNextPriorityForArea(existingProjects, SAP_AREAS[0]);
  });

  const [sapModules, setSapModules] = useState<SAPModule[]>(() => {
    if (projectToEdit) return projectToEdit.sapModules;
    return ['PP'];
  });

  const [title, setTitle] = useState<string>(projectToEdit?.title || '');
  const [currentSituation, setCurrentSituation] = useState<string>(projectToEdit?.currentSituation || '');
  const [currentSituationFiles, setCurrentSituationFiles] = useState<AttachedFile[]>(
    projectToEdit?.currentSituationFiles || []
  );

  const [improvementNeed, setImprovementNeed] = useState<string>(projectToEdit?.improvementNeed || '');
  const [improvementNeedFiles, setImprovementNeedFiles] = useState<AttachedFile[]>(
    projectToEdit?.improvementNeedFiles || []
  );

  const [state, setState] = useState<ProjectState>(() => {
    if (projectToEdit) return projectToEdit.state;
    return '01- Pendiente';
  });

  const [team, setTeam] = useState<TeamMember[]>(() => {
    if (projectToEdit && projectToEdit.team) return projectToEdit.team;
    return [
      { id: 'tm-1', name: '', role: 'Líder de Proyecto' },
      { id: 'tm-2', name: '', role: 'Consultor SAP' },
    ];
  });

  // 7 Stages Estimated Schedule
  const [schedule, setSchedule] = useState<StageSchedule[]>(() => {
    if (projectToEdit && projectToEdit.schedule) return projectToEdit.schedule;
    return storageService.createDefaultSchedules();
  });

  // Actions list for the project
  const [actions, setActions] = useState<StageAction[]>(() => {
    if (projectToEdit && projectToEdit.actions) return projectToEdit.actions;
    return [];
  });

  // State for inline action creation inside Section 5
  const [isAddingActionInline, setIsAddingActionInline] = useState<boolean>(false);
  const [inlineTitle, setInlineTitle] = useState<string>('');
  const [inlineResponsible, setInlineResponsible] = useState<string>('');
  const [inlineCustomResp, setInlineCustomResp] = useState<string>('');
  const [inlineRequiredDate, setInlineRequiredDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [inlineComment, setInlineComment] = useState<string>('');
  const [openAddActionAfterSave, setOpenAddActionAfterSave] = useState<boolean>(false);

  // When area changes and creating new project, recompute priority for that area
  const handleAreaChange = (newArea: string) => {
    setArea(newArea);
    if (!isEditing) {
      const nextP = storageService.getNextPriorityForArea(existingProjects, newArea);
      setPriority(nextP);
    }
  };

  const handleModuleToggle = (mod: SAPModule) => {
    if (sapModules.includes(mod)) {
      if (sapModules.length > 1) {
        setSapModules(sapModules.filter((m) => m !== mod));
      }
    } else {
      setSapModules([...sapModules, mod]);
    }
  };

  // Team member manipulation
  const handleAddTeamMember = () => {
    setTeam([
      ...team,
      { id: `tm-${Date.now()}`, name: '', role: 'Key User' },
    ]);
  };

  const handleUpdateTeamMember = (id: string, field: 'name' | 'role', val: string) => {
    setTeam(
      team.map((m) => (m.id === id ? { ...m, [field]: val } : m))
    );
  };

  const handleRemoveTeamMember = (id: string) => {
    if (team.length > 1) {
      setTeam(team.filter((m) => m.id !== id));
    }
  };

  // Schedule stage date modification
  const handleScheduleDateChange = (
    stageId: number,
    field: 'estimatedStartDate' | 'estimatedEndDate',
    val: string
  ) => {
    setSchedule(
      schedule.map((s) => (s.stageId === stageId ? { ...s, [field]: val } : s))
    );
  };

  // File Upload Helper
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'currentSituation' | 'improvementNeed'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const newFile: AttachedFile = {
        id: `att-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString().split('T')[0],
        dataUrl: reader.result as string,
      };

      if (target === 'currentSituation') {
        setCurrentSituationFiles((prev) => [...prev, newFile]);
      } else {
        setImprovementNeedFiles((prev) => [...prev, newFile]);
      }
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddInlineAction = () => {
    if (!inlineTitle.trim()) {
      alert('Por favor ingrese la descripción de la acción');
      return;
    }

    // Automatically assign stage from the project's current state at this moment
    const currentActiveStage =
      PROJECT_STAGES.find((s) => s.name === state) ||
      schedule.find((s) => s.stageName === state) ||
      PROJECT_STAGES[0];

    const finalResp =
      inlineResponsible === '__custom__'
        ? inlineCustomResp.trim() || 'Consultor SAP'
        : inlineResponsible.trim() || team[0]?.name || currentUser?.name || 'Responsable';

    const newAct: StageAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      stageId: currentActiveStage.id,
      stageName: currentActiveStage.name,
      title: inlineTitle.trim(),
      requiredDate: inlineRequiredDate,
      responsible: finalResp,
      status: 'Pendiente',
      executionComment: inlineComment.trim() || undefined,
      commentsHistory: inlineComment.trim()
        ? [
            {
              id: `c-${Date.now()}`,
              author: currentUser?.name || finalResp,
              date: new Date().toISOString().split('T')[0],
              text: inlineComment.trim(),
            },
          ]
        : [],
      createdAt: new Date().toISOString().split('T')[0],
    };

    setActions((prev) => [...prev, newAct]);
    setInlineTitle('');
    setInlineComment('');
    setIsAddingActionInline(false);
  };

  const handleRemoveInlineAction = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSaveAndSubmit = (openAddActionModal: boolean) => {
    if (!title.trim()) {
      alert('Por favor ingrese el título del proyecto');
      return;
    }

    if (projectToEdit && !canUserEditProjectMetadata(currentUser, projectToEdit)) {
      alert('Permiso denegado: La información general del proyecto solo puede ser modificada por el PMO o por quien dio de alta el proyecto.');
      return;
    }

    if ((state === '8- Cancelado' || state === '08- Cancelado') && !canCancel) {
      alert('Permiso denegado: El cambio de estado a "8- Cancelado" es exclusivo del rol PMO.');
      return;
    }

    const finalArea = area === '__custom__' ? customArea.trim() || 'General' : area;

    const newProject: SAPProject = {
      id: projectToEdit ? projectToEdit.id : `prj-${Date.now()}`,
      code,
      area: finalArea,
      sapModules,
      title: title.trim(),
      currentSituation: currentSituation.trim(),
      currentSituationFiles,
      improvementNeed: improvementNeed.trim(),
      improvementNeedFiles,
      team: team.filter((m) => m.name.trim() !== ''),
      priority: Number(priority) || 1,
      state,
      schedule,
      actions,
      createdAt: projectToEdit ? projectToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: projectToEdit ? (projectToEdit.createdBy || currentUser?.name || 'Administrador General') : (currentUser?.name || 'Administrador General'),
    };

    onSave(newProject, { openAddAction: openAddActionModal || openAddActionAfterSave });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveAndSubmit(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {isEditing ? 'Modificar Proyecto de Mejora' : 'Alta de Nuevo Proyecto SAP'}
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
              {isEditing ? `Editar: ${projectToEdit.code}` : 'Formulario de Alta de Proyecto'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-800">
          
          {/* Section 1: Identifiers, Area, Priority & Modules */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              1. Identificación, Área y Módulos SAP
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Código Autogenerado */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Código de Proyecto (Trazabilidad):
                </label>
                <input
                  type="text"
                  value={code}
                  readOnly
                  className="w-full bg-slate-200/80 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Autogenerado automáticamente
                </span>
              </div>

              {/* Área a la que pertenece */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Área a la que pertenece:
                </label>
                <select
                  value={area}
                  onChange={(e) => handleAreaChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {SAP_AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                  <option key="custom-area-option" value="__custom__">+ Otra Área...</option>
                </select>

                {area === '__custom__' && (
                  <input
                    type="text"
                    placeholder="Escriba el nombre del área..."
                    value={customArea}
                    onChange={(e) => setCustomArea(e.target.value)}
                    className="mt-2 w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                  />
                )}
              </div>

              {/* Prioridad en el área */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Prioridad en el Área (1 a XX):
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  disabled={!canPrioritize}
                  value={priority}
                  onChange={(e) => {
                    if (canPrioritize) setPriority(Number(e.target.value));
                  }}
                  className={`w-full border rounded-lg px-3 py-2 text-xs font-bold focus:outline-none ${
                    canPrioritize
                      ? 'bg-white border-slate-300 text-blue-700 focus:ring-1 focus:ring-blue-500 cursor-pointer'
                      : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title={canPrioritize ? 'Prioridad en el área' : 'Priorización exclusiva del PMO'}
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  {canPrioritize
                    ? 'Prioridad relativa a los proyectos del área'
                    : 'Prioridad asignada automáticamente (Gestión exclusiva del PMO)'}
                </span>
              </div>
            </div>

            {/* Módulos SAP Multi-Selección */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                Procesos y Módulos SAP Involucrados (Seleccionar uno o más):
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {SAP_MODULES_DATA.map((mod) => {
                  const isSelected = sapModules.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => handleModuleToggle(mod.id)}
                      className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <span className="font-mono font-extrabold text-sm">{mod.id}</span>
                      <span className={`text-[10px] leading-tight ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                        {mod.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Permite proyectos donde interactúan varios módulos (ej: PP + MM + WM + QM).
              </span>
            </div>

            {/* Título del proyecto */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Título del Proyecto o Tema:
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Automatización de Lotes de Inspección en Recepción y Conexión con MIGO"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Estado Inicial */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Estado Inicial del Proyecto ({ALL_PROJECT_STATES.length} Estados):
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value as ProjectState)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
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
          </div>

          {/* Section 2: Situación Actual & Necesidad de Mejora with File Uploads */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              2. Diagnóstico: Situación Actual y Necesidad de Mejora (con Adjuntos)
            </h3>

            {/* Situación Actual */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">
                  Situación Actual (Diagnóstico del problema o punto de partida):
                </label>
                <label className="cursor-pointer text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Adjuntar Archivo</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'currentSituation')}
                  />
                </label>
              </div>

              <textarea
                rows={3}
                placeholder="Describa el funcionamiento actual, cuellos de botella, planillas manuales, etc..."
                value={currentSituation}
                onChange={(e) => setCurrentSituation(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              {currentSituationFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {currentSituationFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-[11px]"
                    >
                      <Paperclip className="w-3 h-3 text-blue-500" />
                      <span className="font-medium text-slate-800 truncate max-w-[200px]">{f.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentSituationFiles(currentSituationFiles.filter((x) => x.id !== f.id))
                        }
                        className="text-slate-400 hover:text-rose-600 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Necesidad de Mejora */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-700">
                  Necesidad de Mejora (Objetivos, solución esperada en SAP):
                </label>
                <label className="cursor-pointer text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Adjuntar Archivo</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'improvementNeed')}
                  />
                </label>
              </div>

              <textarea
                rows={3}
                placeholder="Describa la solución propuesta, módulos, transacciones o parametrizaciones a implementar..."
                value={improvementNeed}
                onChange={(e) => setImprovementNeed(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />

              {improvementNeedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {improvementNeedFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-[11px]"
                    >
                      <Paperclip className="w-3 h-3 text-emerald-500" />
                      <span className="font-medium text-slate-800 truncate max-w-[200px]">{f.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setImprovementNeedFiles(improvementNeedFiles.filter((x) => x.id !== f.id))
                        }
                        className="text-slate-400 hover:text-rose-600 ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Equipo de Proyecto */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                3. Equipo de Proyecto
              </h3>
              <button
                type="button"
                onClick={handleAddTeamMember}
                className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Integrante</span>
              </button>
            </div>

            <div className="space-y-2">
              {team.map((member) => (
                <div key={member.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nombre y Apellido (ej: Ing. Juan Gómez)"
                    value={member.name}
                    onChange={(e) => handleUpdateTeamMember(member.id, 'name', e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Rol (ej: Líder Funcional, Consultor SAP, Key User)"
                    value={member.role}
                    onChange={(e) => handleUpdateTeamMember(member.id, 'role', e.target.value)}
                    className="w-48 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {team.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTeamMember(member.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Cronograma Estimado por Etapas */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" />
                4. Cronograma Estimado de Duración por Etapa
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Cargue las fechas estimadas de inicio y fin de cada una de las 6 etapas al dar de alta el proyecto:
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="py-2 px-3">Código</th>
                    <th className="py-2 px-3">Etapa</th>
                    <th className="py-2 px-3">Fecha Estimada Inicio</th>
                    <th className="py-2 px-3">Fecha Estimada Fin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedule.map((st) => (
                    <tr key={st.stageId}>
                      <td className="py-2 px-3 font-mono font-bold text-blue-700">
                        {st.stageName.split('-')[0] || `0${st.stageId}`}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-800">
                        {st.stageName}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={st.estimatedStartDate}
                          onChange={(e) =>
                            handleScheduleDateChange(st.stageId, 'estimatedStartDate', e.target.value)
                          }
                          className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={st.estimatedEndDate}
                          onChange={(e) =>
                            handleScheduleDateChange(st.stageId, 'estimatedEndDate', e.target.value)
                          }
                          className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Acciones y Tareas Iniciales */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ListTodo className="w-4 h-4 text-blue-600" />
                  5. Acciones y Tareas del Proyecto
                  {actions.length > 0 && (
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                      {actions.length} {actions.length === 1 ? 'acción cargada' : 'acciones cargadas'}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cargue las tareas y compromisos de arranque con su etapa, responsable y fecha límite:
                </p>
              </div>

              {!isAddingActionInline && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingActionInline(true);
                    if (!inlineResponsible) {
                      const firstResp = team.find((m) => m.name.trim() !== '')?.name || currentUser?.name || '';
                      setInlineResponsible(firstResp);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors self-start sm:self-auto shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Agregar Acción</span>
                </button>
              )}
            </div>

            {/* Inline Action Form */}
            {isAddingActionInline && (
              <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3 shadow-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-xs text-blue-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Cargar Nueva Acción para este Proyecto
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingActionInline(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Etapa asignada:</span>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                        Automática (Estado actual)
                      </span>
                    </label>
                    <div className="w-full bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-900 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                          {state.split('-')[0] || '01'}
                        </span>
                        <span>{state}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-normal italic hidden sm:inline">
                        Definitiva para esta acción
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                      La etapa se toma automáticamente del estado actual del proyecto al momento de carga y queda fija para esta acción.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      Fecha Límite Requerida:
                    </label>
                    <input
                      type="date"
                      value={inlineRequiredDate}
                      onChange={(e) => setInlineRequiredDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Descripción de la Acción / Tarea Requerida:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ej: Levantar requerimiento con compras y programar pruebas en mandante QAS..."
                    value={inlineTitle}
                    onChange={(e) => setInlineTitle(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      Responsable de la Acción:
                    </label>
                    <select
                      value={inlineResponsible}
                      onChange={(e) => setInlineResponsible(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {currentUser && (
                        <option key={`current-user-${currentUser.id || currentUser.name}`} value={currentUser.name}>
                          {currentUser.name} (Usuario Actual - {currentUser.role})
                        </option>
                      )}
                      {team
                        .filter((m) => m.name.trim() !== '' && (!currentUser || m.name !== currentUser.name))
                        .map((m) => (
                          <option key={`team-${m.id}`} value={m.name}>
                            {m.name} ({m.role})
                          </option>
                        ))}
                      {allUsers &&
                        allUsers
                          .filter(
                            (u) =>
                              (!currentUser || u.name !== currentUser.name) &&
                              !team.some((t) => t.name === u.name)
                          )
                          .map((u) => (
                            <option key={`alluser-${u.id}`} value={u.name}>
                              {u.name} ({u.role})
                            </option>
                          ))}
                      <option key="custom-resp-option" value="__custom__">
                        + Otro responsable personalizado...
                      </option>
                    </select>

                    {inlineResponsible === '__custom__' && (
                      <input
                        type="text"
                        placeholder="Nombre y apellido del responsable..."
                        value={inlineCustomResp}
                        onChange={(e) => setInlineCustomResp(e.target.value)}
                        className="mt-1.5 w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Comentario Inicial (Opcional):
                    </label>
                    <input
                      type="text"
                      placeholder="Nota u observación inicial de la tarea..."
                      value={inlineComment}
                      onChange={(e) => setInlineComment(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddingActionInline(false)}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleAddInlineAction}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar Acción</span>
                  </button>
                </div>
              </div>
            )}

            {/* Actions Table / List */}
            {actions.length > 0 ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Etapa</th>
                      <th className="py-2 px-3">Descripción de la Tarea</th>
                      <th className="py-2 px-3">Responsable</th>
                      <th className="py-2 px-3">Fecha Límite</th>
                      <th className="py-2 px-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {actions.map((act) => (
                      <tr key={act.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3">
                          <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {act.stageName}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-900 max-w-xs truncate">
                          {act.title}
                        </td>
                        <td className="py-2 px-3 text-slate-700 font-medium">
                          {act.responsible}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {act.requiredDate}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveInlineAction(act.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                            title="Eliminar acción"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !isAddingActionInline && (
                <div className="p-3 bg-white rounded-lg border border-dashed border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-slate-500 text-xs">
                    <ListTodo className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      No hay acciones cargadas aún. Puede cargarlas aquí o utilizar el botón <strong>"Guardar y Cargar Acciones"</strong>.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingActionInline(true);
                      if (!inlineResponsible) {
                        const firstResp = team.find((m) => m.name.trim() !== '')?.name || currentUser?.name || '';
                        setInlineResponsible(firstResp);
                      }
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0 self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" /> Cargar acción ahora
                  </button>
                </div>
              )
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none self-start sm:self-auto">
              <input
                type="checkbox"
                checked={openAddActionAfterSave}
                onChange={(e) => setOpenAddActionAfterSave(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <span>Abrir ventana para cargar más acciones al guardar</span>
            </label>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg text-xs transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleSaveAndSubmit(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
              >
                {isEditing ? 'Guardar Cambios' : 'Guardar y Dar de Alta'}
              </button>

              <button
                type="button"
                onClick={() => handleSaveAndSubmit(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{isEditing ? 'Guardar y Cargar Acciones' : 'Guardar y Cargar Acciones'}</span>
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};

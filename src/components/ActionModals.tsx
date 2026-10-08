import React, { useState } from 'react';
import { 
  SAPProject, 
  StageAction, 
  UserSession, 
  AppUser,
  ActionStatus, 
  ActionComment,
  AttachedFile,
  PROJECT_STAGES
} from '../types/project';
import { storageService } from '../services/storageService';
import { 
  canUserEditAction, 
  canUserAddAction,
  canUserDeleteAction,
  canUserEditActionDefinition,
  isPMO,
  formatDateSpanish, 
  formatFileSize 
} from '../utils/helpers';
import { 
  X, 
  Clock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare, 
  Plus, 
  ShieldCheck, 
  ShieldAlert,
  Paperclip,
  Upload,
  Download,
  Trash2,
  FileText,
  Eye,
  Edit3,
} from 'lucide-react';

// MODAL PARA AGREGAR NUEVA ACCIÓN
interface AddActionModalProps {
  project: SAPProject;
  defaultStageId?: number;
  currentUser: UserSession;
  allUsers?: (UserSession | AppUser)[];
  onClose: () => void;
  onAddAction: (newAction: StageAction, keepOpen?: boolean) => void;
  onPreviewFile?: (file: AttachedFile, projectTitle?: string) => void;
}

export const AddActionModal: React.FC<AddActionModalProps> = ({
  project,
  defaultStageId,
  currentUser,
  allUsers,
  onClose,
  onAddAction,
  onPreviewFile,
}) => {
  const canAdd = canUserAddAction(currentUser, project);

  // Automatically assign stage from the project's current state at this moment
  const currentStageObj =
    (defaultStageId ? project.schedule.find((s) => s.stageId === defaultStageId) : null) ||
    PROJECT_STAGES.find((s) => s.name === project.state) ||
    project.schedule.find((s) => s.stageName === project.state) ||
    project.schedule[0] ||
    PROJECT_STAGES[0];

  const assignedStageId =
    'id' in currentStageObj ? currentStageObj.id : currentStageObj.stageId;
  const assignedStageName =
    'name' in currentStageObj ? currentStageObj.name : currentStageObj.stageName;

  const [title, setTitle] = useState<string>('');
  
  // Default required date to 7 days from now
  const [requiredDate, setRequiredDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  // 100% of app users guaranteed (combining storageService and props)
  const allAppUsers = React.useMemo(() => {
    const map = new Map<string, { name: string; email?: string; role?: string }>();
    try {
      storageService.getUsers().forEach((u) => {
        if (u.name && u.name.trim()) {
          map.set(u.name.trim().toLowerCase(), {
            name: u.name.trim(),
            email: u.email,
            role: u.role,
          });
        }
      });
    } catch {}

    if (allUsers) {
      allUsers.forEach((u) => {
        if (u.name && u.name.trim()) {
          const key = u.name.trim().toLowerCase();
          const existing = map.get(key);
          map.set(key, {
            name: u.name.trim(),
            email: u.email || existing?.email,
            role: u.role || existing?.role,
          });
        }
      });
    }

    if (currentUser?.name && currentUser.name.trim()) {
      const key = currentUser.name.trim().toLowerCase();
      const existing = map.get(key);
      map.set(key, {
        name: currentUser.name.trim(),
        email: currentUser.email || existing?.email,
        role: currentUser.role || existing?.role,
      });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allUsers, currentUser]);

  // Responsible person options from 100% of app users + project team
  const responsibleOptions = React.useMemo(() => {
    const map = new Map<string, { name: string; email?: string; role?: string }>();

    // 100% of app users
    allAppUsers.forEach((u) => {
      map.set(u.name.trim().toLowerCase(), {
        name: u.name.trim(),
        email: u.email,
        role: u.role,
      });
    });

    // Project team members (in case someone was added manually)
    (project.team || []).forEach((t) => {
      if (t.name && t.name.trim()) {
        const key = t.name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: t.name.trim(),
            email: t.email,
            role: t.role,
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allAppUsers, project.team]);

  const [responsible, setResponsible] = useState<string>(() => {
    if (responsibleOptions.length > 0) return responsibleOptions[0].name;
    return currentUser?.name || 'Responsable';
  });

  const [customResponsible, setCustomResponsible] = useState<string>('');
  const [customResponsibleEmail, setCustomResponsibleEmail] = useState<string>('');
  const [initialComment, setInitialComment] = useState<string>('');
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleFilesAdded = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const newFile: AttachedFile = {
          id: `att-act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString().split('T')[0],
          dataUrl: reader.result as string,
        };
        setAttachments((prev) => [...prev, newFile]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCreateAction = (keepOpen: boolean) => {
    if (!canAdd) {
      alert('Permiso denegado: Solo los miembros del equipo del proyecto pueden agregar nuevas acciones.');
      return;
    }

    if (!title.trim()) {
      alert('Por favor ingrese la descripción o título de la acción');
      return;
    }

    const finalResp =
      responsible === '__custom__'
        ? customResponsibleEmail.trim()
          ? `${customResponsible.trim()} (${customResponsibleEmail.trim()})`
          : customResponsible.trim()
        : responsible;

    const newAction: StageAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      stageId: assignedStageId,
      stageName: assignedStageName,
      title: title.trim(),
      requiredDate,
      responsible: finalResp || currentUser?.name || 'Responsable',
      status: 'Pendiente',
      executionComment: initialComment.trim(),
      commentsHistory: initialComment.trim()
        ? [
            {
              id: `c-${Date.now()}`,
              author: currentUser?.name || 'Usuario',
              date: new Date().toISOString().split('T')[0],
              text: initialComment.trim(),
            },
          ]
        : [],
      attachments,
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: currentUser?.name || 'Usuario',
    };

    onAddAction(newAction, keepOpen);

    if (keepOpen) {
      setTitle('');
      setInitialComment('');
      setAttachments([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCreateAction(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block">
              {project.code}
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              Agregar Nueva Acción de Mejora
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!canAdd && (
          <div className="bg-amber-50 border-b border-amber-200 p-3 px-6 flex items-center gap-2 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <p>
              <strong>Acceso restringido:</strong> Solo los miembros del equipo asignados a este proyecto o el Administrador pueden agregar nuevas acciones.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-slate-800">
          {/* Stage display - automatic from current project state */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Etapa asignada:</span>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                Automática (Estado actual)
              </span>
            </label>
            <div className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                  {assignedStageName.split('-')[0] || '01'}
                </span>
                <span>{assignedStageName}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-normal italic">
                Definitiva para esta acción
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-tight">
              La acción queda registrada de forma definitiva en la etapa actual (<strong>{assignedStageName}</strong>). Si el proyecto avanza luego a otras etapas, esta acción conservará su etapa original intacta.
            </p>
          </div>

          {/* Action Title */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Descripción de la Acción / Tarea Requerida:
            </label>
            <textarea
              required
              rows={2}
              placeholder="Ej: Parametrizar tipos de movimientos y rutas de confirmación en QAS..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Required Date & Responsible */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Fecha Requerida (Límite):
              </label>
              <input
                type="date"
                required
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-600" />
                Persona Responsable:
              </label>
              <select
                value={responsible}
                onChange={(e) => {
                  const val = e.target.value;
                  setResponsible(val);
                  if (val !== '__custom__') {
                    const match = responsibleOptions.find((o) => o.name === val);
                    if (match?.email) {
                      setCustomResponsibleEmail(match.email);
                    }
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">-- Seleccionar Responsable ({responsibleOptions.length} usuarios) --</option>
                {responsibleOptions.map((opt) => (
                  <option key={opt.name} value={opt.name}>
                    {opt.name} {opt.email ? `• ${opt.email}` : ''} {opt.role ? `(${opt.role})` : ''}
                  </option>
                ))}
                <option value="__custom__">+ Otro responsable personalizado...</option>
              </select>

              {responsible === '__custom__' && (
                <div className="mt-2 space-y-1.5">
                  <input
                    type="text"
                    placeholder="Nombre del responsable..."
                    value={customResponsible}
                    onChange={(e) => setCustomResponsible(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800"
                  />
                  <input
                    type="email"
                    placeholder="Email de notificación (ej: consultor@gmail.com, usuario@empresa.com)"
                    value={customResponsibleEmail}
                    onChange={(e) => setCustomResponsibleEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-blue-700 font-medium"
                    title="Cualquier dominio (@gmail, @outlook, @empresa, etc.)"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Initial Execution Comment */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Comentario inicial de avance (Opcional):
            </label>
            <textarea
              rows={2}
              placeholder="Detalle de la acción tomada o plan de ejecución..."
              value={initialComment}
              onChange={(e) => setInitialComment(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Optional Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-700 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                <span>Adjuntar Archivos (Opcional):</span>
                {attachments.length > 0 && (
                  <span className="text-[11px] font-normal text-slate-500">
                    ({attachments.length})
                  </span>
                )}
              </label>

              <label className="cursor-pointer text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Explorar</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFilesAdded(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFilesAdded(e.dataTransfer.files);
              }}
              className={`relative border-2 border-dashed rounded-xl p-3 text-center transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/70 text-blue-800'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <Upload className={`w-4 h-4 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-blue-600 cursor-pointer hover:underline">
                    Seleccionar archivos
                  </span>{' '}
                  o arrastrar aquí
                </p>
                <p className="text-[10px] text-slate-400">PDF, Excel, Word, imágenes o minutas</p>
              </div>
              <input
                type="file"
                multiple
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                onChange={(e) => {
                  handleFilesAdded(e.target.files);
                  e.target.value = '';
                }}
                title=""
              />
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                      <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <button
                        type="button"
                        onClick={() => {
                          if (onPreviewFile) {
                            onPreviewFile(file, project.title);
                          }
                        }}
                        className="font-medium text-slate-800 hover:text-blue-600 hover:underline truncate text-left"
                        title={`Previsualizar ${file.name}`}
                      >
                        {file.name}
                      </button>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {onPreviewFile && (
                        <button
                          type="button"
                          onClick={() => onPreviewFile(file, project.title)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                          title="Previsualizar archivo"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setAttachments(attachments.filter((f) => f.id !== file.id))}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Eliminar archivo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleCreateAction(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>Crear y Agregar Otra</span>
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              Crear Acción
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// MODAL PARA EDITAR ESTADO, COMENTARIO Y DETALLES DE ACCIÓN
interface EditActionModalProps {
  project: SAPProject;
  action: StageAction;
  currentUser: UserSession;
  allUsers?: AppUser[];
  onUpdateCurrentUser?: (user: UserSession) => void;
  onClose: () => void;
  onSaveAction: (updatedAction: StageAction) => void;
  onDeleteAction?: (actionId: string) => void;
  onSwitchUser?: (user: UserSession) => void;
  onPreviewFile?: (file: AttachedFile, projectTitle?: string) => void;
}

export const EditActionModal: React.FC<EditActionModalProps> = ({
  project,
  action,
  currentUser,
  allUsers = [],
  onUpdateCurrentUser,
  onClose,
  onSaveAction,
  onDeleteAction,
  onPreviewFile,
}) => {
  const [pmoOverride, setPmoOverride] = useState<boolean>(false);

  const isPmo = isPMO(currentUser) || pmoOverride;
  const canEdit = isPmo || canUserEditAction(currentUser, action);
  const canEditDefinition = isPmo || canUserEditActionDefinition(currentUser, action);
  const userOptions = allUsers && allUsers.length > 0 ? allUsers : storageService.getUsers();

  const handleEnablePmo = () => {
    // If user's account name or email is already Paola Santilli, auto-promote immediately
    const n = (currentUser.name || '').toLowerCase();
    const e = (currentUser.email || '').toLowerCase();
    const u = (currentUser.username || '').toLowerCase();

    if (
      n.includes('santilli') ||
      n.includes('paola') ||
      n.includes('pmo') ||
      e.includes('santilli') ||
      e.includes('psantilli') ||
      e === 'psantilli@crucianelli.com' ||
      u === 'psantilli' ||
      u === 'pmo' ||
      u === 'admin'
    ) {
      setPmoOverride(true);
      const promoted: UserSession = { ...currentUser, role: 'admin' };
      storageService.setCurrentUser(promoted);
      if (onUpdateCurrentUser) onUpdateCurrentUser(promoted);
      return;
    }

    const pass = prompt('Ingresá la clave de PMO (o admin) para habilitar permisos de edición:');
    if (pass === null) return;
    const cleanPass = pass.trim();
    if (
      cleanPass === 'admin' ||
      cleanPass === 'pmo' ||
      cleanPass === '123' ||
      cleanPass === 'pmo123' ||
      cleanPass === 'admin123'
    ) {
      setPmoOverride(true);
      const promoted: UserSession = { ...currentUser, role: 'pmo' };
      storageService.setCurrentUser(promoted);
      if (onUpdateCurrentUser) onUpdateCurrentUser(promoted);
      alert('¡Permisos de PMO activados! Ahora podés asignar responsables, cambiar fechas y editar la acción.');
    } else {
      alert('Contraseña incorrecta. (Clave estándar: "pmo" o "admin").');
    }
  };

  const [title, setTitle] = useState<string>(action.title);
  const [responsible, setResponsible] = useState<string>(action.responsible);
  const [stageId, setStageId] = useState<number>(action.stageId);
  const [status, setStatus] = useState<ActionStatus>(action.status);
  const [requiredDate, setRequiredDate] = useState<string>(action.requiredDate);
  const [executionComment, setExecutionComment] = useState<string>(
    action.executionComment || ''
  );
  const [newCommentNote, setNewCommentNote] = useState<string>('');
  const [attachments, setAttachments] = useState<AttachedFile[]>(
    action.attachments || []
  );
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleFilesAdded = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const newFile: AttachedFile = {
          id: `att-act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString().split('T')[0],
          dataUrl: reader.result as string,
        };
        setAttachments((prev) => [...prev, newFile]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAttachment = (fileId: string) => {
    setAttachments((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      alert(`Permiso denegado: Solo el responsable asignado (${action.responsible}) o el Administrador pueden editar esta acción.`);
      return;
    }

    const updatedComments = [...(action.commentsHistory || [])];
    if (newCommentNote.trim()) {
      updatedComments.push({
        id: `c-${Date.now()}`,
        author: currentUser?.name || 'Usuario',
        date: new Date().toISOString().split('T')[0],
        text: newCommentNote.trim(),
      });
    }

    const finalComment = newCommentNote.trim()
      ? newCommentNote.trim()
      : executionComment;

    const finalTitle = title.trim() || action.title;
    const finalResponsible = responsible.trim() || action.responsible;
    const matchedStage = PROJECT_STAGES.find((s) => s.id === stageId);
    const finalStageName = matchedStage ? matchedStage.name : action.stageName;

    const isExplicitlyUnassigned = finalResponsible === 'Sin asignar' || finalResponsible.trim() === '';
    const updatedAction: StageAction = {
      ...action,
      title: finalTitle,
      responsible: finalResponsible,
      stageId: stageId,
      stageName: finalStageName,
      status,
      requiredDate,
      executionComment: finalComment,
      completedAt: status === 'Finalizada' ? (action.completedAt || new Date().toISOString()) : undefined,
      commentsHistory: updatedComments,
      attachments,
      updatedAt: new Date().toISOString(),
      explicitlyUnassigned: isExplicitlyUnassigned,
    };

    onSaveAction(updatedAction);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block">
              {project.code} • {action.stageName || `Etapa ${action.stageId}`}
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              Actualizar Acción y Comentarios
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permission status banner */}
        {!canEdit ? (
          <div className="bg-amber-50 border-b border-amber-200 p-3 px-6 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <p>
                <strong>Modo Sólo Lectura:</strong> Acción asignada a <strong>{action.responsible}</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleEnablePmo}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Habilitar permisos de PMO para asignar responsable y editar la acción"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Soy el PMO (Habilitar Edición)</span>
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border-b border-emerald-200 p-2.5 px-6 flex items-center gap-2 text-xs text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Tenés permisos para editar como <strong>{currentUser?.name || 'Usuario'}</strong>{isPmo ? ' (Rol PMO activo)' : ''}.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-slate-800">
          {/* Action Title / Description (Editable for PMO to fix typos or adjust description) */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <Edit3 className="w-3 h-3 text-blue-600" />
                <span>Acción Definida (Texto / Descripción):</span>
              </label>
              {canEditDefinition && (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded shadow-2xs">
                  {isPmo ? 'Edición PMO habilitada' : 'Edición habilitada'}
                </span>
              )}
            </div>

            {canEditDefinition ? (
              <div>
                <textarea
                  rows={2}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs leading-snug"
                  placeholder="Escribí el texto de la acción (podés corregir faltas de ortografía o redacción)..."
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Acceso habilitado para corregir errores de ortografía, redacción o el detalle de la acción.
                </p>
              </div>
            ) : (
              <p className="text-sm font-bold text-slate-900 leading-snug">
                {action.title}
              </p>
            )}

            <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {/* Etapa de origen */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Etapa de origen:</span>
                {isPmo ? (
                  <select
                    value={stageId}
                    onChange={(e) => setStageId(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {PROJECT_STAGES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
                    {action.stageName}
                  </span>
                )}
              </div>

              {/* Responsable */}
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Responsable:</span>
                {isPmo ? (
                  <div className="space-y-1">
                    <select
                      value={responsible}
                      onChange={(e) => setResponsible(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="Sin asignar">Sin asignar</option>
                      {project.team && project.team.length > 0 && (
                        <optgroup label="Equipo del Proyecto">
                          {project.team.map((m) => (
                            <option key={`tm-${m.name}`} value={m.name}>
                              {m.name} ({m.role})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {userOptions && userOptions.length > 0 && (
                        <optgroup label="Usuarios Registrados">
                          {userOptions.map((u) => (
                            <option key={`usr-${u.id}`} value={u.name}>
                              {u.name} ({u.area || 'General'})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {responsible &&
                        responsible !== 'Sin asignar' &&
                        !userOptions.some((u) => u.name === responsible) &&
                        !(project.team || []).some((m) => m.name === responsible) && (
                          <optgroup label="Otro Responsable">
                            <option value={responsible}>{responsible}</option>
                          </optgroup>
                        )}
                    </select>
                    <input
                      type="text"
                      value={responsible === 'Sin asignar' ? '' : responsible}
                      onChange={(e) => setResponsible(e.target.value || 'Sin asignar')}
                      placeholder="O escribir nombre personalizado..."
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-[10px] text-slate-700 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      title="Podés seleccionar de la lista o escribir un nombre directamente"
                    />
                  </div>
                ) : (
                  <span className="flex items-center gap-1 font-semibold text-slate-700 py-0.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    {action.responsible}
                  </span>
                )}
              </div>
            </div>

            <div className="text-[10px] text-slate-500 pt-1">
              Creada por: <strong>{action.createdBy || action.responsible}</strong>
            </div>
          </div>

          {/* Status selection pills */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Estado de la Acción:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Pendiente', 'En proceso', 'Finalizada'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setStatus(st)}
                  className={`py-2 rounded-lg font-bold border transition-all text-center ${
                    status === st
                      ? st === 'Finalizada'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : st === 'En proceso'
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                        : 'bg-amber-500 text-white border-amber-600 shadow-xs'
                      : canEdit
                      ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Required Date */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Fecha Requerida de Cumplimiento:
            </label>
            <input
              type="date"
              disabled={!canEdit}
              value={requiredDate}
              onChange={(e) => setRequiredDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-medium text-slate-800 disabled:opacity-75 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Execution Comments Section */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-700 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              Comentario respecto a la acción tomada (Actualización de avance):
            </label>

            {/* Existing latest comment */}
            {action.executionComment && (
              <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 text-slate-800 italic">
                <span className="text-[10px] font-bold text-slate-500 uppercase not-italic block mb-0.5">
                  Comentario actual:
                </span>
                "{action.executionComment}"
              </div>
            )}

            {/* Input for new comment */}
            {canEdit ? (
              <textarea
                rows={3}
                placeholder="Escriba aquí el detalle de la acción tomada, resultados obtenidos, bloqueos o próximos pasos..."
                value={newCommentNote}
                onChange={(e) => setNewCommentNote(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            ) : (
              <p className="text-slate-400 italic text-xs">
                No tiene permisos para agregar comentarios a esta acción.
              </p>
            )}
          </div>

          {/* File Attachments and Evidences Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                <span>Archivos Adjuntos y Evidencias:</span>
                <span className="text-[11px] font-normal text-slate-500">
                  ({attachments.length})
                </span>
              </label>

              {canEdit && (
                <label className="cursor-pointer text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir archivo</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleFilesAdded(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>

            {/* Drag & Drop Zone (click and drag-and-drop support) */}
            {canEdit && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFilesAdded(e.dataTransfer.files);
                }}
                className={`relative border-2 border-dashed rounded-xl p-3.5 text-center transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/70 text-blue-800'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-1">
                  <Upload className={`w-5 h-5 ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold text-blue-600 cursor-pointer hover:underline">
                      Hacé clic para seleccionar
                    </span>{' '}
                    o arrastrá archivos aquí
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Minutas, comprobantes, capturas de pantalla, planillas Excel o PDF
                  </p>
                </div>
                <input
                  type="file"
                  multiple
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={(e) => {
                    handleFilesAdded(e.target.files);
                    e.target.value = '';
                  }}
                  title=""
                />
              </div>
            )}

            {/* List of Attached Files */}
            {attachments.length > 0 ? (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                      <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (onPreviewFile) {
                              onPreviewFile(file, project.title);
                            }
                          }}
                          className="font-medium text-slate-800 hover:text-blue-600 hover:underline truncate text-left block"
                          title={`Previsualizar ${file.name}`}
                        >
                          {file.name}
                        </button>
                        <span className="text-[10px] text-slate-400">
                          {formatFileSize(file.size)} • {formatDateSpanish(file.uploadedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {file.dataUrl && (
                        <>
                          {onPreviewFile && (
                            <button
                              type="button"
                              onClick={() => onPreviewFile(file, project.title)}
                              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-colors"
                              title="Previsualizar archivo"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <a
                            href={file.dataUrl}
                            download={file.name}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-colors"
                            title="Descargar archivo"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(file.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded transition-colors"
                          title="Eliminar adjunto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !canEdit && (
                <p className="text-slate-400 italic text-xs">
                  No hay archivos adjuntos en esta acción.
                </p>
              )
            )}
          </div>

          {/* Comment History Log */}
          {action.commentsHistory && action.commentsHistory.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Historial de Observaciones ({action.commentsHistory.length}):
              </span>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {action.commentsHistory.map((com) => (
                  <div
                    key={com.id}
                    className="p-2 rounded bg-slate-50 text-[11px] border border-slate-200"
                  >
                    <div className="flex items-center justify-between text-slate-500 font-semibold mb-0.5">
                      <span>{com.author}</span>
                      <span>{formatDateSpanish(com.date)}</span>
                    </div>
                    <p className="text-slate-800">{com.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer controls */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Acción permanente protegida (no eliminable)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
              >
                {canEdit ? 'Cancelar' : 'Cerrar'}
              </button>
              {canEdit && (
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  Guardar Actualización
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

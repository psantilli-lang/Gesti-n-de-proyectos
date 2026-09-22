export type SAPModule = 'PP' | 'MM' | 'WM' | 'QM' | 'SD' | 'FI' | 'CO';

export interface SAPModuleInfo {
  id: SAPModule;
  name: string;
  description: string;
  badgeBg: string;
  badgeText: string;
}

export const SAP_MODULES_DATA: SAPModuleInfo[] = [
  { id: 'PP', name: 'Planificación y Control de Producción', description: 'Production Planning', badgeBg: 'bg-blue-100 text-blue-800 border-blue-200', badgeText: 'PP' },
  { id: 'MM', name: 'Gestión de Materiales y Compras', description: 'Materials Management', badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200', badgeText: 'MM' },
  { id: 'WM', name: 'Gestión de Almacenes / EWM', description: 'Warehouse Management', badgeBg: 'bg-amber-100 text-amber-800 border-amber-200', badgeText: 'WM' },
  { id: 'QM', name: 'Gestión de Calidad', description: 'Quality Management', badgeBg: 'bg-rose-100 text-rose-800 border-rose-200', badgeText: 'QM' },
  { id: 'SD', name: 'Ventas y Facturación', description: 'Sales & Distribution', badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200', badgeText: 'SD' },
  { id: 'FI', name: 'Finanzas y Contabilidad', description: 'Financial Accounting', badgeBg: 'bg-teal-100 text-teal-800 border-teal-200', badgeText: 'FI' },
  { id: 'CO', name: 'Control de Gestión y Costos', description: 'Controlling', badgeBg: 'bg-purple-100 text-purple-800 border-purple-200', badgeText: 'CO' },
];

export const SAP_AREAS = [
  'Administración',
  'Compras',
  'Datos Maestros',
  'Operaciones',
  'Ventas',
  'Repuestos',
  'Posventa',
] as const;

export type AreaName = (typeof SAP_AREAS)[number] | string;

export const PROJECT_STAGES = [
  { id: 1, name: '01- Pendiente', code: '01' },
  { id: 2, name: '02- En relevamiento', code: '02' },
  { id: 3, name: '03-Consulta usuario', code: '03' },
  { id: 4, name: '05- En Desarrollo', code: '05' },
  { id: 5, name: '06- Prueba Funcional', code: '06' },
  { id: 6, name: '07- Entregado', code: '07' },
] as const;

export type ProjectState =
  | '01- Pendiente'
  | '02- En relevamiento'
  | '03-Consulta usuario'
  | '03- Consulta usuario'
  | '05- En Desarrollo'
  | '06- Prueba Funcional'
  | '07- Entregado'
  | '8- Cancelado'
  | '08- Cancelado';

export const ALL_PROJECT_STATES: ProjectState[] = [
  '01- Pendiente',
  '02- En relevamiento',
  '03-Consulta usuario',
  '05- En Desarrollo',
  '06- Prueba Funcional',
  '07- Entregado',
  '8- Cancelado',
];

export type ActionStatus = 'Pendiente' | 'En proceso' | 'Finalizada';

export interface ActionComment {
  id: string;
  author: string;
  date: string;
  text: string;
}

export interface StageAction {
  id: string;
  stageId: number;
  stageName: string;
  title: string;
  requiredDate: string; // YYYY-MM-DD
  responsible: string;
  status: ActionStatus;
  executionComment?: string;
  completedAt?: string;
  commentsHistory: ActionComment[];
  createdAt: string;
  createdBy?: string;
  attachments?: AttachedFile[];
}

export interface StageSchedule {
  stageId: number;
  stageName: string;
  estimatedStartDate: string; // YYYY-MM-DD
  estimatedEndDate: string; // YYYY-MM-DD
  actualEndDate?: string; // YYYY-MM-DD
  status: 'No iniciada' | 'En curso' | 'Completada';
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number; // in bytes
  type: string;
  uploadedAt: string;
  dataUrl?: string; // for mock preview or real download
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email?: string;
}

export interface SAPProject {
  id: string;
  code: string; // e.g. SAP-2026-001
  area: AreaName;
  sapModules: SAPModule[]; // Can select multiple modules
  title: string;
  currentSituation: string;
  currentSituationFiles: AttachedFile[];
  improvementNeed: string;
  improvementNeedFiles: AttachedFile[];
  team: TeamMember[];
  priority: number; // Priority 1..N within the specific Area
  state: ProjectState;
  schedule: StageSchedule[];
  actions: StageAction[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export type UserRole = 'pmo' | 'user' | 'admin' | 'responsible';

export interface AppUser {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  area?: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface UserSession {
  id?: string;
  name: string;
  username?: string;
  email?: string;
  role: UserRole;
  area?: string;
}

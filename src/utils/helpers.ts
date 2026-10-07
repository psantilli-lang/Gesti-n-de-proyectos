import { UserSession, StageAction, SAPProject, ProjectState } from '../types/project';

export function formatDateSpanish(dateString?: string): string {
  if (!dateString) return 'Sin definir';
  try {
    const [year, month, day] = dateString.split('-');
    if (!year || !month || !day) return dateString;
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Normalizes person names to compare without titles or parenthetical roles.
 */
export function cleanPersonName(name?: string): string {
  if (!name) return '';
  return name.replace(/\(.*?\)/g, '').trim().toLowerCase();
}

/**
 * Check if the active user has PMO role (full editing, prioritization, reporting, cancellation).
 */
export function isPMO(user?: UserSession | null): boolean {
  if (!user) return false;
  if (user.role === 'pmo' || user.role === 'admin') return true;
  const username = (user.username || '').toLowerCase();
  if (
    username === 'pmo' || 
    username === 'admin' || 
    username === 'psantilli' ||
    username.includes('santilli') ||
    username.includes('paola') ||
    username.includes('pmo')
  ) return true;
  const name = (user.name || '').toLowerCase();
  if (
    name.includes('pmo') || 
    name.includes('santilli') || 
    name.includes('paola')
  ) return true;
  const email = (user.email || '').toLowerCase();
  if (
    email.includes('pmo') || 
    email.includes('psantilli') || 
    email.includes('santilli') || 
    email.includes('paola') ||
    email === 'psantilli@crucianelli.com'
  ) return true;
  return false;
}

/**
 * Get visual display label for a user's role: 'PMO' or 'Usuario'.
 */
export function getRoleDisplayName(role?: string): 'PMO' | 'Usuario' {
  if (role === 'pmo' || role === 'admin') return 'PMO';
  return 'Usuario';
}

/**
 * Reporting and Prioritization are EXCLUSIVE activities of PMO.
 */
export function canUserAccessReportingAndPrioritization(user?: UserSession | null): boolean {
  return isPMO(user);
}

/**
 * Check if the active user is the creator (who registered) of the project.
 */
export function isUserProjectCreator(user?: UserSession | null, project?: SAPProject | null): boolean {
  if (!user?.name || !project?.createdBy) return false;
  const cleanUser = cleanPersonName(user.name);
  const cleanCreator = cleanPersonName(project.createdBy);
  if (cleanUser.length > 2 && (cleanCreator.includes(cleanUser) || cleanUser.includes(cleanCreator))) return true;
  const uLower = user.name.toLowerCase();
  const cLower = project.createdBy.toLowerCase();
  return uLower.includes(cLower) || cLower.includes(uLower);
}

/**
 * Check if the active user is a member of the project team (or creator, or PMO).
 */
export function isUserProjectMember(user?: UserSession | null, project?: SAPProject | null): boolean {
  if (!user || !project) return false;
  if (isPMO(user)) return true;
  if (isUserProjectCreator(user, project)) return true;

  const userEmail = user.email?.trim().toLowerCase();
  const userName = user.name?.trim() || '';
  const cleanUser = cleanPersonName(userName);
  const uLower = userName.toLowerCase();
  const username = user.username?.trim().toLowerCase();

  return (project.team || []).some((member) => {
    if (!member) return false;
    // Check by email
    if (userEmail && member.email && member.email.trim().toLowerCase() === userEmail) {
      return true;
    }
    // Check by name
    if (member.name) {
      const cleanMem = cleanPersonName(member.name);
      const mLower = member.name.trim().toLowerCase();
      if (cleanUser && cleanMem && (cleanMem === cleanUser || cleanMem.includes(cleanUser) || cleanUser.includes(cleanMem))) {
        return true;
      }
      if (uLower && mLower && (uLower === mLower || uLower.includes(mLower) || mLower.includes(uLower))) {
        return true;
      }
      if (username && mLower.includes(username)) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Check if an action is assigned to a specific user.
 * Supports exact name, normalized comparison, and partial match ignoring parentheses.
 */
export function isActionAssignedToUser(user?: UserSession | null, action?: StageAction | null): boolean {
  if (!user?.name || !action?.responsible) return false;
  const cleanResp = cleanPersonName(action.responsible);
  if (!cleanResp || cleanResp === 'sin asignar' || cleanResp === 'sin asignar.') return false;
  const cleanUserName = cleanPersonName(user.name);
  if (cleanUserName.length > 2 && cleanResp.includes(cleanUserName)) return true;
  if (cleanResp.length > 2 && cleanUserName.includes(cleanResp)) return true;
  const uLower = user.name.toLowerCase();
  const rLower = action.responsible.toLowerCase();
  return uLower.includes(rLower) || rLower.includes(uLower);
}

/**
 * Check if the active user can edit a specific action.
 * Rule: Las acciones solo las podrán editar las personas que la tienen asignadas y el PMO.
 * Si una acción está "Sin asignar", solo el PMO puede editarla o asignarle responsable.
 */
export function canUserEditAction(user?: UserSession | null, action?: StageAction | null): boolean {
  if (!user || !action) return false;
  if (isPMO(user)) return true;
  return isActionAssignedToUser(user, action);
}

/**
 * Check if user can upload files to an action.
 * Rule: Podrán subir archivos a las acciones que tienen asignadas (y el PMO).
 */
export function canUserUploadActionFiles(user?: UserSession | null, action?: StageAction | null): boolean {
  if (!user || !action) return false;
  if (isPMO(user)) return true;
  return isActionAssignedToUser(user, action);
}

/**
 * Check if user can edit project general information (title, situation, need, modules, team).
 * Rule: La información general del proyecto solo podrá cambiarla el usuario que da de alta el proyecto y el PMO.
 */
export function canUserEditProjectMetadata(user?: UserSession | null, project?: SAPProject | null): boolean {
  if (!user) return false;
  if (isPMO(user)) return true;
  if (project && isUserProjectCreator(user, project)) return true;
  return false;
}

/**
 * Check if user can delete a project.
 * Rule: Solo el PMO puede eliminar definitivamente un proyecto puntual (para purgar pruebas o corregir doble codificación).
 */
export function canUserDeleteProject(user?: UserSession | null, _project?: SAPProject | null): boolean {
  if (!user) return false;
  return isPMO(user);
}

/**
 * Check if user can change project state to '8- Cancelado'.
 * Rule: Excepto al estado "Cancelado", solo el PMO podrá hacerlo.
 */
export function canUserCancelProject(user?: UserSession | null, project?: SAPProject | null): boolean {
  if (!user) return false;
  return isPMO(user);
}

/**
 * Check if user can change project state.
 * Rule:
 * - Changing to '8- Cancelado': Solo el PMO puede hacerlo.
 * - Changing to other states (01 to 07): Usuarios y PMO pueden cambiar de estado.
 */
export function canUserChangeProjectState(
  user?: UserSession | null,
  project?: SAPProject | null,
  targetState?: ProjectState
): boolean {
  if (!user || !project) return false;
  if (targetState === '8- Cancelado' || targetState === '08- Cancelado') {
    return canUserCancelProject(user, project);
  }
  return true;
}

/**
 * Check if user can add actions to a project.
 * Rule: Usuarios pueden agregar acciones (al igual que PMO).
 */
export function canUserAddAction(user?: UserSession | null, project?: SAPProject | null): boolean {
  return !!user;
}

/**
 * Check if user can delete an action.
 * Rule: Ningún usuario puede borrar acciones (garantizado para integridad y trazabilidad de auditoría).
 */
export function canUserDeleteAction(
  _user?: UserSession | null,
  _action?: StageAction | null,
  _project?: SAPProject | null
): boolean {
  return false;
}

/**
 * Check if user can edit the defined title/description of an action.
 * Rule: El PMO tiene acceso completo para editar las acciones definidas (corregir texto, ortografía o detalles).
 * También permitido para la persona asignada o quien la creó.
 */
export function canUserEditActionDefinition(
  user?: UserSession | null,
  action?: StageAction | null
): boolean {
  if (!user) return false;
  if (isPMO(user)) return true;
  if (!action) return false;
  if (
    action.createdBy &&
    cleanPersonName(action.createdBy) !== 'sin asignar' &&
    cleanPersonName(user.name) === cleanPersonName(action.createdBy)
  ) {
    return true;
  }
  return isActionAssignedToUser(user, action);
}

/**
 * Check if user can edit project dates (schedule stage dates, actual end dates).
 * Rule: Las fechas de los proyectos solo la pueden cambiar los miembros del equipo de proyecto (y el PMO).
 */
export function canUserEditProjectDates(
  user?: UserSession | null,
  project?: SAPProject | null
): boolean {
  if (!user) return false;
  if (!project) return true; // New project creation
  if (isPMO(user)) return true;
  return isUserProjectMember(user, project);
}

/**
 * Calculate if an action is overdue
 */
export function isActionOverdue(action: StageAction): boolean {
  if (action.status === 'Finalizada') return false;
  const today = new Date().toISOString().split('T')[0];
  return action.requiredDate < today;
}

/**
 * Calculate if an action is due soon (within 7 days)
 */
export function isActionDueSoon(action: StageAction): boolean {
  if (action.status === 'Finalizada') return false;
  const today = new Date();
  const reqDate = new Date(action.requiredDate);
  const diffDays = Math.ceil((reqDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 7;
}

/**
 * Export array of objects to CSV download
 */
export function downloadCSV(filename: string, rows: Record<string, any>[]): void {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map((row) => {
        return keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

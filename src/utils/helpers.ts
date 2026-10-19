import { UserSession, StageAction, SAPProject, ProjectState, ActionComment } from '../types/project';

export function formatDateSpanish(dateString?: string): string {
  if (!dateString) return 'Sin definir';
  try {
    const cleanStr = dateString.includes('T') ? dateString.split('T')[0] : dateString;
    const [year, month, day] = cleanStr.split('-');
    if (!year || !month || !day) return dateString;
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
}

/**
 * Safely returns all comments for a StageAction, preserving any legacy executionComment
 * as the initial historical comment if commentsHistory was empty.
 */
export function getActionCommentsHistory(action?: StageAction | null): ActionComment[] {
  if (!action) return [];
  if (action.commentsHistory && action.commentsHistory.length > 0) {
    return action.commentsHistory;
  }
  if (action.executionComment && action.executionComment.trim()) {
    const fallbackDate = action.createdAt
      ? action.createdAt.split('T')[0]
      : (action.updatedAt ? action.updatedAt.split('T')[0] : '');
    return [
      {
        id: `c-init-${action.id}`,
        author: action.responsible && action.responsible !== 'Sin asignar' ? action.responsible : 'Registro inicial',
        date: fallbackDate,
        text: action.executionComment.trim(),
      },
    ];
  }
  return [];
}

/**
 * Detects URLs inside action text or comments.
 * Returns clean text and list of detected URLs with user-friendly labels.
 */
export interface ActionLinkItem {
  url: string;
  label: string;
  isSpreadsheet: boolean;
}

export function parseActionTextWithLinks(rawText?: string | null): {
  cleanText: string;
  urls: ActionLinkItem[];
  isPureLink: boolean;
} {
  if (!rawText) return { cleanText: '', urls: [], isPureLink: false };
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|(?:docs|drive)\.google\.com\/[^\s]+|[a-zA-Z0-9-]+\.sharepoint\.com\/[^\s]+)/gi;
  const matches = rawText.match(urlRegex);
  if (!matches || matches.length === 0) {
    return { cleanText: rawText, urls: [], isPureLink: false };
  }

  let cleanText = rawText;
  matches.forEach((u) => {
    cleanText = cleanText.replace(u, '');
  });
  // Clean up punctuation or spaces left over
  cleanText = cleanText.replace(/\s{2,}/g, ' ').trim();
  const isPureLink = cleanText.length === 0;

  const urls: ActionLinkItem[] = matches.map((matchStr) => {
    let fullUrl = matchStr.trim();
    // remove trailing punctuation often caught by regex
    fullUrl = fullUrl.replace(/[.,;:)]+$/, '');
    if (!/^https?:\/\//i.test(fullUrl)) {
      fullUrl = 'https://' + fullUrl;
    }

    let label = 'Abrir enlace';
    let isSpreadsheet = false;
    try {
      const parsed = new URL(fullUrl);
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname.toLowerCase();

      if (host.includes('docs.google.com') && (path.includes('/spreadsheets/') || fullUrl.includes('spreadsheets'))) {
        label = 'Planilla Google Sheets';
        isSpreadsheet = true;
      } else if (host.includes('docs.google.com') && (path.includes('/document/') || fullUrl.includes('document'))) {
        label = 'Documento Google Docs';
      } else if (host.includes('drive.google.com')) {
        label = 'Carpeta Google Drive';
      } else if (host.includes('sharepoint.com') || host.includes('onedrive.live.com') || host.includes('1drv.ms')) {
        if (path.includes('.xlsx') || path.includes(':x:') || path.includes('excel') || fullUrl.includes('sheet')) {
          label = 'Planilla Excel (SharePoint)';
          isSpreadsheet = true;
        } else {
          label = 'Archivo SharePoint';
        }
      } else if (host.includes('jira') || path.includes('browse/')) {
        label = 'Ticket JIRA';
      } else if (host.includes('trello.com')) {
        label = 'Tablero Trello';
      } else {
        const cleanHost = host.replace(/^www\./, '');
        label = cleanHost.length > 24 ? cleanHost.slice(0, 22) + '...' : cleanHost;
      }
    } catch {
      label = 'Abrir enlace';
    }
    return { url: fullUrl, label, isSpreadsheet };
  });

  return { cleanText, urls, isPureLink };
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
 * Rule: Solo el rol PMO (o Administrador) tiene autorización para eliminar acciones puntuales (útil para duplicados o errores de carga).
 */
export function canUserDeleteAction(
  user?: UserSession | null,
  _action?: StageAction | null,
  _project?: SAPProject | null
): boolean {
  return isPMO(user);
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

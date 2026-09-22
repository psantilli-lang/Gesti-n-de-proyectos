import { SAPProject, UserSession, AppUser, PROJECT_STAGES, StageSchedule, ALL_PROJECT_STATES, ProjectState, UserRole } from '../types/project';
import { INITIAL_PROJECTS, INITIAL_USERS, INITIAL_APP_USERS } from '../data/initialData';

const PROJECTS_STORAGE_KEY = 'sap_mejora_proyectos_v2';
const LEGACY_STORAGE_KEY = 'sap_mejora_proyectos_v1';
const USER_STORAGE_KEY = 'sap_mejora_current_user_v1';
const USERS_STORAGE_KEY = 'sap_mejora_users_v2';
const AUTH_SESSION_KEY = 'sap_mejora_auth_session_v2';

function migrateProject(project: SAPProject): SAPProject {
  let newState = project.state;
  if (project.state.includes('Cancelado') || project.state.startsWith('8-') || project.state.startsWith('08-')) {
    newState = '8- Cancelado';
  } else if (project.state.includes('Cierre') || project.state.includes('7.')) {
    newState = '07- Entregado';
  } else if (project.state.includes('Implementación') || project.state.includes('6.')) {
    newState = '06- Prueba Funcional';
  } else if (project.state.includes('Pruebas') || project.state.includes('UAT') || project.state.includes('5.')) {
    newState = '06- Prueba Funcional';
  } else if (project.state.includes('Configuración') || project.state.includes('Desarrollo') || project.state.includes('4.')) {
    newState = '05- En Desarrollo';
  } else if (project.state.includes('Aprobación') || project.state.includes('3.')) {
    newState = '03-Consulta usuario';
  } else if (project.state.includes('Factibilidad') || project.state.includes('Especificación') || project.state.includes('2.')) {
    newState = '02- En relevamiento';
  } else if (project.state.includes('Relevamiento') || project.state.includes('1.')) {
    newState = '02- En relevamiento';
  } else if (!ALL_PROJECT_STATES.includes(project.state as ProjectState)) {
    newState = '01- Pendiente';
  }

  // Migrate schedule to the 6 stages if length differs or old stage names remain
  let newSchedule = project.schedule;
  const needsScheduleMigration =
    !newSchedule ||
    newSchedule.length !== PROJECT_STAGES.length ||
    newSchedule.some((s) => !s.stageName.startsWith('0'));

  if (needsScheduleMigration) {
    newSchedule = PROJECT_STAGES.map((stageDef, idx) => {
      const oldStage = project.schedule?.[idx];
      return {
        stageId: stageDef.id,
        stageName: stageDef.name,
        estimatedStartDate: oldStage?.estimatedStartDate || new Date().toISOString().split('T')[0],
        estimatedEndDate: oldStage?.estimatedEndDate || new Date().toISOString().split('T')[0],
        actualEndDate: oldStage?.actualEndDate,
        status: oldStage?.status || (idx === 0 ? 'En curso' : 'No iniciada'),
      };
    });
  }

  // Ensure actions have matching stageName and attachments array
  const newActions = (project.actions || []).map((action) => {
    const matched = PROJECT_STAGES.find((s) => s.id === action.stageId) || PROJECT_STAGES[0];
    return {
      ...action,
      stageId: matched.id,
      stageName: action.stageName || matched.name,
      attachments: action.attachments || [],
      createdBy: action.createdBy || action.responsible || 'Administrador General (PMO SAP)',
    };
  });

  // Migrate area if legacy area name
  let newArea = project.area;
  const legacyAreaMap: Record<string, string> = {
    'Producción y Fabricación': 'Operaciones',
    'Calidad y Metrología': 'Operaciones',
    'Logística y Almacenes': 'Operaciones',
    'Costos e Ingeniería de Procesos': 'Operaciones',
    'Mantenimiento de Planta': 'Operaciones',
    'Sistemas y TI': 'Operaciones',
    'Administración y Finanzas': 'Administración',
    'Ventas y Despacho': 'Ventas',
    'Compras y Abastecimiento': 'Compras',
  };
  if (legacyAreaMap[newArea]) {
    newArea = legacyAreaMap[newArea];
  }

  return {
    ...project,
    area: newArea,
    state: newState,
    schedule: newSchedule,
    actions: newActions,
    createdBy: project.createdBy || (project.team?.[0]?.name ? project.team[0].name : 'Administrador General (PMO SAP)'),
  };
}

export interface ProjectHealth {
  delayedStagesCount: number;
  pendingActionsCount: number;
  overdueActionsCount: number;
  completionPercentage: number;
  overallStatus: 'A tiempo' | 'En riesgo' | 'Demorado' | 'Completado' | 'Pendiente' | 'Cancelado';
  isPendingStart: boolean;
  isCancelled: boolean;
}

export const storageService = {
  getProjects(): SAPProject[] {
    try {
      let data = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (!data) {
        // Check legacy key
        data = localStorage.getItem(LEGACY_STORAGE_KEY);
      }
      if (data) {
        const parsed: SAPProject[] = JSON.parse(data);
        const migrated = parsed.map(migrateProject);
        this.saveProjects(migrated);
        return migrated;
      }
    } catch (e) {
      console.error('Error loading projects from localStorage', e);
    }
    // Initialize default
    this.saveProjects(INITIAL_PROJECTS);
    return INITIAL_PROJECTS;
  },

  saveProjects(projects: SAPProject[]): void {
    try {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      console.error('Error saving projects to localStorage', e);
    }
  },

  resetDefaultData(): SAPProject[] {
    this.saveProjects(INITIAL_PROJECTS);
    return INITIAL_PROJECTS;
  },

  // ================= USER & AUTH MANAGEMENT =================
  getUsers(): AppUser[] {
    try {
      const data = localStorage.getItem(USERS_STORAGE_KEY);
      if (data) {
        const parsed: AppUser[] = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure every user has username and password
          let updated = false;
          const sanitized = parsed.map((u, idx) => {
            const copy = { ...u };
            if (!copy.id) {
              copy.id = `usr-${idx + 1}`;
              updated = true;
            }
            if (!copy.username) {
              copy.username = copy.email ? copy.email.split('@')[0].toLowerCase() : `usuario${idx + 1}`;
              updated = true;
            }
            if (!copy.password) {
              copy.password = copy.role === 'admin' ? 'admin' : 'sap2026';
              updated = true;
            }
            return copy;
          });
          if (updated) {
            this.saveUsers(sanitized);
          }
          return sanitized;
        }
      }
    } catch (e) {
      console.error('Error loading users from localStorage', e);
    }
    // Initialize default users with passwords
    this.saveUsers(INITIAL_APP_USERS);
    return INITIAL_APP_USERS;
  },

  saveUsers(users: AppUser[]): void {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.error('Error saving users to localStorage', e);
    }
  },

  addUser(userData: {
    name: string;
    username: string;
    email: string;
    password: string;
    role: UserRole;
    area?: string;
  }): { success: boolean; message?: string; user?: AppUser } {
    const users = this.getUsers();
    const cleanUsername = userData.username.trim().toLowerCase();
    const cleanEmail = userData.email.trim().toLowerCase();

    if (!cleanUsername) {
      return { success: false, message: 'El nombre de usuario es obligatorio.' };
    }
    if (!userData.password || userData.password.length < 3) {
      return { success: false, message: 'La contraseña debe tener al menos 3 caracteres.' };
    }
    if (!userData.name.trim()) {
      return { success: false, message: 'El nombre completo es obligatorio.' };
    }

    const usernameExists = users.some(
      (u) => u.username.toLowerCase() === cleanUsername
    );
    if (usernameExists) {
      return { success: false, message: `El nombre de usuario "${userData.username}" ya está registrado.` };
    }

    const emailExists = users.some(
      (u) => u.email && u.email.toLowerCase() === cleanEmail
    );
    if (emailExists) {
      return { success: false, message: `El correo "${userData.email}" ya está asociado a otro usuario.` };
    }

    const newUser: AppUser = {
      id: `usr-${Date.now()}`,
      name: userData.name.trim(),
      username: cleanUsername,
      email: userData.email.trim(),
      password: userData.password,
      role: userData.role,
      area: userData.area || 'Operaciones',
      createdAt: new Date().toISOString(),
    };

    const updatedUsers = [...users, newUser];
    this.saveUsers(updatedUsers);
    return { success: true, user: newUser };
  },

  updateUser(updatedUser: AppUser): { success: boolean; message?: string } {
    const users = this.getUsers();
    const cleanUsername = updatedUser.username.trim().toLowerCase();
    const cleanEmail = updatedUser.email.trim().toLowerCase();

    // Verify unique username among other users
    const duplicateUser = users.some(
      (u) => u.id !== updatedUser.id && u.username.toLowerCase() === cleanUsername
    );
    if (duplicateUser) {
      return { success: false, message: 'Ese nombre de usuario ya está en uso por otra persona.' };
    }

    const duplicateEmail = users.some(
      (u) => u.id !== updatedUser.id && u.email.toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      return { success: false, message: 'Ese correo electrónico ya está en uso.' };
    }

    const nextUsers = users.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    this.saveUsers(nextUsers);

    // If current session is this user, update session as well
    const currSession = this.getCurrentUser();
    if (currSession && (currSession.id === updatedUser.id || currSession.username === updatedUser.username)) {
      this.setCurrentUser({
        id: updatedUser.id,
        name: updatedUser.name,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        area: updatedUser.area,
      });
    }

    return { success: true };
  },

  changePassword(userId: string, newPassword: string): { success: boolean; message?: string } {
    if (!newPassword || newPassword.length < 3) {
      return { success: false, message: 'La nueva contraseña debe tener al menos 3 caracteres.' };
    }
    const users = this.getUsers();
    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return { success: false, message: 'Usuario no encontrado.' };
    }

    users[userIndex].password = newPassword;
    this.saveUsers(users);
    return { success: true };
  },

  deleteUser(userId: string): { success: boolean; message?: string } {
    const users = this.getUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) {
      return { success: false, message: 'El usuario no existe.' };
    }

    // Protection: do not delete the last PMO
    if (target.role === 'admin' || target.role === 'pmo') {
      const pmoCount = users.filter((u) => u.role === 'admin' || u.role === 'pmo').length;
      if (pmoCount <= 1) {
        return { success: false, message: 'No es posible eliminar el único usuario PMO del sistema.' };
      }
    }

    const nextUsers = users.filter((u) => u.id !== userId);
    this.saveUsers(nextUsers);
    return { success: true };
  },

  authenticate(
    usernameOrEmail: string,
    password: string
  ): { success: boolean; user?: UserSession; message?: string } {
    if (!usernameOrEmail || !password) {
      return { success: false, message: 'Por favor complete usuario y contraseña.' };
    }

    const users = this.getUsers();
    const cleanIdentifier = usernameOrEmail.trim().toLowerCase();

    const matchedUser = users.find(
      (u) =>
        u.username.toLowerCase() === cleanIdentifier ||
        (u.email && u.email.toLowerCase() === cleanIdentifier)
    );

    if (!matchedUser) {
      return { success: false, message: 'Usuario o correo no encontrado.' };
    }

    if (matchedUser.password !== password) {
      return { success: false, message: 'Contraseña incorrecta. Verifique sus datos.' };
    }

    // Update lastLogin
    matchedUser.lastLogin = new Date().toISOString();
    this.updateUser(matchedUser);

    const sessionUser: UserSession = {
      id: matchedUser.id,
      name: matchedUser.name,
      username: matchedUser.username,
      email: matchedUser.email,
      role: matchedUser.role,
      area: matchedUser.area,
    };

    this.setCurrentUser(sessionUser);
    return { success: true, user: sessionUser };
  },

  getCurrentUser(): UserSession | null {
    try {
      const authData = localStorage.getItem(AUTH_SESSION_KEY);
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          if (parsed && typeof parsed === 'object' && parsed.name) {
            return parsed as UserSession;
          }
        } catch {
          // ignore parse error
        }
      }
      // Check legacy key
      const legacyData = localStorage.getItem(USER_STORAGE_KEY);
      if (legacyData) {
        try {
          const parsed = JSON.parse(legacyData);
          if (parsed && typeof parsed === 'object' && parsed.name) {
            // Verify if user exists in current users
            const users = this.getUsers();
            const found = users.find((u) => u.name === parsed.name);
            if (found) {
              const session: UserSession = {
                id: found.id,
                name: found.name,
                username: found.username,
                email: found.email,
                role: found.role,
                area: found.area,
              };
              this.setCurrentUser(session);
              return session;
            }
          }
        } catch {
          // ignore parse error
        }
      }
    } catch (e) {
      console.error('Error loading session from localStorage', e);
    }
    return null;
  },

  setCurrentUser(user: UserSession | null): void {
    try {
      if (user) {
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_SESSION_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Error updating current session', e);
    }
  },

  logout(): void {
    this.setCurrentUser(null);
  },

  generateProjectCode(existingProjects: SAPProject[]): string {
    const year = new Date().getFullYear();
    const prefix = `SAP-${year}-`;
    
    // Find highest existing sequence for this year
    let maxNum = 0;
    existingProjects.forEach((p) => {
      if (p.code && p.code.startsWith(prefix)) {
        const numPart = parseInt(p.code.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });

    const nextNum = (maxNum + 1).toString().padStart(3, '0');
    return `${prefix}${nextNum}`;
  },

  getNextPriorityForArea(existingProjects: SAPProject[], area: string): number {
    const areaProjects = existingProjects.filter((p) => p.area === area);
    if (areaProjects.length === 0) return 1;
    const maxPriority = Math.max(...areaProjects.map((p) => p.priority || 0));
    return maxPriority + 1;
  },

  createDefaultSchedules(): StageSchedule[] {
    const today = new Date();
    return PROJECT_STAGES.map((stage, index) => {
      const start = new Date(today);
      start.setDate(today.getDate() + index * 15);
      const end = new Date(start);
      end.setDate(start.getDate() + 14);

      return {
        stageId: stage.id,
        stageName: stage.name,
        estimatedStartDate: start.toISOString().split('T')[0],
        estimatedEndDate: end.toISOString().split('T')[0],
        status: index === 0 ? 'En curso' : 'No iniciada',
      };
    });
  },

  /**
   * Helper to compute schedule deviation in days (Plan vs Actual)
   * Positive means delayed (took more days or deadline passed)
   * Negative means ahead of time
   * Zero means exactly on time
   */
  calculateStageDeviation(stage: StageSchedule): {
    daysDiff: number;
    isDelayed: boolean;
    isOnTime: boolean;
    isCompleted: boolean;
    statusLabel: string;
  } {
    const estEnd = new Date(stage.estimatedEndDate).getTime();
    
    if (stage.actualEndDate) {
      const actEnd = new Date(stage.actualEndDate).getTime();
      const diffMs = actEnd - estEnd;
      const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return {
        daysDiff,
        isDelayed: daysDiff > 0,
        isOnTime: daysDiff <= 0,
        isCompleted: true,
        statusLabel: daysDiff > 0 ? `${daysDiff} días de atraso` : daysDiff < 0 ? `${Math.abs(daysDiff)} días antes` : 'A tiempo',
      };
    }

    if (stage.status === 'En curso') {
      const now = new Date().getTime();
      if (now > estEnd) {
        const diffMs = now - estEnd;
        const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));
        return {
          daysDiff,
          isDelayed: true,
          isOnTime: false,
          isCompleted: false,
          statusLabel: `${daysDiff} días vencida`,
        };
      }
      return {
        daysDiff: 0,
        isDelayed: false,
        isOnTime: true,
        isCompleted: false,
        statusLabel: 'En curso a tiempo',
      };
    }

    return {
      daysDiff: 0,
      isDelayed: false,
      isOnTime: true,
      isCompleted: false,
      statusLabel: 'No iniciada',
    };
  },

  /**
   * Check project total health and schedule compliance
   */
  getProjectHealth(project: SAPProject): ProjectHealth {
    const isPendingStart =
      project.state.trim().startsWith('01') || project.state.toLowerCase().includes('pendiente');
    const isCancelled =
      project.state.includes('Cancelado') ||
      project.state.trim().startsWith('8-') ||
      project.state.trim().startsWith('08-') ||
      project.state.trim() === '8' ||
      project.state.trim() === '08';

    const completedStages = project.schedule.filter((s) => s.status === 'Completada').length;
    const completionPercentage = Math.round((completedStages / project.schedule.length) * 100);

    let delayedStagesCount = 0;
    // Si el proyecto está en estado pendiente o cancelado, no computa desvíos de cronograma
    if (!isPendingStart && !isCancelled) {
      project.schedule.forEach((stage) => {
        const dev = storageService.calculateStageDeviation(stage);
        if (dev.isDelayed) delayedStagesCount++;
      });
    }

    const nowStr = new Date().toISOString().split('T')[0];
    const pendingActions = project.actions.filter((a) => a.status !== 'Finalizada');
    const overdueActions =
      isPendingStart || isCancelled ? [] : pendingActions.filter((a) => a.requiredDate < nowStr);

    let overallStatus: 'A tiempo' | 'En riesgo' | 'Demorado' | 'Completado' | 'Pendiente' | 'Cancelado' = 'A tiempo';
    if (isCancelled) {
      overallStatus = 'Cancelado';
    } else if (isPendingStart) {
      overallStatus = 'Pendiente';
    } else if (
      project.state.includes('07- Entregado') ||
      project.state.includes('Entregado') ||
      project.state.includes('7. Cierre')
    ) {
      overallStatus = 'Completado';
    } else if (delayedStagesCount > 0 || overdueActions.length > 0) {
      overallStatus = 'Demorado';
    } else if (pendingActions.length > 3) {
      overallStatus = 'En riesgo';
    }

    return {
      delayedStagesCount,
      pendingActionsCount: isCancelled ? 0 : pendingActions.length,
      overdueActionsCount: overdueActions.length,
      completionPercentage,
      overallStatus,
      isPendingStart,
      isCancelled,
    };
  }
};

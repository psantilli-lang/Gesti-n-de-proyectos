import { SAPProject, StageAction, TeamMember, AppUser } from '../types/project';
import { db, ensureFirebaseAuth } from './firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

export interface NotificationLog {
  id: string;
  type: 'new_project' | 'new_action' | 'due_today' | 'overdue_15_days';
  projectId: string;
  projectCode: string;
  projectTitle: string;
  actionId?: string;
  actionTitle?: string;
  recipients: string[];
  sentAt: string;
  senderEmail: string;
  status: 'sent' | 'failed';
  error?: string;
  subject: string;
}

export interface PendingActionReminder {
  id: string; // Unique key to prevent duplicates
  action: StageAction;
  project: SAPProject;
  type: 'due_today' | 'overdue_15_days';
  daysDiff: number;
  recipientName: string;
  recipientEmail: string;
  suggestedSubject: string;
  previewHtml: string;
}

const STORAGE_LOGS_KEY = 'sap_email_notification_logs_v1';

// Base64URL encode string
function toBase64Url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Create RFC 2822 compliant message
function createRawEmail({
  to,
  subject,
  htmlBody,
  from,
}: {
  to: string[];
  subject: string;
  htmlBody: string;
  from?: string;
}): string {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const headers = [
    ...(from ? [`From: ${from}`] : []),
    `To: ${to.join(', ')}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    htmlBody,
  ];
  return toBase64Url(headers.join('\r\n'));
}

export const emailNotificationService = {
  /**
   * Resolve an email address from user name or custom string.
   * Supports any email domain (@crucianelli.com, @gmail.com, @outlook.com, @empresa.com, etc.)
   */
  resolveUserEmail(
    userName: string,
    project?: SAPProject,
    allUsers?: AppUser[]
  ): string | null {
    if (!userName) return null;
    const clean = userName.trim();

    // 1. Check if the string itself contains a valid email address (e.g. "juan@gmail.com" or "Juan <juan@outlook.com>")
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
    const directMatch = clean.match(emailRegex);
    if (directMatch) {
      return directMatch[1].toLowerCase().trim();
    }

    // Helper to normalize names (removes titles and excess whitespace)
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .replace(/^(ing\.|lic\.|cra\.|cr\.|dr\.|dra\.)\s*/i, '')
        .replace(/\s*\([^)]*\)/g, '')
        .trim();

    const cleanNorm = normalize(clean);

    // 2. Check project team members (supports any domain)
    if (project?.team) {
      const member = project.team.find((m) => {
        if (!m.name) return false;
        const mNorm = normalize(m.name);
        return mNorm === cleanNorm || mNorm.includes(cleanNorm) || cleanNorm.includes(mNorm);
      });
      if (member?.email && member.email.includes('@')) {
        const teamEmailMatch = member.email.match(emailRegex);
        if (teamEmailMatch) return teamEmailMatch[1].toLowerCase().trim();
        return member.email.trim().toLowerCase();
      }
    }

    // 3. Check app registered users list (supports any domain)
    if (allUsers) {
      const matched = allUsers.find((u) => {
        const uNorm = normalize(u.name || '');
        const usrNorm = (u.username || '').toLowerCase().trim();
        return (
          uNorm === cleanNorm ||
          usrNorm === cleanNorm ||
          uNorm.includes(cleanNorm) ||
          cleanNorm.includes(uNorm)
        );
      });
      if (matched?.email && matched.email.includes('@')) {
        const userEmailMatch = matched.email.match(emailRegex);
        if (userEmailMatch) return userEmailMatch[1].toLowerCase().trim();
        return matched.email.trim().toLowerCase();
      }
    }

    return null;
  },

  /**
   * Get all logs from localStorage
   */
  getLogs(): NotificationLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_LOGS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Save a notification log locally and to Firestore
   */
  async recordLog(log: NotificationLog): Promise<void> {
    try {
      const current = this.getLogs();
      const next = [log, ...current.slice(0, 199)];
      localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(next));

      // Attempt to save in Firestore
      await ensureFirebaseAuth();
      const logRef = doc(db, 'notificationLogs', log.id);
      await setDoc(logRef, log, { merge: true });
    } catch (e) {
      console.warn('Could not record notification log to cloud:', e);
    }
  },

  /**
   * Check if a specific reminder was already sent
   */
  wasReminderSent(reminderId: string): boolean {
    const logs = this.getLogs();
    return logs.some((l) => l.id === reminderId && l.status === 'sent');
  },

  /**
   * Calculate pending reminders for actions (due today or overdue by multiples of 15 days)
   */
  calculatePendingReminders(
    projects: SAPProject[],
    allUsers?: AppUser[]
  ): PendingActionReminder[] {
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);
    const reminders: PendingActionReminder[] = [];

    projects.forEach((project) => {
      // Ignore cancelled or delivered projects
      if (
        project.state.includes('Cancelado') ||
        project.state.startsWith('8-') ||
        project.state.startsWith('08-')
      ) {
        return;
      }

      project.actions.forEach((action) => {
        if (action.status === 'Finalizada' || !action.requiredDate) return;

        const reqDate = new Date(action.requiredDate);
        const diffTime = today.getTime() - reqDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        const recipientEmail = this.resolveUserEmail(
          action.responsible,
          project,
          allUsers
        );
        if (!recipientEmail) return;

        // Condition A: Due Today (diffDays === 0)
        if (diffDays === 0) {
          const reminderId = `due_today_${action.id}_${todayStr}`;
          if (!this.wasReminderSent(reminderId)) {
            const subject = `⏰ [Recordatorio Hoy] Acción: ${action.title} (${project.code})`;
            const previewHtml = this.generateActionReminderEmailHtml({
              project,
              action,
              type: 'due_today',
              daysDiff: 0,
              recipientEmail,
            });
            reminders.push({
              id: reminderId,
              action,
              project,
              type: 'due_today',
              daysDiff: 0,
              recipientName: action.responsible,
              recipientEmail,
              suggestedSubject: subject,
              previewHtml,
            });
          }
        }
        // Condition B: Overdue and multiple of 15 days (diffDays >= 15 && diffDays % 15 === 0)
        else if (diffDays >= 15 && diffDays % 15 === 0) {
          const bracket = Math.floor(diffDays / 15) * 15;
          const reminderId = `overdue_${bracket}d_${action.id}_${todayStr}`;
          if (!this.wasReminderSent(reminderId)) {
            const subject = `⚠️ [Aviso Vencimiento +${bracket} Días] Acción Pendiente: ${action.title} (${project.code})`;
            const previewHtml = this.generateActionReminderEmailHtml({
              project,
              action,
              type: 'overdue_15_days',
              daysDiff: diffDays,
              recipientEmail,
            });
            reminders.push({
              id: reminderId,
              action,
              project,
              type: 'overdue_15_days',
              daysDiff: diffDays,
              recipientName: action.responsible,
              recipientEmail,
              suggestedSubject: subject,
              previewHtml,
            });
          }
        }
      });
    });

    return reminders;
  },

  /**
   * HTML Template: New Project Notification
   */
  generateNewProjectEmailHtml(project: SAPProject): string {
    const modulesBadge = project.sapModules
      .map(
        (m) =>
          `<span style="display:inline-block;background:#eff6ff;color:#1d4ed8;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:bold;margin-right:4px;border:1px solid #bfdbfe;">${m}</span>`
      )
      .join(' ');

    const teamList =
      project.team && project.team.length > 0
        ? project.team
            .map(
              (m) =>
                `<li style="margin-bottom:4px;"><strong>${m.name}</strong> - ${m.role} ${m.email ? `(<a href="mailto:${m.email}" style="color:#2563eb;">${m.email}</a>)` : ''}</li>`
            )
            .join('')
        : '<li>Sin miembros asignados formalmente</li>';

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; margin:0; padding:24px; color:#1e293b;">
        <div style="max-width:620px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header -->
          <div style="background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding:24px; color:#ffffff;">
            <p style="margin:0 0 6px 0; font-size:12px; text-transform:uppercase; letter-spacing:1px; opacity:0.85; font-weight:600;">Crucianelli • Mejora Continua SAP</p>
            <h1 style="margin:0; font-size:22px; font-weight:bold;">✨ Nuevo Proyecto Registrado</h1>
          </div>

          <!-- Body -->
          <div style="padding:24px;">
            <p style="font-size:15px; line-height:1.5; margin-top:0;">
              Se ha dado de alta un nuevo proyecto de mejora en el sistema y formás parte de los interesados o del equipo asignado:
            </p>

            <!-- Project Card -->
            <div style="background:#f1f5f9; border-radius:8px; padding:16px; margin:18px 0; border-left:4px solid #2563eb;">
              <div style="font-size:12px; color:#64748b; margin-bottom:4px; font-family:monospace; font-weight:bold;">
                ${project.code} • ${project.area} • Prioridad #${project.priority}
              </div>
              <h2 style="margin:0 0 10px 0; font-size:18px; color:#0f172a;">${project.title}</h2>
              <div style="margin-bottom:12px;">${modulesBadge}</div>
              <p style="font-size:13px; margin:0; color:#334155;"><strong>Estado Inicial:</strong> ${project.state}</p>
            </div>

            <!-- Details -->
            <div style="margin:16px 0;">
              <h3 style="font-size:14px; text-transform:uppercase; color:#475569; margin-bottom:6px; letter-spacing:0.5px;">Situación Actual:</h3>
              <p style="font-size:14px; line-height:1.5; color:#334155; background:#fafafa; padding:12px; border-radius:6px; margin:0; border:1px solid #f1f5f9;">
                ${project.currentSituation || 'Sin detalle descriptivo.'}
              </p>
            </div>

            <div style="margin:16px 0;">
              <h3 style="font-size:14px; text-transform:uppercase; color:#475569; margin-bottom:6px; letter-spacing:0.5px;">Necesidad de Mejora:</h3>
              <p style="font-size:14px; line-height:1.5; color:#334155; background:#fafafa; padding:12px; border-radius:6px; margin:0; border:1px solid #f1f5f9;">
                ${project.improvementNeed || 'Sin detalle descriptivo.'}
              </p>
            </div>

            <!-- Team -->
            <div style="margin:20px 0;">
              <h3 style="font-size:14px; text-transform:uppercase; color:#475569; margin-bottom:8px; letter-spacing:0.5px;">Equipo del Proyecto:</h3>
              <ul style="font-size:13px; color:#334155; padding-left:20px; margin:0;">
                ${teamList}
              </ul>
            </div>

            <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;" />

            <p style="font-size:12px; color:#64748b; line-height:1.5; margin-bottom:0;">
              Podés ingresar a la aplicación para consultar el cronograma detallado plan vs. real y cargar las acciones correspondientes.
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#f8fafc; padding:14px 24px; border-top:1px solid #e2e8f0; font-size:11px; color:#94a3b8; text-align:center;">
            Notificación automática emitida por el Sistema de Gestión de Proyectos de Mejora SAP • Crucianelli
          </div>
        </div>
      </body>
      </html>
    `;
  },

  /**
   * HTML Template: New Action Assigned Notification
   */
  generateNewActionEmailHtml(project: SAPProject, action: StageAction): string {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; margin:0; padding:24px; color:#1e293b;">
        <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header -->
          <div style="background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding:22px; color:#ffffff;">
            <p style="margin:0 0 4px 0; font-size:12px; text-transform:uppercase; letter-spacing:1px; opacity:0.9; font-weight:600;">Crucianelli • Mejora Continua SAP</p>
            <h1 style="margin:0; font-size:20px; font-weight:bold;">📌 Nueva Acción Asignada</h1>
          </div>

          <!-- Body -->
          <div style="padding:24px;">
            <p style="font-size:15px; margin-top:0;">
              Hola <strong>${action.responsible}</strong>, se ha creado una nueva acción bajo tu responsabilidad:
            </p>

            <!-- Action Card -->
            <div style="background:#f0f9ff; border-radius:8px; padding:16px; margin:16px 0; border-left:4px solid #0284c7;">
              <div style="font-size:12px; color:#0369a1; font-weight:bold; margin-bottom:4px;">
                PROYECTO: ${project.code} - ${project.title}
              </div>
              <h2 style="margin:0 0 10px 0; font-size:17px; color:#0c4a6e;">
                ${action.title}
              </h2>
              <div style="font-size:13px; color:#334155; margin-bottom:6px;">
                <strong>Etapa:</strong> ${action.stageName}
              </div>
              <div style="font-size:13px; color:#334155; margin-bottom:6px;">
                <strong>Fecha Límite / Compromiso:</strong> 
                <span style="color:#b91c1c; font-weight:bold;">${action.requiredDate || 'No definida'}</span>
              </div>
              <div style="font-size:13px; color:#334155;">
                <strong>Estado Inicial:</strong> <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:bold;">${action.status}</span>
              </div>
            </div>

            <p style="font-size:13px; line-height:1.5; color:#475569;">
              Por favor revisá los avances correspondientes antes de la fecha límite para mantener actualizado el cronograma del proyecto en la barrida semanal.
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#f8fafc; padding:12px 24px; border-top:1px solid #e2e8f0; font-size:11px; color:#94a3b8; text-align:center;">
            Notificación automática de gestión de acciones • Crucianelli
          </div>
        </div>
      </body>
      </html>
    `;
  },

  /**
   * HTML Template: Due Today & Overdue Reminders
   */
  generateActionReminderEmailHtml({
    project,
    action,
    type,
    daysDiff,
    recipientEmail,
  }: {
    project: SAPProject;
    action: StageAction;
    type: 'due_today' | 'overdue_15_days';
    daysDiff: number;
    recipientEmail: string;
  }): string {
    const isDueToday = type === 'due_today';
    const headerBg = isDueToday
      ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
      : 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)';
    const title = isDueToday
      ? '⏰ Acción con Vencimiento Hoy'
      : `⚠️ Alerta: Acción Vencida (+${daysDiff} días)`;

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background:#f8fafc; margin:0; padding:24px; color:#1e293b;">
        <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header -->
          <div style="background:${headerBg}; padding:22px; color:#ffffff;">
            <p style="margin:0 0 4px 0; font-size:12px; text-transform:uppercase; letter-spacing:1px; opacity:0.9; font-weight:600;">Crucianelli • Alerta de Seguimiento SAP</p>
            <h1 style="margin:0; font-size:20px; font-weight:bold;">${title}</h1>
          </div>

          <!-- Body -->
          <div style="padding:24px;">
            <p style="font-size:15px; margin-top:0;">
              Hola <strong>${action.responsible}</strong>,
              ${
                isDueToday
                  ? 'te recordamos que hoy es la fecha estimada de finalización para la siguiente acción:'
                  : `te recordamos que la siguiente acción continúa sin finalizar y cuenta con <strong>${daysDiff} días de desvío</strong> respecto a su fecha original:`
              }
            </p>

            <!-- Card -->
            <div style="background:${isDueToday ? '#fffbeb' : '#fef2f2'}; border-radius:8px; padding:16px; margin:16px 0; border-left:4px solid ${isDueToday ? '#d97706' : '#dc2626'};">
              <div style="font-size:12px; color:#64748b; font-weight:bold; margin-bottom:4px;">
                PROYECTO: ${project.code} - ${project.title} (${project.area})
              </div>
              <h2 style="margin:0 0 10px 0; font-size:17px; color:#0f172a;">
                ${action.title}
              </h2>
              <div style="font-size:13px; color:#334155; margin-bottom:6px;">
                <strong>Fecha de Vencimiento:</strong> <span style="color:#b91c1c; font-weight:bold;">${action.requiredDate}</span>
              </div>
              <div style="font-size:13px; color:#334155; margin-bottom:6px;">
                <strong>Etapa:</strong> ${action.stageName}
              </div>
              <div style="font-size:13px; color:#334155;">
                <strong>Estado Actual:</strong> <span style="font-weight:bold;">${action.status}</span>
              </div>
            </div>

            <p style="font-size:13px; line-height:1.5; color:#475569;">
              ${
                isDueToday
                  ? 'Si ya completaste la tarea, recordá cambiar el estado a "Finalizada" en el sistema.'
                  : 'Por favor coordiná con el PMO o actualizá los comentarios de avance en el sistema para definir una nueva fecha de compromiso o completar la tarea.'
              }
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#f8fafc; padding:12px 24px; border-top:1px solid #e2e8f0; font-size:11px; color:#94a3b8; text-align:center;">
            Notificación periódica automática de gestión de acciones • Crucianelli
          </div>
        </div>
      </body>
      </html>
    `;
  },

  /**
   * Send an email via the Gmail API
   */
  async sendEmailViaGmail({
    to,
    subject,
    htmlBody,
    accessToken,
    senderEmail,
  }: {
    to: string[];
    subject: string;
    htmlBody: string;
    accessToken: string;
    senderEmail?: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      if (!to || to.length === 0) {
        throw new Error('No hay destinatarios especificados');
      }

      const raw = createRawEmail({
        to,
        subject,
        htmlBody,
        from: senderEmail,
      });

      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error?.message || `Error Gmail API: ${response.statusText}`
        );
      }

      const result = await response.json();
      return { success: true, id: result.id };
    } catch (error: any) {
      console.error('Failed to send email via Gmail:', error);
      return { success: false, error: error.message || String(error) };
    }
  },

  /**
   * Send notification for a newly created project to all its team members
   */
  async sendNewProjectNotification({
    project,
    accessToken,
    senderEmail,
    allUsers,
  }: {
    project: SAPProject;
    accessToken: string;
    senderEmail: string;
    allUsers?: AppUser[];
  }): Promise<NotificationLog> {
    const recipientsSet = new Set<string>();

    if (project.team && project.team.length > 0) {
      project.team.forEach((m) => {
        const resolved = this.resolveUserEmail(m.name, project, allUsers);
        if (resolved) recipientsSet.add(resolved);
        if (m.email && m.email.includes('@')) recipientsSet.add(m.email.trim());
      });
    }

    const recipients = Array.from(recipientsSet);
    const subject = `✨ [Nuevo Proyecto SAP] ${project.code}: ${project.title} (${project.area})`;
    const htmlBody = this.generateNewProjectEmailHtml(project);

    const log: NotificationLog = {
      id: `np_${project.id}_${Date.now()}`,
      type: 'new_project',
      projectId: project.id,
      projectCode: project.code,
      projectTitle: project.title,
      recipients,
      sentAt: new Date().toISOString(),
      senderEmail,
      status: 'failed',
      subject,
    };

    if (recipients.length === 0) {
      log.error = 'El proyecto no tiene miembros con correos electrónicos asociados';
      await this.recordLog(log);
      return log;
    }

    const res = await this.sendEmailViaGmail({
      to: recipients,
      subject,
      htmlBody,
      accessToken,
      senderEmail,
    });

    if (res.success) {
      log.status = 'sent';
    } else {
      log.status = 'failed';
      log.error = res.error;
    }

    await this.recordLog(log);
    return log;
  },

  /**
   * Send notification for a newly created action to its assigned responsible
   */
  async sendNewActionNotification({
    project,
    action,
    accessToken,
    senderEmail,
    allUsers,
  }: {
    project: SAPProject;
    action: StageAction;
    accessToken: string;
    senderEmail: string;
    allUsers?: AppUser[];
  }): Promise<NotificationLog> {
    const recipient = this.resolveUserEmail(action.responsible, project, allUsers);
    const subject = `📌 [Nueva Acción Asignada] ${action.title} - ${project.code}`;
    const htmlBody = this.generateNewActionEmailHtml(project, action);

    const log: NotificationLog = {
      id: `na_${action.id}_${Date.now()}`,
      type: 'new_action',
      projectId: project.id,
      projectCode: project.code,
      projectTitle: project.title,
      actionId: action.id,
      actionTitle: action.title,
      recipients: recipient ? [recipient] : [],
      sentAt: new Date().toISOString(),
      senderEmail,
      status: 'failed',
      subject,
    };

    if (!recipient) {
      log.error = `No se encontró dirección de correo para "${action.responsible}"`;
      await this.recordLog(log);
      return log;
    }

    const res = await this.sendEmailViaGmail({
      to: [recipient],
      subject,
      htmlBody,
      accessToken,
      senderEmail,
    });

    if (res.success) {
      log.status = 'sent';
    } else {
      log.status = 'failed';
      log.error = res.error;
    }

    await this.recordLog(log);
    return log;
  },

  /**
   * Send a single action reminder
   */
  async sendReminderNotification({
    reminder,
    accessToken,
    senderEmail,
  }: {
    reminder: PendingActionReminder;
    accessToken: string;
    senderEmail: string;
  }): Promise<NotificationLog> {
    const log: NotificationLog = {
      id: reminder.id,
      type: reminder.type,
      projectId: reminder.project.id,
      projectCode: reminder.project.code,
      projectTitle: reminder.project.title,
      actionId: reminder.action.id,
      actionTitle: reminder.action.title,
      recipients: [reminder.recipientEmail],
      sentAt: new Date().toISOString(),
      senderEmail,
      status: 'failed',
      subject: reminder.suggestedSubject,
    };

    const res = await this.sendEmailViaGmail({
      to: [reminder.recipientEmail],
      subject: reminder.suggestedSubject,
      htmlBody: reminder.previewHtml,
      accessToken,
      senderEmail,
    });

    if (res.success) {
      log.status = 'sent';
    } else {
      log.status = 'failed';
      log.error = res.error;
    }

    await this.recordLog(log);
    return log;
  },

  /**
   * Process all pending due/overdue reminders automatically in the background
   */
  async processAutomaticReminders({
    projects,
    allUsers,
    accessToken,
    senderEmail,
  }: {
    projects: SAPProject[];
    allUsers: AppUser[];
    accessToken: string;
    senderEmail: string;
  }): Promise<{ sentCount: number; errorsCount: number }> {
    const pending = this.calculatePendingReminders(projects, allUsers);
    if (pending.length === 0) return { sentCount: 0, errorsCount: 0 };

    let sentCount = 0;
    let errorsCount = 0;

    for (const reminder of pending) {
      try {
        const log = await this.sendReminderNotification({
          reminder,
          accessToken,
          senderEmail,
        });
        if (log.status === 'sent') {
          sentCount++;
        } else {
          errorsCount++;
        }
      } catch (err) {
        console.warn('Error en envío de recordatorio automático:', err);
        errorsCount++;
      }
    }

    return { sentCount, errorsCount };
  },

  /**
   * Send a test email to verify Gmail API integration
   */
  async sendTestEmail({
    to,
    accessToken,
    senderEmail,
  }: {
    to: string;
    accessToken: string;
    senderEmail: string;
  }): Promise<{ success: boolean; error?: string }> {
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f8fafc; margin:0; padding:24px; color:#1e293b;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding:20px 24px; color:#ffffff;">
            <p style="margin:0 0 4px 0; font-size:11px; text-transform:uppercase; letter-spacing:1px; opacity:0.85; font-weight:600;">Crucianelli • Mejora Continua SAP</p>
            <h1 style="margin:0; font-size:20px; font-weight:bold;">✅ Vinculación de Correo Exitosa</h1>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 14px 0; font-size:14px; color:#334155;">
              Este es un correo de prueba enviado desde el <strong>Sistema Integral de Proyectos SAP Crucianelli</strong>.
            </p>
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px 16px; margin-bottom:16px;">
              <p style="margin:0; font-size:13px; color:#166534;">
                <strong>Cuenta remitente configurada:</strong> ${senderEmail}<br/>
                <strong>Estado:</strong> Vinculada correctamente con permisos de envío automático por Gmail.
              </p>
            </div>
            <p style="margin:0; font-size:12px; color:#64748b;">
              A partir de ahora, cuando crees un proyecto o agregues una acción, las notificaciones saldrán automáticamente desde esta cuenta.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmailViaGmail({
      to: [to],
      subject: '✅ [Crucianelli SAP] Prueba de vinculación de correo exitosa',
      htmlBody,
      accessToken,
      senderEmail,
    });
  },
};

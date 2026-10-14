import { db, ensureFirebaseAuth } from '../src/services/firebase.js';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { sendMailWithResilience, resolveSmtpConfig } from './_mailer.js';
import { SAPProject, StageAction, AppUser } from '../src/types/project.js';

function cleanPersonName(name?: string): string {
  if (!name) return '';
  return name.trim().toLowerCase();
}

function resolveUserEmail(
  responsibleName: string,
  project: SAPProject,
  allUsers: AppUser[] = []
): string | null {
  const cleanName = cleanPersonName(responsibleName);
  if (!cleanName || cleanName === 'sin asignar' || cleanName === 'sin asignar.') {
    return null;
  }

  // 1. Direct match in users directory
  const matchedUser = allUsers.find(
    (u) =>
      cleanPersonName(u.name) === cleanName ||
      cleanPersonName(u.email) === cleanName ||
      (u.email && cleanPersonName(u.email.split('@')[0]) === cleanName)
  );
  if (matchedUser?.email) return matchedUser.email;

  // 2. Project team match
  if (project.team && Array.isArray(project.team)) {
    const member = project.team.find((m) => cleanPersonName(m.name) === cleanName);
    if (member?.email) return member.email;
  }

  // 4. Fallback: if responsibleName is already an email
  if (responsibleName.includes('@') && responsibleName.includes('.')) {
    return responsibleName.trim();
  }

  return null;
}

function generateReminderEmailHtml({
  project,
  action,
  type,
  daysDiff,
}: {
  project: SAPProject;
  action: StageAction;
  type: 'due_today' | 'overdue_15_days';
  daysDiff: number;
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
                ? 'te recordamos que hoy es la fecha límite de entrega para la siguiente acción:'
                : `te recordamos que la siguiente acción continúa pendiente con <strong>${daysDiff} días de desvío</strong> respecto a su fecha original:`
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
              <strong>Fecha Límite:</strong> <span style="color:#b91c1c; font-weight:bold;">${action.requiredDate}</span>
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
                ? 'Si ya completaste la tarea, recordá ingresar al sistema para cambiar el estado a "Finalizada".'
                : 'Por favor coordiná con el PMO o actualizá los comentarios de avance en la barrida semanal para redefinir la fecha de compromiso o completar la tarea.'
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
}

// In-memory mutex to prevent concurrent runs on the same server instance
let isProcessingServerReminders = false;

export async function processServerReminders(force: boolean = false): Promise<{
  success: boolean;
  status: string;
  date: string;
  sentCount: number;
  skippedCount: number;
  errorsCount: number;
}> {
  if (isProcessingServerReminders) {
    return {
      success: false,
      status: 'locked_in_progress',
      date: new Date().toISOString().split('T')[0],
      sentCount: 0,
      skippedCount: 0,
      errorsCount: 0,
    };
  }

  isProcessingServerReminders = true;
  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date(todayStr);

  try {
    // 1. Ensure Firebase Auth if required/available
    try {
      await ensureFirebaseAuth();
    } catch {
      // Non-blocking: Firestore rules permit read/write or anonymous auth is disabled
    }

    // 2. Check if today's overall run already completed (unless forced)
    const dailyRunRef = doc(db, 'sentReminders', `daily_run_${todayStr}`);
    if (!force) {
      try {
        const dailyRunSnap = await getDoc(dailyRunRef);
        if (dailyRunSnap.exists()) {
          return {
            success: true,
            status: 'already_completed_today',
            date: todayStr,
            sentCount: 0,
            skippedCount: 0,
            errorsCount: 0,
          };
        }
      } catch (readErr) {
        console.warn('Could not read daily_run lock from Firestore:', readErr);
      }
    }

    // 3. Check SMTP availability
    const smtpConfig = resolveSmtpConfig();
    if (!smtpConfig.isConfigured || !smtpConfig.user || !smtpConfig.pass) {
      console.warn('Server reminders skipped: Central SMTP is not configured.');
      return {
        success: false,
        status: 'smtp_not_configured',
        date: todayStr,
        sentCount: 0,
        skippedCount: 0,
        errorsCount: 0,
      };
    }

    // 4. Fetch Projects and Users from Firestore
    const [projectsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'projects')),
      getDocs(collection(db, 'users')),
    ]);

    const projects: SAPProject[] = [];
    projectsSnap.forEach((d) => projects.push(d.data() as SAPProject));

    const allUsers: AppUser[] = [];
    usersSnap.forEach((d) => allUsers.push(d.data() as AppUser));

    let sentCount = 0;
    let skippedCount = 0;
    let errorsCount = 0;

    for (const project of projects) {
      // Ignore cancelled or delivered projects
      if (
        project.state.includes('Cancelado') ||
        project.state.startsWith('8-') ||
        project.state.startsWith('08-') ||
        project.state.includes('07- Entregado')
      ) {
        continue;
      }

      if (!project.actions || !Array.isArray(project.actions)) continue;

      for (const action of project.actions) {
        if (action.status === 'Finalizada' || !action.requiredDate) continue;

        const reqDate = new Date(action.requiredDate);
        const diffTime = today.getTime() - reqDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        const recipientEmail = resolveUserEmail(action.responsible, project, allUsers);
        if (!recipientEmail) {
          skippedCount++;
          continue;
        }

        // Determine if action qualifies for Due Today or Overdue Every 15 Days
        let reminderType: 'due_today' | 'overdue_15_days' | null = null;
        let lockKey: string | null = null;
        let subject: string | null = null;

        if (diffDays === 0) {
          // Exactly on due date
          reminderType = 'due_today';
          lockKey = `due_today_${action.id}`;
          subject = `⏰ [Recordatorio Hoy] Acción: ${action.title} (${project.code})`;
        } else if (diffDays >= 15) {
          // Multiples of 15 days (15, 30, 45, 60...)
          const bracket = Math.floor(diffDays / 15) * 15;
          reminderType = 'overdue_15_days';
          lockKey = `overdue_${bracket}d_${action.id}`;
          subject = `⚠️ [Aviso Vencimiento +${bracket} Días] Acción Pendiente: ${action.title} (${project.code})`;
        }

        if (!reminderType || !lockKey || !subject) {
          continue;
        }

        // 5. Cloud Firestore Lock Check: Was this specific reminder already sent?
        const reminderDocRef = doc(db, 'sentReminders', lockKey);
        try {
          const reminderSnap = await getDoc(reminderDocRef);
          if (reminderSnap.exists()) {
            skippedCount++;
            continue;
          }
        } catch (checkErr) {
          console.warn(`Could not check lock for ${lockKey}:`, checkErr);
        }

        // 6. Generate HTML and dispatch via Central SMTP
        const htmlBody = generateReminderEmailHtml({
          project,
          action,
          type: reminderType,
          daysDiff: Math.max(0, diffDays),
        });

        try {
          const mailInfo = await sendMailWithResilience({
            from: smtpConfig.from,
            to: recipientEmail,
            subject,
            html: htmlBody,
          });

          if (mailInfo.messageId) {
            sentCount++;
            console.log(`[Server Cron] Reminder sent: ${lockKey} -> ${recipientEmail}`);

            // Seal the lock in Firestore so NO ONE ever sends it again
            await setDoc(reminderDocRef, {
              lockKey,
              actionId: action.id,
              actionTitle: action.title,
              projectCode: project.code,
              projectId: project.id,
              type: reminderType,
              daysDiff: Math.max(0, diffDays),
              recipientEmail,
              sentAt: new Date().toISOString(),
              messageId: mailInfo.messageId,
              status: 'sent',
            });

            // Also record in notificationLogs collection for audit visibility
            await setDoc(doc(db, 'notificationLogs', lockKey), {
              id: lockKey,
              type: reminderType,
              projectId: project.id,
              projectCode: project.code,
              projectTitle: project.title,
              actionId: action.id,
              actionTitle: action.title,
              recipients: [recipientEmail],
              sentAt: new Date().toISOString(),
              senderEmail: smtpConfig.user,
              status: 'sent',
              subject,
            });
          } else {
            errorsCount++;
          }
        } catch (sendErr) {
          console.error(`[Server Cron] Failed sending ${lockKey} to ${recipientEmail}:`, sendErr);
          errorsCount++;
        }
      }
    }

    // 7. Mark daily run as completed
    await setDoc(dailyRunRef, {
      date: todayStr,
      completedAt: new Date().toISOString(),
      sentCount,
      skippedCount,
      errorsCount,
      totalProjectsEvaluated: projects.length,
    });

    return {
      success: true,
      status: 'completed',
      date: todayStr,
      sentCount,
      skippedCount,
      errorsCount,
    };
  } catch (err: any) {
    console.error('[Server Cron] Error processing server reminders:', err);
    return {
      success: false,
      status: `error: ${err.message || 'unknown'}`,
      date: todayStr,
      sentCount: 0,
      skippedCount: 0,
      errorsCount: 1,
    };
  } finally {
    isProcessingServerReminders = false;
  }
}

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Send, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCw, 
  History, 
  ExternalLink, 
  AlertCircle,
  Sparkles,
  Info,
  Layers,
  ChevronRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { SAPProject, AppUser, UserSession } from '../types/project';
import { 
  emailNotificationService, 
  PendingActionReminder, 
  NotificationLog 
} from '../services/emailNotificationService';
import { 
  getAccessToken, 
  getCurrentGoogleUser, 
  googleSignIn 
} from '../services/googleAuthService';

interface EmailNotificationsModalProps {
  projects: SAPProject[];
  allUsers: AppUser[];
  currentUser: UserSession;
  onClose: () => void;
  onRefreshProjects?: () => void;
}

export const EmailNotificationsModal: React.FC<EmailNotificationsModalProps> = ({
  projects,
  allUsers,
  currentUser,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'reminders' | 'history' | 'rules'>('reminders');
  const [reminders, setReminders] = useState<PendingActionReminder[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>(() => emailNotificationService.getLogs());
  const [isSending, setIsSending] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Previewing reminder
  const [previewReminder, setPreviewReminder] = useState<PendingActionReminder | null>(null);

  // Google Auth state
  const [googleUser, setGoogleUser] = useState(() => getCurrentGoogleUser());
  const [accessToken, setAccessToken] = useState(() => getAccessToken());
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  // Load reminders
  const reloadReminders = () => {
    const list = emailNotificationService.calculatePendingReminders(projects, allUsers);
    setReminders(list);
    setLogs(emailNotificationService.getLogs());
  };

  useEffect(() => {
    reloadReminders();
  }, [projects, allUsers]);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    setStatusMessage(null);
    try {
      const res = await googleSignIn();
      setGoogleUser(res.user);
      setAccessToken(res.accessToken);
      setStatusMessage({
        text: `Conectado exitosamente con ${res.user.email}. Listo para enviar notificaciones vía Gmail.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Google connect error:', err);
      setStatusMessage({
        text: err.message || 'No se pudo conectar con Google/Gmail.',
        type: 'error',
      });
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleSendSingleReminder = async (reminder: PendingActionReminder) => {
    const token = accessToken || getAccessToken();
    const sender = googleUser?.email || currentUser.email || 'notificaciones@crucianelli.com';

    if (!token) {
      setStatusMessage({
        text: 'Por favor iniciá sesión con Google para enviar el correo a través de Gmail.',
        type: 'error',
      });
      return;
    }

    const confirmed = window.confirm(
      `¿Confirmás el envío de este recordatorio a "${reminder.recipientName}" (${reminder.recipientEmail}) vía Gmail?\n\nAsunto: ${reminder.suggestedSubject}`
    );
    if (!confirmed) return;

    setIsSending(true);
    setStatusMessage(null);

    try {
      const result = await emailNotificationService.sendReminderNotification({
        reminder,
        accessToken: token,
        senderEmail: sender,
      });

      if (result.status === 'sent') {
        setStatusMessage({
          text: `Correo enviado con éxito a ${reminder.recipientEmail}.`,
          type: 'success',
        });
        reloadReminders();
      } else {
        setStatusMessage({
          text: `Error al enviar correo: ${result.error || 'Fallo desconocido'}`,
          type: 'error',
        });
      }
    } catch (e: any) {
      setStatusMessage({
        text: `Error: ${e.message}`,
        type: 'error',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendAllReminders = async () => {
    const token = accessToken || getAccessToken();
    const sender = googleUser?.email || currentUser.email || 'notificaciones@crucianelli.com';

    if (!token) {
      setStatusMessage({
        text: 'Por favor iniciá sesión con Google para enviar los correos a través de Gmail.',
        type: 'error',
      });
      return;
    }

    if (reminders.length === 0) return;

    const confirmed = window.confirm(
      `¿Confirmás el envío de ${reminders.length} recordatorio(s) de acciones pendientes por Gmail a sus respectivos responsables?`
    );
    if (!confirmed) return;

    setIsSending(true);
    setStatusMessage({
      text: `Enviando ${reminders.length} notificaciones por Gmail...`,
      type: 'info',
    });

    let sentCount = 0;
    let failCount = 0;

    for (const reminder of reminders) {
      try {
        const result = await emailNotificationService.sendReminderNotification({
          reminder,
          accessToken: token,
          senderEmail: sender,
        });
        if (result.status === 'sent') sentCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setIsSending(false);
    reloadReminders();

    if (failCount === 0) {
      setStatusMessage({
        text: `Se enviaron exitosamente las ${sentCount} notificaciones vía Gmail.`,
        type: 'success',
      });
    } else {
      setStatusMessage({
        text: `Enviadas: ${sentCount}. Fallidas: ${failCount}. Consultá el historial para más detalles.`,
        type: 'info',
      });
    }
  };

  const handleSendTestEmail = async () => {
    const token = accessToken || getAccessToken();
    const targetEmail = googleUser?.email || currentUser.email;

    if (!token || !targetEmail) {
      setStatusMessage({
        text: 'Conectá tu cuenta de Google para enviar una prueba a tu correo.',
        type: 'error',
      });
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas enviar un correo de prueba de Crucianelli a "${targetEmail}" a través de Gmail?`
    );
    if (!confirmed) return;

    setIsSending(true);
    try {
      const res = await emailNotificationService.sendEmailViaGmail({
        to: [targetEmail],
        subject: '🧪 [Prueba] Notificación del Sistema de Mejora SAP Crucianelli',
        htmlBody: `
          <div style="font-family: sans-serif; padding: 20px; background: #f8fafc; color: #1e293b;">
            <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <h2 style="color: #2563eb; margin-top: 0;">¡Conexión Exitosa con Gmail!</h2>
              <p>Este correo confirma que el circuito de notificaciones automáticas por Gmail está configurado y funcionando correctamente para tu usuario.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0;" />
              <p style="font-size: 12px; color: #64748b;">Enviado desde el Sistema de Gestión de Proyectos de Mejora SAP • Crucianelli</p>
            </div>
          </div>
        `,
        accessToken: token,
        senderEmail: targetEmail,
      });

      if (res.success) {
        setStatusMessage({
          text: `Correo de prueba enviado con éxito a ${targetEmail}.`,
          type: 'success',
        });
        reloadReminders();
      } else {
        setStatusMessage({
          text: `Error al enviar correo de prueba: ${res.error}`,
          type: 'error',
        });
      }
    } catch (e: any) {
      setStatusMessage({
        text: `Error: ${e.message}`,
        type: 'error',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight flex items-center gap-2">
                Circuito de Notificaciones por Correo (Gmail)
              </h2>
              <p className="text-xs text-slate-300">
                Notificaciones automáticas para altas de proyectos y vencimientos de acciones
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gmail Connection Status Banner */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span className={`w-2.5 h-2.5 rounded-full ${accessToken ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span>Cuenta Gmail Emisora:</span>
            </div>
            {accessToken && googleUser ? (
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-900 font-bold">
                {googleUser.email}
              </span>
            ) : (
              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                Sin conectar con Google
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!accessToken ? (
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={isConnectingGoogle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{isConnectingGoogle ? 'Conectando...' : 'Conectar con Gmail'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={isSending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50"
                title="Envía un correo de prueba a tu propia casilla para verificar la integración"
              >
                <Send className="w-3.5 h-3.5 text-blue-600" />
                <span>Enviar Prueba</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Message Alert */}
        {statusMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-medium border-b flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 bg-white flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('reminders')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'reminders'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Recordatorios Pendientes</span>
            {reminders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                {reminders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Envíos</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
              {logs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'rules'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>Reglas del Circuito</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {/* TAB 1: REMINDERS */}
          {activeTab === 'reminders' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Acciones que requieren notificación por correo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Se detectan acciones que vencen hoy o que acumulan múltiplos de 15 días de atraso.
                  </p>
                </div>

                {reminders.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSendAllReminders}
                    disabled={isSending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Todos ({reminders.length})</span>
                  </button>
                )}
              </div>

              {reminders.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-6">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">
                    No hay recordatorios pendientes para enviar hoy
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Todas las acciones al día o ya notificadas. El sistema avisará el día exacto de vencimiento de cada acción y cada 15 días luego del vencimiento si continúa pendiente.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reminders.map((rem) => {
                    const isDueToday = rem.type === 'due_today';
                    return (
                      <div
                        key={rem.id}
                        className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-200 transition-colors shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center ${
                              isDueToday
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-rose-100 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isDueToday ? <Clock className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono font-bold text-xs text-slate-700">
                                {rem.project.code}
                              </span>
                              <span
                                className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                                  isDueToday
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {isDueToday ? 'Vence Hoy' : `Atrasada +${rem.daysDiff} días`}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                Fecha: {rem.action.requiredDate}
                              </span>
                            </div>

                            <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                              {rem.action.title}
                            </h4>

                            <p className="text-xs text-slate-500 mt-1">
                              Responsable: <strong className="text-slate-700">{rem.recipientName}</strong> •{' '}
                              <span className="font-mono text-blue-600">{rem.recipientEmail}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewReminder(rem)}
                            className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Vista previa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendSingleReminder(rem)}
                            disabled={isSending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" />
                            <span>Enviar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Historial de Notificaciones Emitidas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Registro de correos enviados a través de la cuenta de Gmail conectada
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reloadReminders}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Actualizar registro"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-slate-200 p-6 text-slate-400 text-xs">
                  Aún no se han registrado envíos de correos en esta sesión.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                  {logs.map((log) => {
                    const isSuccess = log.status === 'sent';
                    return (
                      <div key={log.id} className="p-3.5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-start gap-3">
                          <span
                            className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                              isSuccess ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">
                                {log.type === 'new_project'
                                  ? '✨ Alta de Proyecto'
                                  : log.type === 'new_action'
                                  ? '📌 Nueva Acción'
                                  : log.type === 'due_today'
                                  ? '⏰ Vence Hoy'
                                  : '⚠️ Vencida +15d'}
                              </span>
                              <span className="font-mono text-slate-500">
                                {log.projectCode}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {new Date(log.sentAt).toLocaleString('es-AR')}
                              </span>
                            </div>

                            <p className="text-slate-700 font-medium mt-0.5">
                              {log.subject}
                            </p>

                            <p className="text-[11px] text-slate-500">
                              Destinatario(s): <span className="font-mono text-slate-600">{log.recipients.join(', ')}</span>
                            </p>

                            {log.error && (
                              <p className="text-[11px] text-rose-600 mt-0.5">
                                Error: {log.error}
                              </p>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            isSuccess
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isSuccess ? 'Enviado' : 'Fallo'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RULES */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Circuito de Notificaciones Automáticas Crucianelli
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Rule 1 */}
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                      1
                    </div>
                    <h4 className="text-xs font-bold text-blue-950 uppercase mb-1">
                      Alta de Nuevo Proyecto
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Al crear y guardar un nuevo proyecto SAP en el sistema, se envía una notificación por correo a <strong>todos los miembros del equipo</strong> con el código, título, módulos, situación actual y necesidad de mejora.
                    </p>
                  </div>

                  {/* Rule 2 */}
                  <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                      2
                    </div>
                    <h4 className="text-xs font-bold text-indigo-950 uppercase mb-1">
                      Nueva Acción Cargada
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Cada vez que se carga una acción en cualquier proyecto, se envía un correo inmediato al <strong>responsable de ejecutarla</strong> indicando la fecha compromiso de finalización.
                    </p>
                  </div>

                  {/* Rule 3 */}
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                    <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs mb-2">
                      3
                    </div>
                    <h4 className="text-xs font-bold text-amber-950 uppercase mb-1">
                      Vencimiento y +15 Días
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Se envían alertas automáticas al responsable: <strong>el día exacto del vencimiento</strong> de la acción, y <strong>cada 15 días posteriores</strong> si la acción continúa en estado "Pendiente" o "En proceso".
                    </p>
                  </div>
                </div>

                <div className="mt-5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800">Seguridad y Permisos de Usuario:</strong> Los correos se envían a través de la API oficial de Gmail utilizando la sesión autorizada del usuario o PMO, garantizando la autenticidad del remitente corporativo y la privacidad de los datos.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {reminders.length > 0 ? (
              <span className="text-amber-700 font-medium">
                ⚠️ {reminders.length} recordatorio(s) listos para enviar hoy
              </span>
            ) : (
              '✅ Circuito de notificaciones al día'
            )}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {previewReminder && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between text-xs">
              <span className="font-bold">Vista Previa del Correo</span>
              <button
                type="button"
                onClick={() => setPreviewReminder(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-100 text-xs border-b border-slate-200 font-mono text-slate-700">
              <div><strong>Para:</strong> {previewReminder.recipientEmail}</div>
              <div><strong>Asunto:</strong> {previewReminder.suggestedSubject}</div>
            </div>
            <div
              className="p-4 overflow-y-auto flex-1 text-xs"
              dangerouslySetInnerHTML={{ __html: previewReminder.previewHtml }}
            />
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreviewReminder(null)}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-medium"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  const r = previewReminder;
                  setPreviewReminder(null);
                  handleSendSingleReminder(r);
                }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
              >
                Enviar este correo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

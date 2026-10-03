import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  LogOut, 
  RefreshCw, 
  ShieldCheck,
  Server,
  Lock,
  Key,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { emailNotificationService } from '../services/emailNotificationService';

interface GoogleAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedEmail: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSendTestEmail: (toEmail: string) => Promise<{ success: boolean; error?: string }>;
}

export const GoogleAccountModal: React.FC<GoogleAccountModalProps> = ({
  isOpen,
  onClose,
  connectedEmail,
  onConnect,
  onDisconnect,
  onSendTestEmail,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // SMTP state
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean;
    senderEmail?: string | null;
    maskedUser?: string | null;
    host?: string;
    port?: number;
  }>({ configured: false });

  const [isLoadingSmtp, setIsLoadingSmtp] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [showSmtpConfigForm, setShowSmtpConfigForm] = useState(false);

  // Form inputs for SMTP
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('465');

  const refreshSmtpStatus = async () => {
    setIsLoadingSmtp(true);
    try {
      const status = await emailNotificationService.checkSmtpStatus();
      setSmtpStatus(status);
      if (status.senderEmail) {
        setSmtpUser(status.senderEmail);
      }
      if (!status.configured) {
        setShowSmtpConfigForm(true);
      }
    } catch (e) {
      console.warn('Error checking SMTP status:', e);
    } finally {
      setIsLoadingSmtp(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshSmtpStatus();
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpUser || !smtpPass) {
      setTestResult({
        success: false,
        message: 'Por favor completá el correo remitente y la contraseña de aplicación.',
      });
      return;
    }

    setIsSavingSmtp(true);
    setTestResult(null);

    try {
      const res = await emailNotificationService.configureSmtpCredentials({
        user: smtpUser,
        pass: smtpPass,
        host: smtpHost,
        port: parseInt(smtpPort, 10),
      });

      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || '¡Servidor SMTP verificado y guardado con éxito en el servidor (.env)!',
        });
        setSmtpPass(''); // Clear input for security
        setShowSmtpConfigForm(false);
        await refreshSmtpStatus();
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Error al verificar las credenciales SMTP con Gmail.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Error de conexión con el backend.',
      });
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleTestSend = async () => {
    const target = testEmailAddress.trim() || smtpStatus.senderEmail || connectedEmail;
    if (!target) {
      setTestResult({
        success: false,
        message: 'Ingresá una dirección de correo para recibir la prueba.',
      });
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const activeConfig = smtpUser && smtpPass ? {
        user: smtpUser.trim(),
        pass: smtpPass.trim().replace(/\s+/g, ''),
        host: smtpHost.trim(),
        port: parseInt(smtpPort, 10),
      } : undefined;

      const res = await emailNotificationService.sendTestEmail({
        to: target,
        senderEmail: smtpStatus.senderEmail || smtpUser || connectedEmail || undefined,
        smtpConfig: activeConfig,
      });

      if (res.success) {
        setTestResult({
          success: true,
          message: `¡Correo de prueba enviado con éxito a ${target}! (Canal: ${res.channel === 'smtp' ? 'Servidor Central SMTP' : 'Gmail OAuth'}). Revisá tu bandeja de entrada o spam.`,
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || 'No se pudo enviar el correo de prueba. Verificá las credenciales.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Error al enviar correo de prueba.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    setTestResult(null);
    try {
      await onConnect();
    } catch (err: any) {
      console.error('Error al conectar Google:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      await onDisconnect();
      setTestResult({
        success: true,
        message: 'Cuenta de Google desvinculada exitosamente.',
      });
    } catch (err: any) {
      console.error('Error al desvincular:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Configuración de Envío de Mails (SMTP)</h2>
              <p className="text-xs text-blue-100/90">Despacho centralizado y automático para toda la plataforma</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* SECTION 1: SERVIDOR CENTRAL SMTP (RECOMENDADO) */}
          <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                  <Mail className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Buzón Remitente Central (SMTP)</h3>
                  <p className="text-[11px] text-slate-500">Envía automáticamente los mails de cualquier usuario</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                smtpStatus.configured 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {smtpStatus.configured ? '● SMTP Conectado' : '○ Pendiente de claves'}
              </span>
            </div>

            {smtpStatus.configured ? (
              <div className="bg-white rounded-xl p-3 border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Cuenta remitente configurada:</span>
                  <span className="font-mono font-bold text-slate-900">{smtpStatus.senderEmail || smtpStatus.maskedUser}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
                  <span>Servidor: {smtpStatus.host}:{smtpStatus.port}</span>
                  <button
                    type="button"
                    onClick={() => setShowSmtpConfigForm(!showSmtpConfigForm)}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <span>{showSmtpConfigForm ? 'Ocultar ajustes' : 'Cambiar credenciales'}</span>
                    {showSmtpConfigForm ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                <p className="leading-relaxed">
                  Para que cualquier usuario de la empresa dispare notificaciones sin vincular cuentas personales, ingresá a continuación el correo central de Gmail y su contraseña de aplicación.
                </p>
              </div>
            )}

            {/* Formulario de Configuración SMTP */}
            {showSmtpConfigForm && (
              <form onSubmit={handleSaveSmtp} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    Credenciales SMTP de Gmail (Guardadas en .env)
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                    Seguro (Ignorado por Git)
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Correo Electrónico Remitente de Gmail:
                    </label>
                    <input
                      type="email"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="ejemplo: notificaciones@crucianelli.com o tu_cuenta@gmail.com"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Contraseña de Aplicación de Google (16 letras):
                    </label>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="xxxx xxxx xxxx xxxx"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      required
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Generala en tu cuenta Google: <em>Seguridad &gt; Verificación en 2 pasos &gt; Contraseñas de aplicaciones</em>.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Host SMTP</label>
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        className="w-full px-2.5 py-1 border border-slate-200 rounded text-xs bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Puerto (SSL)</label>
                      <input
                        type="text"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        className="w-full px-2.5 py-1 border border-slate-200 rounded text-xs bg-slate-50"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowSmtpConfigForm(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSmtp}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{isSavingSmtp ? 'Verificando con Gmail...' : 'Verificar y Guardar en Servidor'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* SECTION 2: PROBAR ENVÍO DE CORREO */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-blue-600" />
              Probar Envío de Notificación
            </span>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                placeholder="Ingresá un correo de destino para la prueba"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
              />
              <button
                type="button"
                disabled={isSendingTest}
                onClick={handleTestSend}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-pulse' : ''}`} />
                <span>{isSendingTest ? 'Enviando...' : 'Enviar Prueba'}</span>
              </button>
            </div>
          </div>

          {/* Test message alert */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs leading-relaxed ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {testResult.message}
            </div>
          )}

          {/* SECTION 3: VINCULACIÓN INDIVIDUAL OAUTH (MÉTODO ALTERNATIVO) */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Método alternativo: Vincular cuenta Google personal</span>
              {connectedEmail && (
                <button
                  type="button"
                  onClick={handleDisconnectGoogle}
                  className="text-rose-600 hover:underline text-[11px] cursor-pointer"
                >
                  Desvincular
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Si el servidor SMTP no estuviera configurado, podés autorizar tu cuenta individual mediante Google OAuth.
            </p>
            {connectedEmail ? (
              <div className="flex items-center gap-1.5 text-emerald-700 font-mono text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Conectado como: {connectedEmail}</span>
              </div>
            ) : (
              <button
                type="button"
                disabled={isConnecting}
                onClick={handleConnectGoogle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>{isConnecting ? 'Abriendo Google...' : 'Conectar con Google OAuth'}</span>
              </button>
            )}
          </div>

          {/* Security Guarantee Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Garantía de Seguridad y Privacidad:
            </div>
            <p className="leading-relaxed">
              Las claves SMTP se configuran directamente en el archivo <code>.env</code> del servidor backend y están ignoradas por Git. 
              <strong> Nunca se suben a GitHub, nunca se exponen al navegador de los usuarios y no activan alertas en GitGuardian.</strong>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

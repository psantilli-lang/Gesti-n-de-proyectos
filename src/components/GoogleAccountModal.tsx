import React, { useState } from 'react';
import { 
  Mail, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  LogOut, 
  RefreshCw, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

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
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleConnect = async () => {
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

  const handleDisconnect = async () => {
    if (window.confirm('¿Deseas desconectar la cuenta de Google vinculada?')) {
      await onDisconnect();
      setTestResult(null);
    }
  };

  const handleTest = async () => {
    if (!connectedEmail) return;
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await onSendTestEmail(connectedEmail);
      if (res.success) {
        setTestResult({
          success: true,
          message: `¡Correo de prueba enviado con éxito a ${connectedEmail}! Revisá tu bandeja de entrada o spam.`,
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || 'No se pudo enviar el correo de prueba. Verificá los permisos.',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Vinculación de Cuenta de Correo (Gmail)</h2>
              <p className="text-xs text-blue-100/90">Remitente oficial de notificaciones automáticas</p>
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status Box */}
          {connectedEmail ? (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Cuenta Activa y Vinculada
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Listo para enviar
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900 font-mono select-all">
                {connectedEmail}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Todas las notificaciones automáticas (alta de nuevos proyectos, asignación de acciones y recordatorios por vencimiento) se emitirán desde esta casilla a través de la API oficial de Gmail.
              </p>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Ninguna cuenta de Google vinculada
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Para que la aplicación pueda enviar los correos automáticos por Gmail (a integrantes del proyecto y responsables de acciones), es necesario vincular una cuenta de Google con un solo clic.
              </p>
            </div>
          )}

          {/* Capabilities Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              ¿Cómo funciona el envío de correos?
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] pl-1">
              <li><strong>Remitente:</strong> La cuenta de Google que vincules aquí (ej. tu mail @crucianelli.com o una cuenta de área).</li>
              <li><strong>Destinatarios:</strong> Cualquier correo (@crucianelli.com, @gmail.com, @outlook.com o proveedores externos).</li>
              <li><strong>Disparadores automáticos:</strong> Al guardar un nuevo proyecto, al agregar una acción y en recordatorios de vencimiento.</li>
            </ul>
          </div>

          {/* Test message alert */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs leading-relaxed ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {testResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200">
            {connectedEmail ? (
              <>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Desvincular</span>
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    disabled={isConnecting}
                    onClick={handleConnect}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    title="Seleccionar otra cuenta de Google"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isConnecting ? 'animate-spin' : ''}`} />
                    <span>Cambiar de cuenta</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSendingTest}
                    onClick={handleTest}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-pulse' : ''}`} />
                    <span>{isSendingTest ? 'Enviando...' : 'Enviar correo de prueba'}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={handleConnect}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  <span>{isConnecting ? 'Abriendo Google...' : 'Vincular cuenta de Google / Gmail'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

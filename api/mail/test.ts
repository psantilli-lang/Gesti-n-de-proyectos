import { sendMailWithResilience, resolveSmtpConfig, parseJsonBody, sendJson, handleCors } from '../_mailer.js';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Método no permitido. Use POST.' });
  }

  try {
    const body = await parseJsonBody(req);
    const { to, smtpConfig } = body;

    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return sendJson(res, 400, { success: false, error: 'Ingresá una dirección de correo válida para la prueba.' });
    }

    const config = resolveSmtpConfig(smtpConfig);
    if (!config.isConfigured || !config.user || !config.pass) {
      return sendJson(res, 503, {
        success: false,
        error: 'El servidor SMTP no está configurado todavía. Verificá las variables SMTP_USER y SMTP_PASS en Vercel o en el entorno (.env).',
      });
    }

    const testHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f8fafc; margin:0; padding:24px; color:#1e293b;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background:linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding:20px 24px; color:#ffffff;">
            <p style="margin:0 0 4px 0; font-size:11px; text-transform:uppercase; letter-spacing:1px; opacity:0.85; font-weight:600;">Crucianelli • Mejora Continua SAP</p>
            <h1 style="margin:0; font-size:20px; font-weight:bold;">🚀 Servidor SMTP Centralizado Activo</h1>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 14px 0; font-size:14px; color:#334155;">
              ¡Excelente! El servidor central de correos de la plataforma <strong>SAP Crucianelli</strong> está funcionando correctamente desde la nube (Vercel / Producción).
            </p>
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px 16px; margin-bottom:16px;">
              <p style="margin:0; font-size:13px; color:#166534;">
                <strong>Buzón Remitente Central:</strong> ${config.user}<br/>
                <strong>Servidor SMTP:</strong> ${config.host}:${config.port}<br/>
                <strong>Modo:</strong> ${config.source === 'env' ? 'Variables de Entorno' : 'Servidor Central'}<br/>
                <strong>Estado:</strong> Conectado y verificado con éxito con tolerancia a fallos multi-puerto (465 SSL / 587 STARTTLS).
              </p>
            </div>
            <p style="margin:0; font-size:12px; color:#64748b;">
              A partir de ahora, todas las notificaciones de nuevos proyectos, asignaciones de tareas y recordatorios de vencimiento se despacharán de forma 100% automática desde este buzón central para cualquier usuario del sistema.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await sendMailWithResilience(
      {
        from: config.from,
        to,
        subject: '✅ [Crucianelli SAP] Prueba de Servidor SMTP Central exitosa',
        html: testHtml,
      },
      smtpConfig
    );

    return sendJson(res, 200, {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      message: `Correo de prueba enviado con éxito a ${to} desde el buzón central (${config.user}).`,
    });
  } catch (error: any) {
    console.error('API /api/mail/test error:', error);
    return sendJson(res, 500, {
      success: false,
      error: error.message || 'Error al conectar con el servidor SMTP de Gmail.',
      code: error.code,
    });
  }
}

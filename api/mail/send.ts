import { sendMailWithResilience, resolveSmtpConfig, parseJsonBody, sendJson, handleCors } from '../_mailer.js';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Método no permitido. Use POST.' });
  }

  try {
    const body = await parseJsonBody(req);
    const { to, subject, htmlBody, textBody, from, smtpConfig } = body;

    if (!to || (!Array.isArray(to) && typeof to !== 'string')) {
      return sendJson(res, 400, { success: false, error: 'Destinatario "to" inválido o ausente.' });
    }

    if (!subject || !htmlBody) {
      return sendJson(res, 400, { success: false, error: 'Faltan campos obligatorios: "subject" o "htmlBody".' });
    }

    const config = resolveSmtpConfig(smtpConfig);
    if (!config.isConfigured || !config.user || !config.pass) {
      return sendJson(res, 503, {
        success: false,
        error: 'Servidor SMTP central no configurado. Se deben definir SMTP_USER y SMTP_PASS en Vercel o en el entorno (.env).',
      });
    }

    const recipients = Array.isArray(to) ? to.join(', ') : to;

    const mailOptions = {
      from: from || config.from,
      to: recipients,
      subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<[^>]+>/g, ' '),
    };

    const info = await sendMailWithResilience(mailOptions, smtpConfig);

    return sendJson(res, 200, {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response,
    });
  } catch (error: any) {
    console.error('API /api/mail/send error:', error);
    return sendJson(res, 500, {
      success: false,
      error: error.message || 'Error al despachar el correo mediante SMTP.',
      code: error.code,
    });
  }
}

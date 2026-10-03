import { maskEmail, parseJsonBody, sendJson, handleCors, createSmtpTransporter } from '../_mailer.js';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Método no permitido. Use POST.' });
  }

  try {
    const body = await parseJsonBody(req);
    const { user, pass, host, port } = body;

    if (!user || typeof user !== 'string' || !user.includes('@')) {
      return sendJson(res, 400, { success: false, error: 'Dirección de correo inválida.' });
    }

    if (!pass || typeof pass !== 'string' || pass.trim().length < 8) {
      return sendJson(res, 400, {
        success: false,
        error: 'Contraseña de aplicación inválida (debe tener al menos 8 caracteres).',
      });
    }

    const cleanUser = user.trim().toLowerCase();
    const cleanPass = pass.trim().replace(/\s+/g, '');
    const cleanHost = (host || 'smtp.gmail.com').trim();
    const cleanPort = Number(port) || 465;

    // Verify credentials with timeout & multi-port resilience
    const primaryTransporter = createSmtpTransporter({
      user: cleanUser,
      pass: cleanPass,
      host: cleanHost,
      port: cleanPort,
    }, cleanPort, cleanPort === 465);

    let verified = false;
    let verifyError: any = null;

    if (primaryTransporter) {
      try {
        await primaryTransporter.verify();
        verified = true;
      } catch (err: any) {
        verifyError = err;
        console.warn(`Primary verify failed on port ${cleanPort}: ${err.message}. Trying alternate port...`);
      }
    }

    // Try alternate port if primary failed
    if (!verified) {
      const altPort = cleanPort === 465 ? 587 : 465;
      const altTransporter = createSmtpTransporter({
        user: cleanUser,
        pass: cleanPass,
        host: cleanHost,
        port: altPort,
      }, altPort, altPort === 465);

      if (altTransporter) {
        try {
          await altTransporter.verify();
          verified = true;
        } catch (altErr: any) {
          throw new Error(
            verifyError?.message || altErr?.message || 'No se pudo verificar la conexión SMTP con Gmail.'
          );
        }
      }
    }

    // Update process.env in memory for current container
    process.env.SMTP_HOST = cleanHost;
    process.env.SMTP_PORT = String(cleanPort);
    process.env.SMTP_SECURE = cleanPort === 465 ? 'true' : 'false';
    process.env.SMTP_USER = cleanUser;
    process.env.SMTP_PASS = cleanPass;
    process.env.SMTP_FROM = `Sistema SAP Crucianelli <${cleanUser}>`;

    return sendJson(res, 200, {
      success: true,
      message: `Servidor SMTP verificado exitosamente con la cuenta ${cleanUser}.`,
      senderEmail: cleanUser,
      maskedUser: maskEmail(cleanUser),
    });
  } catch (error: any) {
    console.error('API /api/mail/configure error:', error);
    return sendJson(res, 400, {
      success: false,
      error:
        error.message ||
        'No se pudo verificar la conexión SMTP con Gmail. Asegurate de que la contraseña de aplicación de 16 caracteres sea correcta y esté habilitada en Google.',
    });
  }
}

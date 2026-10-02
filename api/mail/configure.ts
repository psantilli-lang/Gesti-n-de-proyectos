import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { maskEmail, parseJsonBody, sendJson, handleCors } from '../_mailer.ts';

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
    const cleanPort = (port || '465').toString().trim();

    // Test credentials first before saving
    const testTransporter = nodemailer.createTransport({
      host: cleanHost,
      port: parseInt(cleanPort, 10),
      secure: cleanPort === '465',
      auth: {
        user: cleanUser,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    await testTransporter.verify();

    // Update current process environment
    process.env.SMTP_HOST = cleanHost;
    process.env.SMTP_PORT = cleanPort;
    process.env.SMTP_SECURE = cleanPort === '465' ? 'true' : 'false';
    process.env.SMTP_USER = cleanUser;
    process.env.SMTP_PASS = cleanPass;
    process.env.SMTP_FROM = `Sistema SAP Crucianelli <${cleanUser}>`;

    // Persist to .env safely if filesystem is writable (catch read-only FS on Vercel gracefully)
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      const updateEnvVar = (key: string, val: string) => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${val}`);
        } else {
          envContent += `\n${key}=${val}`;
        }
      };

      updateEnvVar('SMTP_HOST', cleanHost);
      updateEnvVar('SMTP_PORT', cleanPort);
      updateEnvVar('SMTP_SECURE', cleanPort === '465' ? 'true' : 'false');
      updateEnvVar('SMTP_USER', cleanUser);
      updateEnvVar('SMTP_PASS', cleanPass);
      updateEnvVar('SMTP_FROM', `"Sistema SAP Crucianelli <${cleanUser}>"`);

      fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
    } catch (fsErr) {
      console.warn('Filesystem is read-only (expected in Vercel serverless environment):', fsErr);
    }

    return sendJson(res, 200, {
      success: true,
      message: `Servidor SMTP configurado y verificado exitosamente con la cuenta ${cleanUser}.`,
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

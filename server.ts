import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Helper to mask email for security
function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 3 ? `${name.slice(0, 3)}***` : `${name}***`;
  return `${maskedName}@${domain}`;
}

// Helper to get or build Nodemailer transporter
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim().replace(/\s+/g, ''); // Remove spaces if copied with spaces

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false, // Prevents self-signed / enterprise proxy cert issues
    },
  });
}

// ================= API ROUTES =================

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Check SMTP configuration status (never leaks passwords)
app.get('/api/mail/status', (_req: Request, res: Response) => {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const from = process.env.SMTP_FROM || `Sistema SAP Crucianelli <${user || 'notificaciones@crucianelli.com'}>`;

  const isConfigured = Boolean(user && pass);

  res.json({
    configured: isConfigured,
    senderEmail: user || null,
    maskedUser: user ? maskEmail(user) : null,
    host,
    port,
    from,
  });
});

// Send email via central SMTP
app.post('/api/mail/send', async (req: Request, res: Response) => {
  try {
    const { to, subject, htmlBody, textBody, from } = req.body;

    if (!to || (!Array.isArray(to) && typeof to !== 'string')) {
      return res.status(400).json({ success: false, error: 'Destinatario "to" inválido o ausente.' });
    }

    if (!subject || !htmlBody) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios: "subject" o "htmlBody".' });
    }

    const transporter = getTransporter();
    if (!transporter) {
      return res.status(503).json({
        success: false,
        error:
          'Servidor SMTP central no configurado. Se deben definir SMTP_USER y SMTP_PASS en el entorno (.env).',
      });
    }

    const defaultFrom =
      process.env.SMTP_FROM ||
      `Sistema SAP Crucianelli <${process.env.SMTP_USER || 'notificaciones@crucianelli.com'}>`;

    const recipients = Array.isArray(to) ? to.join(', ') : to;

    const mailOptions = {
      from: from || defaultFrom,
      to: recipients,
      subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<[^>]+>/g, ' '),
    };

    const info = await transporter.sendMail(mailOptions);

    return res.json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      response: info.response,
    });
  } catch (error: any) {
    console.error('SMTP sendMail error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error al despachar el correo mediante SMTP.',
      code: error.code,
    });
  }
});

// Send test email
app.post('/api/mail/test', async (req: Request, res: Response) => {
  try {
    const { to } = req.body;
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return res.status(400).json({ success: false, error: 'Ingresá una dirección de correo válida para la prueba.' });
    }

    const transporter = getTransporter();
    if (!transporter) {
      return res.status(503).json({
        success: false,
        error: 'El servidor SMTP no está configurado todavía. Verificá las variables SMTP_USER y SMTP_PASS en .env.',
      });
    }

    // Verify SMTP connection handshake first
    await transporter.verify();

    const fromAddress =
      process.env.SMTP_FROM ||
      `Sistema SAP Crucianelli <${process.env.SMTP_USER || 'notificaciones@crucianelli.com'}>`;

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
              ¡Excelente! El servidor central de correos de la plataforma <strong>SAP Crucianelli</strong> está funcionando correctamente.
            </p>
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px 16px; margin-bottom:16px;">
              <p style="margin:0; font-size:13px; color:#166534;">
                <strong>Buzón Remitente Central:</strong> ${process.env.SMTP_USER}<br/>
                <strong>Servidor SMTP:</strong> ${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || '465'}<br/>
                <strong>Estado:</strong> Conectado y verificado.
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

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject: '✅ [Crucianelli SAP] Prueba de Servidor SMTP Central exitosa',
      html: testHtml,
    });

    return res.json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      message: `Correo de prueba enviado con éxito a ${to} desde el buzón central.`,
    });
  } catch (error: any) {
    console.error('SMTP test error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error al conectar con el servidor SMTP de Gmail.',
      code: error.code,
    });
  }
});

// Update SMTP credentials dynamically from PMO interface and persist to .env
app.post('/api/mail/configure', async (req: Request, res: Response) => {
  try {
    const { user, pass, host, port } = req.body;

    if (!user || typeof user !== 'string' || !user.includes('@')) {
      return res.status(400).json({ success: false, error: 'Dirección de correo inválida.' });
    }

    if (!pass || typeof pass !== 'string' || pass.trim().length < 8) {
      return res.status(400).json({ success: false, error: 'Contraseña de aplicación inválida (debe tener al menos 8 caracteres).' });
    }

    const cleanUser = user.trim().toLowerCase();
    const cleanPass = pass.trim().replace(/\s+/g, '');
    const cleanHost = (host || 'smtp.gmail.com').trim();
    const cleanPort = (port || '465').toString().trim();

    // Test credentials first before saving!
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

    // Persist to .env safely (so it survives restarts, but never touches GitHub due to .gitignore)
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

    return res.json({
      success: true,
      message: `Servidor SMTP configurado y verificado exitosamente con la cuenta ${cleanUser}.`,
      senderEmail: cleanUser,
      maskedUser: maskEmail(cleanUser),
    });
  } catch (error: any) {
    console.error('SMTP configuration verification error:', error);
    return res.status(400).json({
      success: false,
      error:
        error.message ||
        'No se pudo verificar la conexión SMTP con Gmail. Asegurate de que la contraseña de aplicación de 16 caracteres sea correcta y esté habilitada en Google.',
    });
  }
});

// ================= SERVER STARTUP & VITE INTEGRATION =================

async function startServer() {
  if (!isProd) {
    // In development mode, mount Vite middleware inside Express
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production mode, serve built client from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

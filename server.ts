import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { 
  sendMailWithResilience, 
  createSmtpTransporter, 
  resolveSmtpConfig, 
  maskEmail 
} from './api/_mailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enable CORS for all API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// ================= API ROUTES =================

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'node'
  });
});

// Check SMTP configuration status (never leaks passwords)
app.get('/api/mail/status', (_req: Request, res: Response) => {
  const config = resolveSmtpConfig();

  res.json({
    configured: config.isConfigured,
    senderEmail: config.user || null,
    maskedUser: config.user ? maskEmail(config.user) : null,
    host: config.host,
    port: config.port,
    from: config.from,
    source: config.source,
  });
});

// Send email via central SMTP
app.post('/api/mail/send', async (req: Request, res: Response) => {
  try {
    const { to, subject, htmlBody, textBody, from, smtpConfig } = req.body;

    if (!to || (!Array.isArray(to) && typeof to !== 'string')) {
      return res.status(400).json({ success: false, error: 'Destinatario "to" inválido o ausente.' });
    }

    if (!subject || !htmlBody) {
      return res.status(400).json({ success: false, error: 'Faltan campos obligatorios: "subject" o "htmlBody".' });
    }

    const config = resolveSmtpConfig(smtpConfig);
    if (!config.isConfigured || !config.user || !config.pass) {
      return res.status(503).json({
        success: false,
        error:
          'Servidor SMTP central no configurado. Se deben definir SMTP_USER y SMTP_PASS en Vercel o en el entorno (.env).',
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
    const { to, smtpConfig } = req.body;
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return res.status(400).json({ success: false, error: 'Ingresá una dirección de correo válida para la prueba.' });
    }

    const config = resolveSmtpConfig(smtpConfig);
    if (!config.isConfigured || !config.user || !config.pass) {
      return res.status(503).json({
        success: false,
        error: 'El servidor SMTP no está configurado todavía. Verificá las variables SMTP_USER y SMTP_PASS en Vercel o en .env.',
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
              ¡Excelente! El servidor central de correos de la plataforma <strong>SAP Crucianelli</strong> está funcionando correctamente.
            </p>
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px 16px; margin-bottom:16px;">
              <p style="margin:0; font-size:13px; color:#166534;">
                <strong>Buzón Remitente Central:</strong> ${config.user}<br/>
                <strong>Servidor SMTP:</strong> ${config.host}:${config.port}<br/>
                <strong>Origen de Credenciales:</strong> ${config.source === 'env' ? 'Variables de Entorno' : 'Servidor Central'}<br/>
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

    return res.json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      message: `Correo de prueba enviado con éxito a ${to} desde el buzón central (${config.user}).`,
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
    const testTransporter = createSmtpTransporter({
      host: cleanHost,
      port: parseInt(cleanPort, 10),
      secure: cleanPort === '465',
      user: cleanUser,
      pass: cleanPass,
    });

    if (!testTransporter) {
      return res.status(400).json({ success: false, error: 'No se pudo inicializar el transporte SMTP.' });
    }

    await testTransporter.verify();

    // Update current process environment
    process.env.SMTP_HOST = cleanHost;
    process.env.SMTP_PORT = cleanPort;
    process.env.SMTP_SECURE = cleanPort === '465' ? 'true' : 'false';
    process.env.SMTP_USER = cleanUser;
    process.env.SMTP_PASS = cleanPass;
    process.env.SMTP_FROM = `Sistema SAP Crucianelli <${cleanUser}>`;

    // Persist to .env safely if filesystem is writable
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

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;

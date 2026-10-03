import nodemailer, { type SendMailOptions, type SentMessageInfo } from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

export interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

// Fallback active corporate credentials for Crucianelli SAP
const DEFAULT_FALLBACK_USER = 'psantilli@crucianelli.com';
const DEFAULT_FALLBACK_PASS = 'seaqaertbterrdvz';
const DEFAULT_FALLBACK_HOST = 'smtp.gmail.com';
const DEFAULT_FALLBACK_PORT = 465;

export function resolveSmtpConfig(override?: SmtpConfig): {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  isConfigured: boolean;
  source: 'override' | 'env' | 'default';
} {
  // 1. Client override if provided
  if (override?.user && override?.pass) {
    const user = override.user.trim();
    const pass = override.pass.trim().replace(/\s+/g, '');
    const host = override.host?.trim() || process.env.SMTP_HOST || DEFAULT_FALLBACK_HOST;
    const port = Number(override.port) || Number(process.env.SMTP_PORT) || DEFAULT_FALLBACK_PORT;
    const secure = port === 465 || override.secure === true || process.env.SMTP_SECURE === 'true';
    const from = override.from || `Sistema SAP Crucianelli <${user}>`;
    return { host, port, secure, user, pass, from, isConfigured: true, source: 'override' };
  }

  // 2. Process Environment (Vercel Project Settings or local .env)
  const envUser = (process.env.SMTP_USER || '').trim();
  const envPass = (process.env.SMTP_PASS || '').trim().replace(/\s+/g, '');
  if (envUser && envPass) {
    const host = process.env.SMTP_HOST || DEFAULT_FALLBACK_HOST;
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const from = process.env.SMTP_FROM || `Sistema SAP Crucianelli <${envUser}>`;
    return { host, port, secure, user: envUser, pass: envPass, from, isConfigured: true, source: 'env' };
  }

  // 3. Known configured credentials fallback (ensures Vercel works immediately out of the box)
  if (DEFAULT_FALLBACK_USER && DEFAULT_FALLBACK_PASS) {
    return {
      host: DEFAULT_FALLBACK_HOST,
      port: DEFAULT_FALLBACK_PORT,
      secure: true,
      user: DEFAULT_FALLBACK_USER,
      pass: DEFAULT_FALLBACK_PASS,
      from: `Sistema SAP Crucianelli <${DEFAULT_FALLBACK_USER}>`,
      isConfigured: true,
      source: 'default',
    };
  }

  return {
    host: DEFAULT_FALLBACK_HOST,
    port: DEFAULT_FALLBACK_PORT,
    secure: true,
    user: '',
    pass: '',
    from: 'Sistema SAP Crucianelli <notificaciones@crucianelli.com>',
    isConfigured: false,
    source: 'default',
  };
}

export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 3 ? `${name.slice(0, 3)}***` : `${name}***`;
  return `${maskedName}@${domain}`;
}

export function createSmtpTransporter(overrideConfig?: SmtpConfig, customPort?: number, customSecure?: boolean) {
  const config = resolveSmtpConfig(overrideConfig);
  if (!config.isConfigured || !config.user || !config.pass) {
    return null;
  }

  const port = customPort !== undefined ? customPort : config.port;
  const secure = customSecure !== undefined ? customSecure : (port === 465);

  return nodemailer.createTransport({
    host: config.host,
    port,
    secure,
    requireTLS: !secure, // Enforce STARTTLS encryption when connecting via port 587
    auth: {
      user: config.user,
      pass: config.pass,
    },
    // Serverless-optimized timeouts to prevent hanging Vercel invocations
    connectionTimeout: 8000, // 8s timeout to establish TCP connection
    greetingTimeout: 8000,   // 8s timeout for SMTP greeting
    socketTimeout: 12000,    // 12s socket timeout
    tls: {
      rejectUnauthorized: false, // Prevents certificate mismatches in corporate / proxy environments
    },
  });
}

/**
 * Robust email dispatcher with automatic port fallback (465 SSL <-> 587 STARTTLS)
 * This solves Vercel / serverless IP network filtering issues with Gmail SMTP.
 */
export async function sendMailWithResilience(
  mailOptions: SendMailOptions,
  smtpConfig?: SmtpConfig
): Promise<SentMessageInfo> {
  const config = resolveSmtpConfig(smtpConfig);
  if (!config.isConfigured || !config.user || !config.pass) {
    throw new Error('Servidor SMTP central no configurado. Se deben definir credenciales activas.');
  }

  const primaryPort = config.port || 465;
  const primarySecure = primaryPort === 465;
  const fallbackPort = primaryPort === 465 ? 587 : 465;
  const fallbackSecure = fallbackPort === 465;

  let primaryError: any = null;

  // 1. Try Primary Port (with timeouts)
  try {
    const primaryTransporter = createSmtpTransporter(smtpConfig, primaryPort, primarySecure);
    if (!primaryTransporter) {
      throw new Error('No se pudo inicializar transporte SMTP primario.');
    }
    const info = await primaryTransporter.sendMail(mailOptions);
    return info;
  } catch (err: any) {
    primaryError = err;
    console.warn(`Primary SMTP transport (port ${primaryPort}) failed on Vercel: ${err.message}. Retrying on fallback port ${fallbackPort}...`);
  }

  // 2. Fallback Port (e.g. 587 STARTTLS if 465 failed, or vice versa)
  try {
    const fallbackTransporter = createSmtpTransporter(smtpConfig, fallbackPort, fallbackSecure);
    if (!fallbackTransporter) {
      throw primaryError;
    }
    const fallbackInfo = await fallbackTransporter.sendMail(mailOptions);
    console.info(`SMTP fallback transport (port ${fallbackPort}) succeeded.`);
    return fallbackInfo;
  } catch (fallbackErr: any) {
    console.error(`Fallback SMTP transport (port ${fallbackPort}) also failed:`, fallbackErr.message);
    const msg = `Fallo de envío SMTP (puerto ${primaryPort}: ${primaryError?.message || 'timeout'} | puerto ${fallbackPort}: ${fallbackErr.message})`;
    const combinedError = new Error(msg);
    (combinedError as any).code = fallbackErr.code || primaryError?.code;
    throw combinedError;
  }
}

export async function parseJsonBody(req: any): Promise<any> {
  // 1. If req.body is already a Buffer
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf-8'));
    } catch {
      return {};
    }
  }

  // 2. If req.body is already a parsed object
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  // 3. If req.body is a string
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  // 4. If stream has already ended or completed, do not hang
  if (req.readableEnded || req.complete) {
    return {};
  }

  // 5. Read stream with safety timeout (max 3 seconds so it never hangs serverless)
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve({}), 3000);

    req.on('data', (chunk: any) => {
      data += chunk;
    });
    req.on('end', () => {
      clearTimeout(timer);
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      clearTimeout(timer);
      resolve({});
    });
  });
}

export function sendJson(res: any, statusCode: number, data: any) {
  // Add CORS headers
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.end(JSON.stringify(data));
}

export function handleCors(req: any, res: any): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

import { resolveSmtpConfig, maskEmail, sendJson, handleCors } from '../_mailer.js';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  const config = resolveSmtpConfig();

  return sendJson(res, 200, {
    configured: config.isConfigured,
    senderEmail: config.user || null,
    maskedUser: config.user ? maskEmail(config.user) : null,
    host: config.host,
    port: config.port,
    from: config.from,
    source: config.source,
  });
}

import { sendJson, handleCors } from './_mailer.js';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  return sendJson(res, 200, {
    status: 'ok',
    service: 'SAP Crucianelli Mailer API',
    time: new Date().toISOString(),
    endpoints: [
      '/api/health',
      '/api/mail/status',
      '/api/mail/send',
      '/api/mail/test',
      '/api/mail/configure',
    ],
  });
}

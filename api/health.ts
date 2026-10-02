import { sendJson, handleCors } from './_mailer.ts';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  return sendJson(res, 200, {
    status: 'ok',
    time: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'node',
  });
}

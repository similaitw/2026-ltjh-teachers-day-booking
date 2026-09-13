import { createAdminCookie, verifyPassword } from '../lib/admin-auth.js';
import { json, readJson } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed' });
  const body = await readJson(req);
  if (!verifyPassword(String(body.password || ''))) {
    return json(res, 401, { ok: false, message: '管理密碼不正確' });
  }
  res.setHeader('Set-Cookie', createAdminCookie());
  return json(res, 200, { ok: true });
}

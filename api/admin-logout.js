import { clearAdminCookie } from '../lib/admin-auth.js';
import { json } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed' });
  res.setHeader('Set-Cookie', clearAdminCookie());
  return json(res, 200, { ok: true });
}

import { isAdmin } from '../lib/admin-auth.js';
import { ensureSchema, getSql, json } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method not allowed' });
  if (!isAdmin(req)) return json(res, 401, { ok: false, message: '請先登入管理端' });
  try {
    await ensureSchema();
    const eventId = String(req.query.eventId || 'ltjh-teachers-day-2026');
    const sql = getSql();
    const rows = await sql`
      SELECT id, name, email, slot, bring_cup AS "bringCup", created_at AS "createdAt"
      FROM bookings
      WHERE event_id = ${eventId} AND status = 'active'
      ORDER BY slot ASC, created_at ASC
    `;
    return json(res, 200, { ok: true, rows });
  } catch (error) {
    console.error(error);
    return json(res, 500, { ok: false, message: '總表載入失敗' });
  }
}

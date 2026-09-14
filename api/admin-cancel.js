import { isAdmin } from '../lib/admin-auth.js';
import { ensureSchema, getSql, withEventLock, json, readJson } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed' });
  if (!isAdmin(req)) return json(res, 401, { ok: false, message: '請先登入管理端' });
  try {
    const body = await readJson(req);
    const eventId = String(body.eventId || 'ltjh-teachers-day-2026');
    const bookingId = String(body.bookingId || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
      return json(res, 400, { ok: false, message: '預約資料不正確' });
    }
    await ensureSchema();
    const sql = getSql();
    const rows = await withEventLock(sql, eventId, sql`
      UPDATE bookings
      SET status = 'cancelled', cancelled_at = now(), updated_at = now()
      WHERE id = ${bookingId}::uuid AND event_id = ${eventId} AND status = 'active'
      RETURNING id
    `);
    if (!rows.length) return json(res, 404, { ok: false, message: '找不到這筆有效預約，可能已取消' });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(res, 500, { ok: false, message: '取消失敗，請稍後再試' });
  }
}

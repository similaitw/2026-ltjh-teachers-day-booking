import { ensureSchema, getSql, withEventLock, hashToken, json, readJson } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed' });
  try {
    await ensureSchema();
    const body = await readJson(req);
    const eventId = String(body.eventId || 'ltjh-teachers-day-2026');
    const manageToken = String(body.manageToken || '');
    if (!manageToken) return json(res, 400, { ok: false, message: '缺少預約管理資訊' });
    const tokenHash = hashToken(manageToken);

    const sql = getSql();
    const rows = await withEventLock(sql, eventId, sql`
      WITH event_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${eventId})) AS locked
      )
      UPDATE bookings b
      SET status = 'cancelled', cancelled_at = now(), updated_at = now()
      FROM event_lock
      WHERE b.event_id = ${eventId}
        AND b.manage_token_hash = ${tokenHash}
        AND b.status = 'active'
      RETURNING b.id
    `);
    if (!rows.length) return json(res, 404, { ok: false, message: '找不到有效預約' });
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error(error);
    return json(res, 500, { ok: false, message: '取消失敗，請稍後再試' });
  }
}

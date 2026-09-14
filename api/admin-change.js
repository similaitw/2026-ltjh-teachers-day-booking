import { isAdmin } from '../lib/admin-auth.js';
import { ensureSchema, getSql, withEventLock, json, readJson } from '../lib/db.js';

const VALID_SLOTS = new Set(Array.from({ length: 12 }, (_, i) => {
  const start = 13 * 60 + i * 15;
  const end = start + 15;
  const fmt = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  return `${fmt(start)}–${fmt(end)}`;
}));

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed' });
  if (!isAdmin(req)) return json(res, 401, { ok: false, message: '請先登入管理端' });

  try {
    await ensureSchema();
    const body = await readJson(req);
    const eventId = String(body.eventId || 'ltjh-teachers-day-2026');
    const bookingId = String(body.bookingId || '');
    const slot = String(body.slot || '');

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId) || !VALID_SLOTS.has(slot)) {
      return json(res, 400, { ok: false, message: '預約或時段資料不正確' });
    }

    const sql = getSql();
    const result = await withEventLock(sql, eventId, sql`
      WITH event_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${eventId})) AS locked
      ),
      current_booking AS (
        SELECT b.id
        FROM bookings b, event_lock
        WHERE b.id = ${bookingId}::uuid
          AND b.event_id = ${eventId}
          AND b.status = 'active'
        LIMIT 1
      ),
      slot_count AS (
        SELECT count(*)::int AS used
        FROM bookings b, event_lock
        WHERE b.event_id = ${eventId}
          AND b.slot = ${slot}
          AND b.status = 'active'
          AND b.id <> COALESCE((SELECT id FROM current_booking), '00000000-0000-0000-0000-000000000000'::uuid)
      ),
      updated AS (
        UPDATE bookings b
        SET slot = ${slot}, updated_at = now()
        FROM event_lock, slot_count
        WHERE b.id = (SELECT id FROM current_booking)
          AND slot_count.used < 8
        RETURNING b.id, b.name, b.email, b.slot, b.bring_cup AS "bringCup", b.created_at AS "createdAt"
      )
      SELECT
        CASE
          WHEN EXISTS (SELECT 1 FROM updated) THEN 'ok'
          WHEN NOT EXISTS (SELECT 1 FROM current_booking) THEN 'not_found'
          ELSE 'full'
        END AS result,
        (SELECT row_to_json(u) FROM updated u LIMIT 1) AS booking
      FROM event_lock
      LIMIT 1
    `);

    const row = result[0];
    if (row?.result === 'not_found') return json(res, 404, { ok: false, message: '找不到這筆有效預約' });
    if (row?.result === 'full') return json(res, 409, { ok: false, message: '新時段已額滿' });
    return json(res, 200, { ok: true, booking: row?.booking || null });
  } catch (error) {
    console.error(error);
    return json(res, 500, { ok: false, message: '時段更新失敗，請稍後再試' });
  }
}

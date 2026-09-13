import crypto from 'node:crypto';
import { ensureSchema, getSql, json, normalizeEmail, readJson } from '../lib/db.js';

const VALID_SLOTS = new Set(Array.from({ length: 12 }, (_, i) => {
  const start = 13 * 60 + i * 15;
  const end = start + 15;
  const fmt = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  return `${fmt(start)}–${fmt(end)}`;
}));

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Method not allowed' });
  try {
    await ensureSchema();
    const body = await readJson(req);
    const eventId = String(body.eventId || 'ltjh-teachers-day-2026');
    const capacity = 8;
    const name = String(body.name || '').trim().slice(0, 40);
    const email = normalizeEmail(body.email);
    const slot = String(body.slot || '');
    const bringCup = !!body.bringCup;

    if (!name) return json(res, 400, { ok: false, message: '請輸入姓名' });
    if (!email || !email.includes('@')) return json(res, 400, { ok: false, message: '請輸入有效 Email' });
    if (!VALID_SLOTS.has(slot)) return json(res, 400, { ok: false, message: '時段不正確' });

    const sql = getSql();
    const id = crypto.randomUUID();
    const result = await sql`
      WITH event_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${eventId})) AS locked
      ),
      existing AS (
        SELECT b.id
        FROM bookings b, event_lock
        WHERE b.event_id = ${eventId}
          AND lower(b.email) = ${email}
          AND b.status = 'active'
        LIMIT 1
      ),
      slot_count AS (
        SELECT count(*)::int AS used
        FROM bookings b, event_lock
        WHERE b.event_id = ${eventId}
          AND b.slot = ${slot}
          AND b.status = 'active'
      ),
      inserted AS (
        INSERT INTO bookings (id, event_id, name, email, slot, bring_cup, status)
        SELECT ${id}::uuid, ${eventId}, ${name}, ${email}, ${slot}, ${bringCup}, 'active'
        FROM event_lock, slot_count
        WHERE NOT EXISTS (SELECT 1 FROM existing)
          AND slot_count.used < ${capacity}
        RETURNING id, name, email, slot, bring_cup AS "bringCup", created_at AS "createdAt"
      )
      SELECT
        CASE
          WHEN EXISTS (SELECT 1 FROM inserted) THEN 'ok'
          WHEN EXISTS (SELECT 1 FROM existing) THEN 'duplicate'
          ELSE 'full'
        END AS result,
        (SELECT row_to_json(i) FROM inserted i LIMIT 1) AS booking
      FROM event_lock
      LIMIT 1
    `;

    const row = result[0];
    if (row?.result === 'duplicate') return json(res, 409, { ok: false, message: '這個 Email 已經有預約時段' });
    if (row?.result === 'full') return json(res, 409, { ok: false, message: '這個時段剛好額滿了，請選其他時段' });
    return json(res, 200, { ok: true, booking: row?.booking || null });
  } catch (error) {
    console.error(error);
    return json(res, 500, { ok: false, message: '預約失敗，請稍後再試' });
  }
}

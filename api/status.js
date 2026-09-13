import { ensureSchema, getSql, hashToken, json } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method not allowed' });
  try {
    await ensureSchema();
    const sql = getSql();
    const eventId = String(req.query.eventId || 'ltjh-teachers-day-2026');
    const manageToken = String(req.query.manageToken || '');

    const countsRows = await sql`
      SELECT slot, count(*)::int AS used
      FROM bookings
      WHERE event_id = ${eventId} AND status = 'active'
      GROUP BY slot
    `;

    let booking = null;
    if (manageToken) {
      const tokenHash = hashToken(manageToken);
      const rows = await sql`
        SELECT id, name, email, slot, bring_cup AS "bringCup", created_at AS "createdAt"
        FROM bookings
        WHERE event_id = ${eventId} AND manage_token_hash = ${tokenHash} AND status = 'active'
        LIMIT 1
      `;
      booking = rows[0] || null;
    }

    const counts = {};
    for (const row of countsRows) counts[row.slot] = Number(row.used || 0);
    return json(res, 200, { ok: true, counts, booking });
  } catch (error) {
    console.error(error);
    return json(res, 500, { ok: false, message: '資料庫暫時無法連線' });
  }
}

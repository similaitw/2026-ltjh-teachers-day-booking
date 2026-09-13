import { ensureSchema, getSql, json } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, message: 'Method not allowed' });
  try {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`SELECT now() AS now`;
    return json(res, 200, { ok: true, database: 'connected', now: rows[0]?.now || null });
  } catch (error) {
    console.error(error);
    return json(res, 500, { ok: false, database: 'disconnected', message: 'DATABASE_URL 尚未設定或資料庫無法連線' });
  }
}

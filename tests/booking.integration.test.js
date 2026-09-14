import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';

// Use a disposable PostgreSQL database, never the production DATABASE_URL.
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a disposable PostgreSQL database');
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
function sql(strings, ...values) {
  const text = strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, '');
  return { text, values, then(resolve, reject) { return pool.query(text, values).then(r => r.rows).then(resolve, reject); } };
}
sql.transaction = async (queries, options) => {
  assert.equal(options.isolationLevel, 'ReadCommitted');
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const results = [];
    for (const query of queries) results.push((await client.query(query.text, query.values)).rows);
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};
mock.module('@neondatabase/serverless', { namedExports: { neon: () => sql } });
process.env.DATABASE_URL = 'test-adapter';
process.env.ADMIN_SESSION_SECRET = 'integration-test-only';
const { ensureSchema } = await import('../lib/db.js');
const { createAdminCookie } = await import('../lib/admin-auth.js');
const book = (await import('../api/book.js')).default;
const change = (await import('../api/admin-change.js')).default;
const cancel = (await import('../api/admin-cancel.js')).default;
const selfChange = (await import('../api/change.js')).default;
const selfCancel = (await import('../api/cancel.js')).default;
await ensureSchema();
const eventId = `test-${crypto.randomUUID()}`;
after(async () => {
  try { await pool.query('DELETE FROM bookings WHERE event_id = $1', [eventId]); }
  finally { await pool.end(); }
});
const first = '13:00–13:15', second = '13:15–13:30';
async function call(handler, body, admin = true, method = 'POST') {
  const res = { code: 0, status(code) { this.code = code; return this; }, setHeader() {}, end(body) { this.body = JSON.parse(body); } };
  await handler({ method, headers: { cookie: admin ? createAdminCookie() : '' }, body: { eventId, ...body } }, res);
  return { status: res.code, ...res.body };
}
let sequence = 0;
const reserve = slot => call(book, { name: '測試', email: `test-${sequence++}@example.com`, slot });

test('admin cancellation, capacity checks and concurrent booking changes', async () => {
  assert.equal((await call(cancel, {}, false)).status, 401);
  assert.equal((await call(change, {}, false)).status, 401);
  assert.equal((await call(cancel, {}, true, 'GET')).status, 405);
  assert.equal((await call(cancel, { bookingId: 'invalid' })).status, 400);
  assert.equal((await call(change, { bookingId: 'invalid', slot: first })).status, 400);
  const occupants = [];
  for (let i = 0; i < 8; i++) {
    const row = await reserve(first);
    assert.equal(row.status, 200);
    occupants.push(row);
  }
  const moving = await reserve(second);
  assert.equal((await call(change, { bookingId: moving.booking.id, slot: first })).status, 409);
  assert.equal((await call(change, { bookingId: occupants[0].booking.id, slot: first })).status, 200);
  assert.equal((await call(cancel, { bookingId: occupants[0].booking.id, eventId: 'wrong-event' })).status, 404);
  assert.equal((await call(cancel, { bookingId: occupants[0].booking.id })).status, 200);
  assert.equal((await call(cancel, { bookingId: occupants[0].booking.id })).status, 404);
  assert.equal((await call(change, { bookingId: occupants[0].booking.id, slot: second })).status, 404);
  const cancelled = (await pool.query('SELECT status, cancelled_at FROM bookings WHERE id = $1', [occupants[0].booking.id])).rows[0];
  assert.equal(cancelled.status, 'cancelled');
  assert.ok(cancelled.cancelled_at);
  const rivals = await Promise.all(Array.from({ length: 4 }, () => reserve(second)));
  const results = await Promise.all([
    call(change, { bookingId: moving.booking.id, slot: first }),
    ...rivals.map(row => call(selfChange, { manageToken: row.manageToken, slot: first })),
    ...Array.from({ length: 8 }, () => reserve(first))
  ]);
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.equal(results.filter(result => result.status === 409).length, 12);
  const count = (await pool.query("SELECT count(*)::int AS used FROM bookings WHERE event_id = $1 AND slot = $2 AND status = 'active'", [eventId, first])).rows[0].used;
  assert.equal(count, 8);
  assert.equal((await call(selfCancel, { manageToken: occupants[1].manageToken })).status, 200);
  assert.equal((await reserve(first)).status, 200);
});

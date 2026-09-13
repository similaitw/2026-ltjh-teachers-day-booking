import { neon } from '@neondatabase/serverless';

let schemaReady = false;

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  return neon(process.env.DATABASE_URL);
}

export async function ensureSchema() {
  if (schemaReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id uuid PRIMARY KEY,
      event_id text NOT NULL,
      name text NOT NULL,
      email text NOT NULL,
      slot text NOT NULL,
      bring_cup boolean NOT NULL DEFAULT false,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      cancelled_at timestamptz
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_email_unique
    ON bookings (event_id, lower(email))
    WHERE status = 'active'
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS bookings_event_slot_status_idx
    ON bookings (event_id, slot, status)
  `;
  schemaReady = true;
}

export const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

export function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

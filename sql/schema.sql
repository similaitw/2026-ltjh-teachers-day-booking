CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY,
  event_id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  slot text NOT NULL,
  bring_cup boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  manage_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS manage_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_email_unique
  ON bookings (event_id, lower(email))
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS bookings_event_slot_status_idx
  ON bookings (event_id, slot, status);

CREATE INDEX IF NOT EXISTS bookings_manage_token_idx
  ON bookings (event_id, manage_token_hash)
  WHERE status = 'active';

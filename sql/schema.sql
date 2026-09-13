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
);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_email_unique
  ON bookings (event_id, lower(email))
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS bookings_event_slot_status_idx
  ON bookings (event_id, slot, status);

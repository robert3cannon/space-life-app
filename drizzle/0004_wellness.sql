CREATE TABLE water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ounces double precision NOT NULL CHECK (ounces > 0 AND ounces <= 200),
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX water_logs_logged_at_idx ON water_logs (logged_at);

CREATE TABLE sleep_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wake_date text NOT NULL UNIQUE CHECK (wake_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  bedtime timestamptz,
  wake_at timestamptz,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 960),
  quality integer CHECK (quality BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  days jsonb,
  auto text CHECK (auto IS NULL OR auto IN ('protein', 'water', 'workout')),
  remind boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE habit_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
  date text NOT NULL CHECK (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto', 'skip')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (habit_id, date)
);

CREATE INDEX habit_checks_habit_idx ON habit_checks (habit_id, date);

ALTER TABLE reminders DROP CONSTRAINT reminders_kind_check;

ALTER TABLE reminders ADD CONSTRAINT reminders_kind_check
  CHECK (kind IN ('event', 'meal', 'workout', 'custom', 'water', 'sleep', 'habit'));

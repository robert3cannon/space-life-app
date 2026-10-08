CREATE TABLE health_days (
  date text PRIMARY KEY CHECK (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  steps integer CHECK (steps IS NULL OR (steps >= 0 AND steps <= 200000)),
  active_kcal double precision CHECK (active_kcal IS NULL OR (active_kcal >= 0 AND active_kcal <= 20000)),
  resting_kcal double precision CHECK (resting_kcal IS NULL OR (resting_kcal >= 0 AND resting_kcal <= 20000)),
  exercise_minutes double precision CHECK (exercise_minutes IS NULL OR (exercise_minutes >= 0 AND exercise_minutes <= 1440)),
  resting_hr double precision CHECK (resting_hr IS NULL OR (resting_hr >= 20 AND resting_hr <= 250)),
  dietary_water_oz double precision CHECK (dietary_water_oz IS NULL OR (dietary_water_oz >= 0 AND dietary_water_oz <= 400)),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE health_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measured_at timestamptz NOT NULL UNIQUE,
  pounds double precision NOT NULL CHECK (pounds >= 40 AND pounds <= 800),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE health_sync (
  id text PRIMARY KEY,
  synced_at timestamptz NOT NULL,
  summary jsonb NOT NULL
);

CREATE TABLE health_tokens (
  id text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE health_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('food', 'water')),
  source_id uuid NOT NULL,
  exported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, source_id)
);

ALTER TABLE workouts ADD COLUMN health_key text UNIQUE;

ALTER TABLE sleep_logs ADD COLUMN source text NOT NULL DEFAULT 'manual';

ALTER TABLE sleep_logs ADD CONSTRAINT sleep_logs_source_check CHECK (source IN ('manual', 'health'));

ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_auto_check;

ALTER TABLE habits ADD CONSTRAINT habits_auto_check CHECK (auto IS NULL OR auto IN ('protein', 'water', 'workout', 'steps'));

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('class', 'work', 'study', 'workout', 'meal', 'other')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  location text,
  notes text,
  reminder_minutes_before integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX events_starts_at_idx ON events (starts_at);
CREATE INDEX events_range_idx ON events (starts_at, ends_at);

CREATE TABLE food_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  meal text NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  calories integer NOT NULL CHECK (calories >= 0),
  protein_g double precision NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  carbs_g double precision NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  fat_g double precision NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  logged_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX food_logs_logged_at_idx ON food_logs (logged_at);

CREATE TABLE workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  scheduled_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'skipped')),
  notes text,
  reminder_minutes_before integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workouts_scheduled_at_idx ON workouts (scheduled_at);

CREATE TABLE workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  notes text
);

CREATE INDEX workout_exercises_workout_idx ON workout_exercises (workout_id, position);

CREATE TABLE workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES workout_exercises (id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  reps integer,
  weight double precision,
  weight_unit text NOT NULL DEFAULT 'lb' CHECK (weight_unit IN ('lb', 'kg')),
  duration_seconds integer,
  completed boolean NOT NULL DEFAULT false,
  CHECK (reps IS NOT NULL OR duration_seconds IS NOT NULL)
);

CREATE INDEX workout_sets_exercise_idx ON workout_sets (exercise_id, position);

CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  fire_at timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('event', 'meal', 'workout', 'custom')),
  related_id uuid,
  dedupe_key text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reminders_due_idx ON reminders (status, fire_at);

CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('bot', 'user', 'system')),
  author text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_created_at_idx ON activity (created_at DESC);

CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

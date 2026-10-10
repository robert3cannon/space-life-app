ALTER TABLE workouts ADD COLUMN duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0);

CREATE TABLE saved_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  rest_seconds integer NOT NULL DEFAULT 60 CHECK (rest_seconds >= 0 AND rest_seconds <= 600),
  exercises jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

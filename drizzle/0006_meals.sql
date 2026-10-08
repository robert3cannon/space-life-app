CREATE TABLE meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place text,
  meal text NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  logged_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meals_logged_at_idx ON meals (logged_at);

CREATE TABLE meal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id uuid NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  calories integer NOT NULL CHECK (calories >= 0),
  protein_g double precision NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  carbs_g double precision NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  fat_g double precision NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  grams double precision CHECK (grams IS NULL OR grams >= 0),
  quantity double precision NOT NULL DEFAULT 1 CHECK (quantity > 0),
  serving_label text,
  source_id text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meal_items_meal_id_idx ON meal_items (meal_id);

INSERT INTO meals (id, place, meal, logged_at, notes, created_at)
SELECT id, 'Home', meal, logged_at, notes, created_at
FROM food_logs
ON CONFLICT (id) DO NOTHING;

INSERT INTO meal_items (id, meal_id, name, calories, protein_g, carbs_g, fat_g, quantity, position, created_at)
SELECT id, id, name, calories, protein_g, carbs_g, fat_g, 1, 0, created_at
FROM food_logs
ON CONFLICT (id) DO NOTHING;

CREATE TABLE closet_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slot text NOT NULL CHECK (slot IN ('top', 'bottom', 'layer', 'shoes', 'extra')),
  position integer NOT NULL DEFAULT 0
);

CREATE TABLE closet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid NOT NULL REFERENCES closet_categories(id),
  colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  warmth integer NOT NULL DEFAULT 3 CHECK (warmth BETWEEN 1 AND 5),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  in_laundry boolean NOT NULL DEFAULT false,
  image bytea,
  image_type text,
  blob_pathname text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wear_date text NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'rules' CHECK (source IN ('rules', 'bot')),
  worn_at timestamptz,
  weather jsonb,
  generation integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE outfit_slots (
  outfit_id uuid NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('top', 'bottom', 'layer', 'shoes')),
  item_id uuid NOT NULL REFERENCES closet_items(id) ON DELETE CASCADE,
  PRIMARY KEY (outfit_id, slot)
);

INSERT INTO closet_categories (name, slot, position) VALUES
  ('Shirts/T-shirts', 'top', 0),
  ('Long sleeves', 'top', 1),
  ('Pants', 'bottom', 2),
  ('Shorts', 'bottom', 3),
  ('Hoodies', 'layer', 4),
  ('Jackets', 'layer', 5),
  ('Shoes', 'shoes', 6),
  ('Accessories', 'extra', 7);

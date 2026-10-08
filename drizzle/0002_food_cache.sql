CREATE TABLE food_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX food_cache_expires_at_idx ON food_cache (expires_at);

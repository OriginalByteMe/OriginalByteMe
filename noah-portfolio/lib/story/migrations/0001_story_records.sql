CREATE TABLE IF NOT EXISTS story_records (
  public_id TEXT PRIMARY KEY NOT NULL,
  cache_identity TEXT NOT NULL UNIQUE,
  hmac_key_id TEXT NOT NULL,
  record_json TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS drops (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  max_downloads INTEGER NOT NULL,
  downloads INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  exhausted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_drops_created ON drops(created_at);

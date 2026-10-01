-- D1 schema for freeflare quotas (created by deploy.sh)
CREATE TABLE IF NOT EXISTS quota_daily (
  day TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, ip_hash)
);
CREATE TABLE IF NOT EXISTS quota_global (
  day TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

-- Anwenden mit:
--   wrangler d1 execute anime-kalender --file=./schema.sql            (lokal)
--   wrangler d1 execute anime-kalender --remote --file=./schema.sql   (live)

CREATE TABLE IF NOT EXISTS subscribers (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  frequency    TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly')),
  platforms    TEXT NOT NULL DEFAULT '',   -- kommagetrennt, leer = alle
  status       TEXT NOT NULL CHECK (status IN ('pending', 'active')) DEFAULT 'pending',
  confirm_token TEXT NOT NULL,
  unsub_token  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  created_ip   TEXT,
  confirmed_at TEXT,
  confirmed_ip TEXT,
  last_sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers (status, frequency);
CREATE INDEX IF NOT EXISTS idx_subscribers_confirm ON subscribers (confirm_token);
CREATE INDEX IF NOT EXISTS idx_subscribers_unsub ON subscribers (unsub_token);

-- Verhindert, dass ein Cron-Doppellauf zweimal dieselbe Mail schickt.
-- Dient gleichzeitig als Sperre für die Benachrichtigungen der Überwachung:
-- "alert:2026-08-08" bzw. "weekly:2026-W32".
CREATE TABLE IF NOT EXISTS send_log (
  run_key    TEXT PRIMARY KEY,   -- z. B. "daily:2026-08-07"
  sent_at    TEXT NOT NULL,
  recipients INTEGER NOT NULL
);

-- Ergebnis der letzten Erreichbarkeitsprüfung je Seite.
CREATE TABLE IF NOT EXISTS site_status (
  url          TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  ok           INTEGER NOT NULL,
  status       INTEGER NOT NULL,
  ms           INTEGER NOT NULL,
  reason       TEXT,
  checked_at   TEXT NOT NULL,
  -- Zeitpunkt der letzten erfolgreichen Prüfung: daraus ergibt sich, wie lange
  -- eine Seite schon weg ist.
  last_ok_at   TEXT,
  fail_streak  INTEGER NOT NULL DEFAULT 0
);

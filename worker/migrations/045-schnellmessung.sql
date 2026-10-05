-- Schnellmessung alle 5 Minuten (worker/src/schnellmessung.ts): Zeit bis zum ersten Byte und Gesamtzeit je Adresse, 14 Tage.
-- Anlass: Daniel erlebte am 05.10.2026 gegen 22:20 einen Lag von einigen Sekunden; der stündliche Wächter (site_history) konnte dazu nichts sagen.
-- 2 Adressen × 288 Messungen = 576 Zeilen/Tag.
CREATE TABLE IF NOT EXISTS site_probe (
  url        TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  ok         INTEGER NOT NULL,
  status     INTEGER NOT NULL,
  ttfb_ms    INTEGER NOT NULL,
  total_ms   INTEGER NOT NULL,
  grund      TEXT,
  PRIMARY KEY (url, checked_at)
);

-- Offene und geschlossene Alarme der Schnellmessung: drei schlechte Messungen in Folge öffnen, zwei gute schließen.
CREATE TABLE IF NOT EXISTS monitor_alarm (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  url           TEXT NOT NULL,
  seit          TEXT NOT NULL,
  grund         TEXT,
  geschlossen_am TEXT
);

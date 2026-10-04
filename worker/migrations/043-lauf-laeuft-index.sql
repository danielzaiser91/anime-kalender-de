-- Die Statusanzeige fragt alle paar Sekunden „was läuft gerade" (SQL_LAEUFE_LAUFEND: zustand = 'laeuft' AND gemeldet_am > jetzt - 3 Tage,
-- ORDER BY gemeldet_am DESC LIMIT 40). Über idx_lauf_status_gemeldet las jede Abfrage alle Zeilen der letzten drei Tage (~257), gemessen am
-- 04.10.2026 mit `wrangler d1 insights`: 442.797 Zeilen in 1.720 Aufrufen. Mit (zustand, gemeldet_am) liest sie nur die laufenden.
CREATE INDEX IF NOT EXISTS lauf_status_zustand ON lauf_status (zustand, gemeldet_am DESC);

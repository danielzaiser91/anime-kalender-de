-- Tageszähler für geschriebene D1-Zeilen der Meldungs-Route (11.10.2026).
--
-- Das Gratis-Kontingent (100.000 geschriebene Zeilen am Tag, je Konto, UTC-Tag) teilen sich
-- Newsletter-Worker und Ticket-Board. Am 11.10.2026 verbrauchte ein „alle durchgehen"-Lauf der
-- Erweiterung in 39 Minuten rund 150.000 Zeilen und sperrte alle Schreibpfade bis 02:00 MESZ.
-- Der Worker summiert `meta.rows_written` jeder Meldung hier und antwortet ab `DECKEL_ZEILEN`
-- (tagesdeckel.ts) mit 429. WITHOUT ROWID: eine Zeile je Aktualisierung, kein Zusatzindex.
CREATE TABLE IF NOT EXISTS schreib_tag (
  tag    TEXT PRIMARY KEY,
  zeilen INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;

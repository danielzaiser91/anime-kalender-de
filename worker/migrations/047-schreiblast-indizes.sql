-- Weniger Indexe = weniger geschriebene Zeilen (11.10.2026).
--
-- Jede Indexzeile zählt im kostenlosen D1-Plan als geschriebene Zeile (100.000 am Tag, je Konto).
-- Ein Durchgang über 172 Disney+-Titel (7.104 Folgen) schrieb am 11.10.2026 rund 150.000 Zeilen:
-- 6 je Meldung in `pruefung`, 8 je Rohfolge in `prime_folge`. Entfernt werden nur Indexe, die
-- keine Abfrage des Workers, der Pipeline oder der Werkzeuge braucht (EXPLAIN QUERY PLAN aller
-- Abfragen auf beide Tabellen, Vergleich vorher/nachher im PR).
--
-- prime_folge_url, idx_prime_folge_titel: kein Leser. prime_folge_plattform: nur die Diagnose
-- `?probe=` (ORDER BY id DESC LIMIT 5) — läuft ohne den Index rückwärts über den Primärschlüssel.
DROP INDEX IF EXISTS prime_folge_url;
DROP INDEX IF EXISTS idx_prime_folge_titel;
DROP INDEX IF EXISTS prime_folge_plattform;

-- pruefung_gemeldet_url (Migration 041) steckt als Präfix in pruefung_gemeldet (gemeldet_am,
-- plattform, url, staffel): dieselbe Zeitgrenze, `url` liegt mit im Index. Die Adressabfrage
-- erzwingt jetzt diesen.
DROP INDEX IF EXISTS pruefung_gemeldet_url;

-- pruefung_such_url (Migration 025) nur noch für Zeilen mit Suchadresse: Meldungen von Netflix und
-- Disney+ haben keine, und ein NULL-Eintrag im Index kostete trotzdem eine Zeile je Meldung.
DROP INDEX IF EXISTS pruefung_such_url;
CREATE INDEX IF NOT EXISTS pruefung_such_url ON pruefung (such_url) WHERE such_url IS NOT NULL;

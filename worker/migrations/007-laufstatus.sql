-- Laufende und beendete Cloud-Läufe, damit die Statusanzeige nicht die
-- GitHub-API abfragen muss: die erlaubt ohne Anmeldung nur 60 Abrufe je Stunde,
-- was für einen kurzen Takt nicht reicht.
--
-- Die Läufe melden sich selbst — beim Start und am Ende. Das ist genauer als
-- jede Abfrage von außen: Ein Lauf kennt seinen Auftrag, die GitHub-API sieht
-- nur „Claude — Auftrag abarbeiten".
CREATE TABLE IF NOT EXISTS lauf_status (
  -- Die Lauf-Nummer von GitHub. Ein zweiter Aufruf zum selben Lauf ersetzt den
  -- ersten, damit aus „läuft" ohne Umweg „fertig" wird.
  lauf_id     TEXT PRIMARY KEY,
  repo        TEXT NOT NULL,
  workflow    TEXT NOT NULL,
  -- Was der Lauf wirklich tut. Bei den Auftrags-Läufen der Zweigname, sonst leer.
  auftrag     TEXT,
  -- 'laeuft' | 'ok' | 'fehler' | 'abgebrochen'
  zustand     TEXT NOT NULL,
  begonnen_am TEXT NOT NULL,
  gemeldet_am TEXT NOT NULL,
  url         TEXT,
  -- Freitext für das Ergebnis: „769 Serien geprüft", „PR #7 geöffnet".
  notiz       TEXT
);

-- Die Anzeige sortiert nach Meldezeit; ohne Index wäre das bei wachsender
-- Tabelle ein Tabellendurchlauf je Abruf, und der Abruf kommt alle paar Sekunden.
CREATE INDEX IF NOT EXISTS idx_lauf_status_gemeldet ON lauf_status (gemeldet_am DESC);

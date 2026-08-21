-- Prüfergebnisse, die Daniel im Browser abschickt.
--
-- Der Weg: Er öffnet einen Titel beim Anbieter, eine Erweiterung blendet einen
-- Knopf ein, der Klick schickt, was auf der Seite steht. Kein Abruf durch uns —
-- die Seite hat er selbst geöffnet, und `robots.txt` richtet sich an
-- automatische Clients, nicht an Menschen (Daniel, 21.08.2026).
--
-- Von hier holt ein Pipeline-Skript die Einträge und schreibt sie nach
-- `data/dub-confirmed.yaml`. Die Datei bleibt die maßgebliche Fassung; diese
-- Tabelle ist nur der Briefkasten dazwischen.
CREATE TABLE IF NOT EXISTS pruefung (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Welcher Anbieter, welche Adresse — daraus findet die Pipeline den Eintrag.
  plattform   TEXT NOT NULL,
  url         TEXT NOT NULL,
  -- Was die Seite hergab: die rohen Sprachangaben, unverändert.
  sprachen    TEXT,
  -- 'dub' | 'kein_dub' | 'weg'  — die Auswertung, die die Erweiterung vorschlägt
  befund      TEXT NOT NULL,
  -- Titel und Folgenzahl, soweit ablesbar; hilft beim Zuordnen.
  titel       TEXT,
  folgen      INTEGER,
  -- Freitext für alles, was sonst auffiel.
  notiz       TEXT,
  gemeldet_am TEXT NOT NULL,
  -- Ist der Eintrag schon in die YAML übernommen?
  uebernommen INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pruefung_offen ON pruefung (uebernommen, gemeldet_am);

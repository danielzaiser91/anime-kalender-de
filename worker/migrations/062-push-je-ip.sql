-- Härtung von /push/abo (24.10.2026, B4 im Skalierungsplan).
--
-- `erneuert`: letzter Besuch eines Browsers mit eingeschaltetem Push (die Seite meldet sich bei jedem Start); der Löschlauf
-- entfernt Abos, die 90 Tage nicht erneuert wurden (Spalte leer = `erstellt`). `push_zaehler`: Zeilenzahl von `push_abo`,
-- von Auslösern gepflegt, damit die Obergrenze (350) ohne Durchlauf je Anfrage gilt.
-- **Die Migration muss vor dem Worker laufen:** ohne sie scheitern /push/abo und das Löschen toter Abos.
ALTER TABLE push_abo ADD COLUMN erneuert TEXT;
CREATE TABLE IF NOT EXISTS push_zaehler (id INTEGER PRIMARY KEY CHECK (id = 1), anzahl INTEGER NOT NULL);
INSERT OR REPLACE INTO push_zaehler (id, anzahl) SELECT 1, COUNT(*) FROM push_abo;
CREATE TRIGGER IF NOT EXISTS push_abo_neu AFTER INSERT ON push_abo BEGIN UPDATE push_zaehler SET anzahl = anzahl + 1 WHERE id = 1; END;
CREATE TRIGGER IF NOT EXISTS push_abo_weg AFTER DELETE ON push_abo BEGIN UPDATE push_zaehler SET anzahl = MAX(anzahl - 1, 0) WHERE id = 1; END;
-- Bestehende Abos beginnen mit dem Einspielzeitpunkt (90 Tage Schonfrist), sonst würde der erste Löschlauf Altzeilen ohne `erneuert` nach `erstellt` löschen.
UPDATE push_abo SET erneuert = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE erneuert IS NULL;

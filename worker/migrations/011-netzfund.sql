-- Was Netflix im Hintergrund lädt, während Daniel eine Seite ansieht.
--
-- Der Zweck ist eine einzige Frage (Daniel, 22.08.2026): „vielleicht existieren
-- ja dort bereits alle infos, und ich muss noch weniger machen." Steht in den
-- Antworten, die die Seite ohnehin holt, schon, welche Sprachen eine Reihe hat,
-- dann erübrigt sich die Handarbeit — dann liest die Erweiterung beim Öffnen
-- mit, statt dass jemand jede Folge startet.
--
-- Gespeichert werden **Feldnamen und kurze Fundstellen**, nicht die Antworten
-- selbst: Es geht um „steht es da überhaupt", nicht um eine zweite Kopie von
-- Netflix.
CREATE TABLE IF NOT EXISTS netzfund (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  url         TEXT NOT NULL,
  reihe       TEXT,
  laenge      INTEGER,
  -- JSON-Liste der gefundenen Feldnamen.
  felder      TEXT,
  -- JSON-Liste kurzer Fundstellen mit „de" oder „Deutsch".
  proben      TEXT,
  gemeldet_am TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_netzfund_zeit ON netzfund (gemeldet_am DESC);

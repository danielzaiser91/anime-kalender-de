-- Globale Marke des stündlichen Push-Versands (24.10.2026, B3 im Skalierungsplan).
--
-- Eine Zeile (id = 1): `zuletzt` = bis wann alle Push-Abos bedient sind, `gemeldet` = die „Jetzt auch bei X“-Meldungen
-- (`<id>:<anbieter>`, eine je Zeile, die letzten 200), die schon durch sind. Ohne neues Ereignis seit `zuletzt` liest und
-- schreibt der Lauf nichts aus `push_abo`. Vorher trug jedes Abo seinen eigenen Zeitpunkt, jeder Lauf schrieb jede Zeile.
-- **Die Migration muss vor dem Worker laufen:** ohne die Tabelle bricht der Push-Versand mit einem Fehler ab (Fehlerprotokoll).
CREATE TABLE IF NOT EXISTS push_marke (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  zuletzt TEXT NOT NULL,
  gemeldet TEXT NOT NULL DEFAULT '',
  -- Beginn einer Serie gescheiterter Push-Abrufe; die Marke wartet darauf höchstens 24 Stunden.
  fehler_seit TEXT
);

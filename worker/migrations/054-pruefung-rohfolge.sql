-- Die Rohfolge einer Netflix-/Disney+-Meldung steht in der Zeile der Meldung (13.10.2026).
--
-- Bisher schrieb jede Folge dieser Anbieter zwei Zeilen: `pruefung` (6 Tabellen-/Indexzeilen) und
-- `prime_folge` (5), mit denselben Angaben (Folge, Staffel, Sprachen, Befund). Jetzt trägt `pruefung`
-- die Rohfolge als JSON mit (`rohfolge`, Felder wie die Spalten von `prime_folge`); `prime_folge` bekommt
-- für diese Anbieter nichts mehr. Die Rohfolgen-Route liefert beide Quellen (Ids ab 1.000.000.000 gehören
-- `pruefung`). `roh_uebernommen`: 0 = offen für den Zuordner, 1 = abgehakt (`rohfolgenUebernommen`), NULL = keine
-- Rohfolge in der Zeile. Das ist ein eigenes Flag, weil `uebernommen` das Abhaken der Meldung durch
-- `fetch-pruefungen.ts` meint — ein anderer Lauf mit anderer Bedingung.
--
-- Keine Indexzeile und kein Umschreiben vorhandener Zeilen: `ADD COLUMN` ohne Vorgabe ändert nur das Schema.
-- Altzeilen in `prime_folge` bleiben, wie sie sind; sie laufen ab, wenn der Bau sie abgehakt hat.
ALTER TABLE pruefung ADD COLUMN rohfolge TEXT;
ALTER TABLE pruefung ADD COLUMN roh_uebernommen INTEGER;

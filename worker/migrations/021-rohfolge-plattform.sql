-- Rohfolgen bekommen eine Plattform — sammeln und zuordnen werden getrennt.
--
-- Daniel am 01.09.2026: „wenn disney+ sich entscheidet staffeln und episoden
-- wild zu gruppieren, muss das dem sammeln egal sein, einfach alles melden was
-- da ist … zuordnung muss es ebenfalls egal sein, anbieter zuordnung nicht
-- vertrauen, sondern einzeln episoden korrekt aus gesammeltem zustand rauspicken
-- und korrekt zuordnen, auch wenn anbieter zB folge 13 als staffel 2000
-- bezeichnet."
--
-- Der Weg existiert seit dem 28.08.2026 für Prime (`fetch-rohfolgen.ts` legt die
-- gemeldeten Folgen über TMDBs Folgentitel und Erstausstrahlungsdaten). Netflix
-- und Disney+ gehen ihn nicht — dort entscheidet weiter die Staffelangabe des
-- Anbieters, und genau daran hingen am 01.09.2026 drei Fälle an einem Tag:
--
--   Kakegurui      zwei Staffeln zaehlen beide 1-12, zwoelf Meldungen wurden zu
--                  vierundzwanzig Haekchen
--   Dorohedoro     der Player nannte die Staffeln in der Reihenfolge des
--                  Eintreffens, 1/12/13 landeten in Staffel 1
--   Loser Ranger   Disney+ fuehrt 24 Folgen als eine Staffel, unser Bestand
--                  zwei zu je zwoelf — alle 24 landeten auf dem ersten Titel
--
-- Die Tabelle heisst weiter `prime_folge`: Ein Umbenennen kostet eine Migration
-- mit Datenumzug und bringt nichts, was ein Kommentar nicht auch sagt. Die
-- Felder waren von Anfang an anbieterneutral — nur `asin` und `gti` sind
-- Prime-Begriffe und bleiben dort leer, wo es sie nicht gibt.

-- Der Vorgabewert deckt den Bestand: Alles, was vor dieser Migration entstanden
-- ist, kam von Prime.
ALTER TABLE prime_folge ADD COLUMN plattform TEXT NOT NULL DEFAULT 'primevideo';

-- Der Bau holt je Adresse; die Plattform kommt als Filter dazu, sobald mehrere
-- Anbieter dieselbe Adresse fuehren koennten.
CREATE INDEX IF NOT EXISTS prime_folge_plattform ON prime_folge (plattform, uebernommen);

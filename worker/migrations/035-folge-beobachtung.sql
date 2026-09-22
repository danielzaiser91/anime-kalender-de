-- Stufe 1 des Meldemodells auch je Folge (docs/konzept-meldungen-architektur.md, 22.09.2026).
--
-- Prime schickte gesperrte Folgen („In deiner Region nicht mehr verfügbar") gar
-- nicht mit — die Beobachtung „diese Folge gibt es hier nicht" ging verloren.
-- Jetzt kommen sie mit `vorhanden = 'nein'`. Die Abfrage `?rohfolgen=1` lässt
-- sie aus, bis Stufe 2 den heutigen Zuordner ersetzt; der würde ihre leeren
-- Tonspuren sonst als „kein Deutsch" lesen.
ALTER TABLE prime_folge ADD COLUMN vorhanden TEXT;   -- 'ja' | 'nein'
ALTER TABLE prime_folge ADD COLUMN ton_de TEXT;      -- 'ja' | 'nein' | 'unbekannt'

-- Die offenen Rohfolgen kommen in Kennungs-Reihenfolge aus dem Index (12.10.2026).
--
-- `?rohfolgen=1` liest `WHERE uebernommen = 0 AND id > ? ORDER BY id LIMIT 5000`. Mit
-- `prime_folge_offen (uebernommen, gemeldet_am)` sortierte SQLite bei jeder Seite alle offenen Zeilen
-- neu (USE TEMP B-TREE FOR ORDER BY): rund 18.200 Indexzeilen und die Tabellenzeilen aller Treffer je
-- Seite, 56 Seitenabrufe = 1,46 Mio. gelesene Zeilen am Tag. Der Teilindex auf `id` enthält nur offene
-- Zeilen und liefert sie schon geordnet; die Seite liest nur ihre eigenen 5.000.
--
-- Ersetzt den alten Index (kein anderer Leser: `COUNT(*)` ist entfallen, alle übrigen Abfragen laufen
-- über Primärschlüssel, `prime_folge_seite` oder `prime_folge_gti`). Schreiblast: ein Eintrag nur für
-- offene Zeilen, beim Abhaken entfällt er statt wie bisher neu geschrieben zu werden (weniger Zeilen
-- als vorher). Einmalig kostet das Ersetzen rund 18.200 geschriebene und 61.500 gelesene Zeilen (13.10.2026 gemessen: 18.194/61.501).
DROP INDEX IF EXISTS prime_folge_offen;
CREATE INDEX IF NOT EXISTS prime_folge_offen ON prime_folge (id) WHERE uebernommen = 0;

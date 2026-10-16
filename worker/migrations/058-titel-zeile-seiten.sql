-- Die Sicht `pruefung_titel` zeigt die Titelnummer `nr` als `titel_nr` (16.10.2026).
--
-- Die seitenweisen Leser (offene und alle Rohfolgen, `?alle=1`) sortierten nach `id`, einem Ausdruck über
-- `json_each`: Jede Seite packte alle Folgen aller passenden Titel aus und sortierte alle Zeilen über der Marke,
-- auch wenn sie nur 5.000 brauchte (lokal gemessen: 26.828 gelesene Zeilen je Seite bei 12.765 offenen
-- Rohfolgen; Insights am 16.10.: `offenAusTitel` 26-mal Ø 26.568). Die Id beginnt mit `nr` (2·10^9 + nr·10^10
-- + Rest unter 10^10, `titelzeile-format.ts`), also ordnet `ORDER BY titel_nr, id` genau wie `ORDER BY id`.
-- Damit läuft SQLite die Titel über den Index `titel_zeile_nr` ab der Titelnummer der Marke, sortiert nur
-- innerhalb eines Titels und hört nach `LIMIT` auf (in workerd gemessen; node:sqlite 3.50 sortiert alle Titel ab der Marke).
--
-- Nur die Sicht ändert sich, keine Zeile wird gelesen oder geschrieben. **Vor dem Worker einspielen:** Ohne die
-- Spalte scheitern die Leser mit „no such column: titel_nr“.
DROP VIEW IF EXISTS pruefung_titel;
CREATE VIEW pruefung_titel AS
SELECT
  2000000000 + t.nr * 10000000000 + IFNULL(json_extract(f.value, '$[13]'), 0) * 100000000
    + IFNULL(json_extract(f.value, '$[0]'), 0) * 100000 + IFNULL(json_extract(f.value, '$[1]'), 0) AS id,
  t.plattform AS plattform,
  t.url AS url,
  json_extract(f.value, '$[4]') AS sprachen,
  CASE
    WHEN json_extract(f.value, '$[5]') = 'nein' THEN 'weg'
    WHEN json_extract(f.value, '$[6]') = 'ja' THEN 'dub'
    ELSE 'kein_dub'
  END AS befund,
  json_extract(t.daten, '$.t') AS titel,
  json_extract(f.value, '$[14]') AS folgen,
  json_extract(f.value, '$[1]') AS folge_nr,
  json_extract(f.value, '$[0]') AS staffel,
  json_extract(t.daten, '$.s') AS staffeln,
  json_extract(t.daten, '$.st') AS serientitel,
  json_extract(f.value, '$[12]') AS notiz,
  json_extract(f.value, '$[9]') AS gemeldet_am,
  json_extract(f.value, '$[10]') AS uebernommen,
  json_extract(f.value, '$[8]') AS titel_id,
  json_extract(f.value, '$[2]') AS folge,
  json_extract(f.value, '$[5]') AS vorhanden,
  json_extract(f.value, '$[6]') AS ton_de,
  json_extract(f.value, '$[7]') AS art,
  json_extract(f.value, '$[3]') AS gti,
  json_extract(f.value, '$[11]') AS roh_uebernommen,
  t.gemeldet_am AS titel_am,
  t.offen_meldung AS offen_meldung,
  t.offen_rohfolge AS offen_rohfolge,
  json_extract(f.value, '$[15]') AS roh_titel,
  t.nr AS titel_nr
FROM titel_zeile t, json_each(t.daten, '$.f') f;

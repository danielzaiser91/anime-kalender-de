-- Die Sicht `pruefung_titel` für Netflix (14.10.2026): zwei Felder, die nur Netflix-Meldungen tragen.
--
-- Eine Folge der Titelzeile hat seither bis zu 16 Stellen (`worker/src/titelzeile-format.ts`):
-- … notiz, fassung, folgen?, roh_titel?. `folgen` ist die Folgenzahl der Seite aus der Hand-Meldung (der Bau
-- unterscheidet damit „noch nicht geprüft“ von „führt der Anbieter nicht“); `roh_titel` ist der Titel der
-- Rohfolge, wo er von `folge` abweicht — Netflix meldet als `folge` die Kennung, der Zuordner braucht den
-- Folgentitel. Disney+-Folgen haben beide nicht, die Sicht zeigt dort NULL wie bisher.
--
-- Nur die Sicht ändert sich, keine Zeile wird gelesen oder geschrieben.
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
  json_extract(f.value, '$[15]') AS roh_titel
FROM titel_zeile t, json_each(t.daten, '$.f') f;

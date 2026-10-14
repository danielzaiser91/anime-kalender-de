-- Nach dem Einspielen je Anbieter: Folgen aus `pruefung`/`prime_folge`, die in keiner Titelzeile stehen (14.10.2026).
-- Erwartet: keine Zeile. Eine Zeile heißt: diese Folgen fehlen in `pruefung_titel` — Einspielen nicht fertig (noch
-- Nachzügler offen) oder verloren; dann nicht weiter ausrollen. Aufruf aus `worker/`:
--
--   sed -e 's/__PLATTFORM__/netflix/' einmalig/titel-zeile-verlust.sql > verlust-netflix.sql
--   npx wrangler d1 execute anime-kalender --remote --config wrangler.toml --file=verlust-netflix.sql
--
-- Ohne korrelierte Unterabfrage: liest `pruefung` und `prime_folge` je einmal ganz und jede Folge der Titelzeilen des
-- Anbieters einmal (`json_each` zählt jede Folge als gelesene Zeile); gemessene Zahlen in docs/wissen/betrieb.md.
WITH
  alt AS (
    SELECT url, IFNULL(staffel, -1) AS ks, IFNULL(folge_nr, -1) AS kn, 'pruefung' AS herkunft
      FROM pruefung WHERE plattform = '__PLATTFORM__'
    UNION
    SELECT url, IFNULL(staffel_nr, -1), IFNULL(nummer, -1), 'prime_folge'
      FROM prime_folge WHERE plattform = '__PLATTFORM__' AND gti IS NOT NULL
  ),
  neu AS (
    SELECT t.url, IFNULL(json_extract(f.value, '$[0]'), -1) AS ks, IFNULL(json_extract(f.value, '$[1]'), -1) AS kn
      FROM titel_zeile t, json_each(t.daten, '$.f') f
     WHERE t.plattform = '__PLATTFORM__'
  )
SELECT herkunft, COUNT(*) AS folgen, COUNT(DISTINCT url) AS adressen
  FROM alt
 WHERE (url, ks, kn) NOT IN (SELECT url, ks, kn FROM neu)
 GROUP BY herkunft;

-- Einmalig: die Disney+-Altzeilen in Titelzeilen umziehen (13.10.2026, gehört zu Migration 055).
--
-- Aufruf (aus `worker/`, nach Migration 055 und nachdem der Worker mit TITELZEILE_PLATTFORMEN = "disneyplus" läuft;
-- den Disney+-Durchgang der Erweiterung währenddessen anhalten, sonst kann eine Meldung zwischen Lesen und Schreiben
-- in `pruefung` landen, die dann verdrängt wird):
--
--   npx wrangler d1 execute anime-kalender --remote --config wrangler.toml --file=einmalig/titel-zeile-einspielen.sql
--
-- Je Adresse ohne Titelzeile wird die jüngste Meldung je Folge (Staffel, Nummer) aus `pruefung` genommen, die
-- Rohfolge (gti und Abhak-Marke) aus `pruefung.rohfolge` derselben Zeile (seit Migration 054), sonst aus der
-- jüngsten Zeile derselben Folge in `prime_folge`. Fehlen `vorhanden`, `ton_de`, `art` (Meldungen vor Stufe 1,
-- 22.09.2026), werden sie aus `befund` abgeleitet wie im Worker. Die Kopfdaten (Staffelstruktur, Titel,
-- Serientitel) sind jeweils der jüngste Wert, der nicht leer ist. `offen_meldung`/`offen_rohfolge` zählen die Folgen,
-- die Bau und Zuordner noch holen (wie `zaehleOffene` in `worker/src/titelzeile-format.ts`).
-- Der Aufruf liest `prime_folge` einmal ganz (kein Index auf `plattform`: rund 50.000 gelesene Zeilen) und
-- `pruefung` zu Disney+ (rund 7.000), schreibt eine Zeile je Adresse plus Indexzeile (rund 350). Wiederholbar: Adressen mit
-- Titelzeile werden übersprungen. Die Altzeilen bleiben stehen und werden nicht mehr gelesen
-- (Befristung: Kopf von Migration 055).
WITH
  jung AS (
    SELECT p.*,
           ROW_NUMBER() OVER (PARTITION BY p.url, IFNULL(p.staffel, -1), IFNULL(p.folge_nr, -1)
                              ORDER BY p.gemeldet_am DESC, p.id DESC) AS rn_folge,
           ROW_NUMBER() OVER (PARTITION BY p.url ORDER BY p.gemeldet_am DESC, p.id DESC) AS rn_titel,
           FIRST_VALUE(p.staffeln) OVER (PARTITION BY p.url ORDER BY (p.staffeln IS NULL), p.gemeldet_am DESC, p.id DESC) AS kopf_s,
           FIRST_VALUE(p.titel) OVER (PARTITION BY p.url ORDER BY (p.titel IS NULL), p.gemeldet_am DESC, p.id DESC) AS kopf_t,
           FIRST_VALUE(p.serientitel) OVER (PARTITION BY p.url ORDER BY (p.serientitel IS NULL), p.gemeldet_am DESC, p.id DESC) AS kopf_st
      FROM pruefung p
     WHERE p.plattform = 'disneyplus' AND p.url NOT IN (SELECT url FROM titel_zeile)
  ),
  roh AS (
    SELECT url, nummer, staffel_nr, gti, uebernommen,
           ROW_NUMBER() OVER (PARTITION BY url, IFNULL(staffel_nr, -1), IFNULL(nummer, -1)
                              ORDER BY gemeldet_am DESC, id DESC) AS rn
      FROM prime_folge
     WHERE plattform = 'disneyplus' AND gti IS NOT NULL
  ),
  f0 AS (
    SELECT j.url AS url,
           j.gemeldet_am AS am,
           j.staffel AS staffel,
           j.folge_nr AS nummer,
           j.folge AS folge,
           COALESCE(json_extract(j.rohfolge, '$.gti'), r.gti) AS gti,
           j.sprachen AS sprachen,
           COALESCE(j.vorhanden, CASE j.befund WHEN 'weg' THEN 'nein' ELSE 'ja' END) AS vorhanden,
           COALESCE(j.ton_de, CASE j.befund WHEN 'dub' THEN 'ja' WHEN 'kein_dub' THEN 'nein' ELSE 'unbekannt' END) AS ton_de,
           COALESCE(j.art, 'gemessen') AS art,
           j.titel_id AS titel_id,
           j.uebernommen AS um,
           COALESCE(j.roh_uebernommen, r.uebernommen, 1) AS ur,
           j.notiz AS notiz
      FROM jung j
      LEFT JOIN roh r
        ON r.rn = 1 AND r.url = j.url
       AND IFNULL(r.staffel_nr, -1) = IFNULL(j.staffel, -1) AND IFNULL(r.nummer, -1) = IFNULL(j.folge_nr, -1)
     WHERE j.rn_folge = 1
  ),
  folgen AS (
    SELECT url, am, um, ur, gti, vorhanden,
           json_array(staffel, nummer, folge, gti, json(CASE WHEN json_valid(sprachen) THEN sprachen END),
                      vorhanden, ton_de, art, titel_id, am, um, ur, notiz, 0) AS eintrag
      FROM f0
  ),
  je_titel AS (
    SELECT j.url AS url,
           json_object(
             's', json(CASE WHEN json_valid(j.kopf_s) THEN j.kopf_s END),
             't', j.kopf_t,
             'st', j.kopf_st,
             'f', json((SELECT json_group_array(json(f.eintrag)) FROM folgen f WHERE f.url = j.url))
           ) AS daten,
           (SELECT MAX(f.am) FROM folgen f WHERE f.url = j.url) AS am,
           (SELECT COUNT(*) FROM folgen f WHERE f.url = j.url AND f.um = 0) AS offen_meldung,
           (SELECT COUNT(*) FROM folgen f WHERE f.url = j.url AND f.ur = 0 AND f.gti IS NOT NULL AND f.vorhanden <> 'nein') AS offen_rohfolge
      FROM jung j
     WHERE j.rn_titel = 1
  )
INSERT OR IGNORE INTO titel_zeile (url, plattform, nr, version, daten, gemeldet_am, offen_meldung, offen_rohfolge)
SELECT url, 'disneyplus', (SELECT IFNULL(MAX(nr), 0) FROM titel_zeile) + ROW_NUMBER() OVER (ORDER BY url), 1, daten, am, offen_meldung, offen_rohfolge
  FROM je_titel;

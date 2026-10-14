-- Einmalig je Anbieter: Altzeilen aus `pruefung`/`prime_folge` in Titelzeilen umziehen (Migration 055/056).
-- Neu geschrieben am 14.10.2026: Die erste Fassung (nur Disney+) las an der echten D1 9.132.488 Zeilen (14.10.2026
-- 11:30, 215 Adressen; korrelierte Unterabfragen auf eine CTE rechnen die CTE je Adresse neu); diese gruppiert je
-- Adresse genau einmal und arbeitet in Blöcken.
--
-- Platzhalter: __PLATTFORM__ (disneyplus | netflix; nur Anbieter aus TITELZEILE_TAUGLICH in titelzeile-speichern.ts)
-- und __ADRESSEN__ (Adressen je Block). Aufruf aus `worker/`, nachdem Migration 056 eingespielt ist und der Worker
-- mit dem Anbieter in TITELZEILE_PLATTFORMEN läuft (Ablauf: docs/wissen/betrieb.md, Abschnitt „Titelzeile“):
--
--   sed -e 's/__PLATTFORM__/netflix/' -e 's/__ADRESSEN__/150/' einmalig/titel-zeile-einspielen.sql > einspielen-netflix.sql
--   npx wrangler d1 execute anime-kalender --remote --config wrangler.toml --file=einspielen-netflix.sql
--
-- Ein Block nimmt die ersten __ADRESSEN__ Adressen des Anbieters ohne Titelzeile (nach url); den Aufruf wiederholen, bis
-- er 0 Zeilen schreibt. Wiederholbar, auch nach einem Abbruch: Adressen mit Titelzeile werden übersprungen.
--
-- Je Adresse wird die jüngste Meldung je Folge (Staffel, Nummer) aus `pruefung` genommen, die Rohfolge (gti, Titel,
-- Abhak-Marke) aus `pruefung.rohfolge` derselben Zeile (seit Migration 054), sonst aus der jüngsten Zeile derselben Folge
-- in `prime_folge`. Folgen nur in `prime_folge` kommen als Folge ohne offene Meldung hinein (`vorhanden`/`ton_de` aus
-- `prime_folge`, sonst ja/unbekannt; `angenommen` aus `roh`). Fehlen `vorhanden`, `ton_de`, `art` (Meldungen vor
-- Stufe 1, 22.09.2026), werden sie abgeleitet wie in `worker/src/pruefung-ableiten.ts`. Die Kopfdaten sind jeweils der
-- jüngste Wert, der nicht leer ist; `offen_meldung`/`offen_rohfolge` zählen wie `zaehleOffene`
-- (`worker/src/titelzeile-format.ts`). Stellen 14/15 (`folgen`, `roh_titel`) nur, wo belegt, wie `eintragAusMeldung`.
--
-- Gelesene Zeilen (lokal in workerd gemessen, 14.10.2026, `tools/titelzeile-einspielen-messen.ts`): je Block einmal
-- `prime_folge` und `pruefung` ganz (kein Index auf `plattform`), dazu die Zeilen des Blocks; Zahlen in betrieb.md.
WITH
  roh_alle AS MATERIALIZED (
    SELECT id, url, nummer, staffel_nr, gti, uebernommen, titel, sprachen, vorhanden, ton_de, gemeldet_am,
           CASE WHEN json_valid(roh) THEN json_extract(roh, '$.angenommen') END AS angenommen
      FROM prime_folge
     WHERE plattform = '__PLATTFORM__' AND gti IS NOT NULL
  ),
  block AS MATERIALIZED (
    SELECT url FROM (
      SELECT url FROM pruefung WHERE plattform = '__PLATTFORM__'
      UNION
      SELECT url FROM roh_alle
    )
     WHERE url NOT IN (SELECT url FROM titel_zeile)
     ORDER BY url
     LIMIT __ADRESSEN__
  ),
  jung AS MATERIALIZED (
    SELECT p.id, p.url, p.staffel, p.folge_nr, p.folge, p.rohfolge, p.sprachen, p.vorhanden, p.ton_de, p.art, p.befund,
           p.titel_id, p.uebernommen, p.roh_uebernommen, p.notiz, p.folgen, p.gemeldet_am, p.staffeln, p.titel, p.serientitel,
           ROW_NUMBER() OVER (PARTITION BY p.url, IFNULL(p.staffel, -1), IFNULL(p.folge_nr, -1)
                              ORDER BY p.gemeldet_am DESC, p.id DESC) AS rn_folge
      FROM pruefung p
     WHERE p.url IN (SELECT url FROM block) AND p.plattform = '__PLATTFORM__'
  ),
  -- Kopf = jüngster nicht leerer Wert je Feld, als größter Text „Zeitpunkt|Id|Wert“ (eine Gruppierung statt drei
  -- Fenster-Sortierungen, gemessen: Netflix-Block −0,1 Mio. Zeilen). Die Id hat 12 Stellen, der Wert beginnt danach.
  kopf_roh AS (
    SELECT url,
           MAX(CASE WHEN staffeln IS NOT NULL THEN printf('%s|%012d|', gemeldet_am, id) || staffeln END) AS s,
           MAX(CASE WHEN titel IS NOT NULL THEN printf('%s|%012d|', gemeldet_am, id) || titel END) AS t,
           MAX(CASE WHEN serientitel IS NOT NULL THEN printf('%s|%012d|', gemeldet_am, id) || serientitel END) AS st
      FROM jung
     GROUP BY url
  ),
  kopf AS MATERIALIZED (
    SELECT url, substr(s, instr(s, '|') + 14) AS s, substr(t, instr(t, '|') + 14) AS t, substr(st, instr(st, '|') + 14) AS st
      FROM kopf_roh
  ),
  roh AS MATERIALIZED (
    SELECT r.*,
           ROW_NUMBER() OVER (PARTITION BY r.url, IFNULL(r.staffel_nr, -1), IFNULL(r.nummer, -1)
                              ORDER BY r.gemeldet_am DESC, r.id DESC) AS rn
      FROM roh_alle r
     WHERE r.url IN (SELECT url FROM block)
  ),
  -- Meldung und Rohfolge derselben Folge nebeneinander: beide Seiten in eigenen Spalten untereinander, dann je Folge
  -- gruppiert. Ein Join auf (url, IFNULL(staffel), IFNULL(nummer)) läse je Folge alle Zeilen der Adresse (gemessen:
  -- Netflix-Block 1,14 Mio. statt 0,3 Mio. Zeilen).
  beide AS (
    SELECT url, IFNULL(staffel, -1) AS ks, IFNULL(folge_nr, -1) AS kn, staffel, folge_nr AS nummer,
           id AS j_id, gemeldet_am AS j_am, folge AS j_folge, json_extract(rohfolge, '$.gti') AS j_gti,
           json_extract(rohfolge, '$.titel') AS j_rtitel, sprachen AS j_spr, vorhanden AS j_vh, ton_de AS j_ton, art AS j_art,
           befund AS j_befund, notiz AS j_notiz, titel_id AS j_tid, uebernommen AS j_um, roh_uebernommen AS j_ur, folgen AS j_folgen,
           NULL AS r_am, NULL AS r_titel, NULL AS r_gti, NULL AS r_spr, NULL AS r_vh, NULL AS r_ton, NULL AS r_ur, NULL AS r_ang
      FROM jung WHERE rn_folge = 1
    UNION ALL
    SELECT url, IFNULL(staffel_nr, -1), IFNULL(nummer, -1), staffel_nr, nummer,
           NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
           gemeldet_am, titel, gti, sprachen, vorhanden, ton_de, uebernommen, angenommen
      FROM roh WHERE rn = 1
  ),
  paar AS (
    SELECT url, MAX(staffel) AS staffel, MAX(nummer) AS nummer,
           MAX(j_id) AS j_id, MAX(j_am) AS j_am, MAX(j_folge) AS j_folge, MAX(j_gti) AS j_gti, MAX(j_rtitel) AS j_rtitel,
           MAX(j_spr) AS j_spr, MAX(j_vh) AS j_vh, MAX(j_ton) AS j_ton, MAX(j_art) AS j_art, MAX(j_befund) AS j_befund,
           MAX(j_notiz) AS j_notiz, MAX(j_tid) AS j_tid, MAX(j_um) AS j_um, MAX(j_ur) AS j_ur, MAX(j_folgen) AS j_folgen,
           MAX(r_am) AS r_am, MAX(r_titel) AS r_titel, MAX(r_gti) AS r_gti, MAX(r_spr) AS r_spr, MAX(r_vh) AS r_vh,
           MAX(r_ton) AS r_ton, MAX(r_ur) AS r_ur, MAX(r_ang) AS r_ang
      FROM beide
     GROUP BY url, ks, kn
  ),
  f0 AS (
    SELECT url,
           COALESCE(j_am, r_am) AS am,
           staffel,
           nummer,
           CASE WHEN j_id IS NULL THEN r_titel ELSE j_folge END AS folge,
           COALESCE(j_gti, r_gti) AS gti,
           CASE WHEN j_id IS NOT NULL THEN COALESCE(j_rtitel, r_titel) END AS roh_titel_roh,
           CASE WHEN j_id IS NULL THEN r_spr ELSE j_spr END AS sprachen,
           CASE WHEN j_id IS NULL THEN COALESCE(r_vh, 'ja')
                ELSE COALESCE(j_vh, CASE j_befund WHEN 'weg' THEN 'nein' ELSE 'ja' END) END AS vorhanden,
           CASE WHEN j_id IS NULL THEN COALESCE(r_ton, 'unbekannt')
                ELSE COALESCE(j_ton, CASE j_befund WHEN 'dub' THEN 'ja' WHEN 'kein_dub' THEN 'nein' ELSE 'unbekannt' END) END AS ton_de,
           CASE WHEN j_id IS NULL THEN CASE WHEN r_ang THEN 'angenommen' ELSE 'gemessen' END
                ELSE COALESCE(j_art, CASE WHEN instr(IFNULL(j_notiz, ''), 'ANGENOMMEN') > 0 THEN 'angenommen' ELSE 'gemessen' END) END AS art,
           j_tid AS titel_id,
           CASE WHEN j_id IS NULL THEN 1 ELSE j_um END AS um,
           COALESCE(j_ur, r_ur, 1) AS ur,
           j_notiz AS notiz,
           j_folgen AS folgen
      FROM paar
  ),
  f1 AS (
    SELECT *,
           CASE WHEN roh_titel_roh IS NOT NULL AND roh_titel_roh IS NOT folge THEN roh_titel_roh END AS roh_titel,
           json_array(staffel, nummer, folge, gti, json(CASE WHEN json_valid(sprachen) THEN sprachen END),
                      vorhanden, ton_de, art, titel_id, am, um, ur, notiz, 0) AS basis
      FROM f0
  ),
  folgen AS (
    SELECT url, am, um, ur, gti, vorhanden,
           CASE WHEN roh_titel IS NOT NULL THEN json_insert(basis, '$[#]', folgen, '$[#]', roh_titel)
                WHEN folgen IS NOT NULL THEN json_insert(basis, '$[#]', folgen)
                ELSE basis END AS eintrag
      FROM f1
     ORDER BY url, staffel, nummer
  ),
  je_titel AS (
    SELECT url,
           json_group_array(json(eintrag)) AS f,
           MAX(am) AS am,
           SUM(um = 0) AS offen_meldung,
           SUM(ur = 0 AND gti IS NOT NULL AND vorhanden <> 'nein') AS offen_rohfolge
      FROM folgen
     GROUP BY url
  )
INSERT OR IGNORE INTO titel_zeile (url, plattform, nr, version, daten, gemeldet_am, offen_meldung, offen_rohfolge)
SELECT t.url, '__PLATTFORM__', (SELECT IFNULL(MAX(nr), 0) FROM titel_zeile) + ROW_NUMBER() OVER (ORDER BY t.url), 1,
       json_object('s', json(CASE WHEN json_valid(k.s) THEN k.s END), 't', k.t, 'st', k.st, 'f', json(t.f)),
       t.am, t.offen_meldung, t.offen_rohfolge
  FROM je_titel t
  LEFT JOIN kopf k ON k.url = t.url;

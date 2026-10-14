-- Eine Zeile je Titel und Anbieter: alle Folgen in einer D1-Zeile (13.10.2026, Pilot Disney+).
--
-- D1 rechnet nach Zeilen, nicht nach Bytes. Eine Disney+-Folge kostete in `pruefung` und `prime_folge`
-- zusammen 11 geschriebene Zeilen (Tabelle, `sqlite_sequence`, Indexe); ein Titel mit 41 Folgen also rund
-- 450. In `titel_zeile` steht der ganze Titel als JSON in einer Zeile: eine neue oder geänderte Folge
-- schreibt diese eine Zeile (mit PRIMARY KEY als einzigem Index, dazu der Tageszähler), eine unveränderte
-- nichts. Lesen eines Titels: eine Zeile.
--
-- `daten`: {"s": Staffelstruktur des Anbieters, "t": Titel, "st": Serientitel, "f": [Folge, …]};
-- eine Folge ist ein Feld ohne Schlüsselnamen (Reihenfolge: `worker/src/titelzeile-format.ts`):
-- [staffel, nummer, folgentitel, gti, sprachen, vorhanden, ton_de, art, titel_id, gemeldet_am,
--  meldung_uebernommen, rohfolge_uebernommen, notiz, fassung].
-- `version` zählt jede Änderung hoch: Der Worker schreibt mit `WHERE version = ?` und wiederholt bei
-- gleichzeitiger Meldung (kein verlorenes Update). `nr` macht aus Folgen Ids für die Leser (Id =
-- 2.000.000.000 + nr * 10^10 + fassung * 10^8 + staffel * 10^5 + nummer; `fassung` zählt inhaltliche Änderungen
-- einer Folge, damit eine veraltete Id eine geänderte Folge nicht abhakt). `url` ist der Schlüssel, weil
-- Adressen anbieterweise eindeutig sind.
--
-- Die Sicht `pruefung_titel` zeigt jede Folge so, wie `pruefung` sie zeigen würde (plus `gti` und
-- `roh_uebernommen` für die Rohfolgen): Die Leser des Workers fragen sie neben der Tabelle `pruefung`.
-- **Gelesene Zeilen:** `json_each` zählt in D1 jede erzeugte Folge als gelesene Zeile (lokal in workerd gemessen, 13.10.2026:
-- ein Titel mit 41 Folgen 42 Zeilen). Eine Abfrage über die Sicht liest also so viele Zeilen wie Folgen; sie spart gegenüber
-- `pruefung` die Indexzeilen beim Schreiben, nicht beim Lesen. Deshalb tragen die Titelzeilen `offen_meldung` und
-- `offen_rohfolge` (Zahl der Folgen, die der Bau bzw. der Zuordner noch holen muss; vom Worker bei jedem Schreiben neu
-- gezählt) und die Sicht zeigt sie: Abfragen auf offene Folgen überspringen Titel ohne offene Folgen, ohne `json_each` zu
-- starten. Der einzelne Titel (`?gemeldet=`) wird gar nicht über die Sicht gelesen, sondern als Ganzes (eine Zeile).
--
-- **Altzeilen:** Die Zeilen in `pruefung`/`prime_folge` bleiben unberührt. Eine Adresse mit Titelzeile
-- verdrängt ihre Altzeilen aus allen Lesern (`url NOT IN (SELECT url FROM titel_zeile)`); die Titelzeilen der
-- vorhandenen Adressen legt `tools/titelzeile-einspielen.ts` an. **Befristung:** Sobald alle
-- Disney+-Adressen eine Titelzeile haben und der Bau einmal ohne Fehler durchgelaufen ist (frühestens am
-- 20.10.2026), können die Disney+-Altzeilen entfallen (`DELETE`, in Blöcken unter dem Tagesdeckel).
CREATE TABLE IF NOT EXISTS titel_zeile (
  url         TEXT NOT NULL,
  plattform   TEXT NOT NULL,
  nr          INTEGER NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  daten       TEXT NOT NULL,
  gemeldet_am TEXT NOT NULL,
  offen_meldung INTEGER NOT NULL DEFAULT 0,
  offen_rohfolge INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (url, plattform)
) WITHOUT ROWID;

-- Nur für neue Titel (ein Eintrag mehr beim Anlegen, keiner bei Änderungen): sichert, dass `nr` nie doppelt
-- vergeben wird, auch wenn zwei neue Titel gleichzeitig kommen, und macht `MAX(nr)` zu einem Zugriff.
CREATE UNIQUE INDEX IF NOT EXISTS titel_zeile_nr ON titel_zeile (nr);

CREATE VIEW IF NOT EXISTS pruefung_titel AS
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
  NULL AS folgen,
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
  t.offen_rohfolge AS offen_rohfolge
FROM titel_zeile t, json_each(t.daten, '$.f') f;

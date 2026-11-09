-- Tageszähler der Anfragen je Route (09.11.2026, Spitze 6./7. November im Skript newsletter).
--
-- Je UTC-Tag und Route (Pfad, Kennungen als :id) die Zahl der Anfragen, gesammelt je Isolate und gestapelt
-- gebucht (worker/src/route-zaehler.ts); eine Untergrenze, kein Zählerstand jeder Anfrage. WITHOUT ROWID:
-- eine geschriebene Zeile je Upsert. Vor dem Worker-Deploy ausführen; ohne die Tabelle läuft alles weiter,
-- nur ohne Zählung.
CREATE TABLE IF NOT EXISTS route_abrufe (
  tag   TEXT    NOT NULL,
  route TEXT    NOT NULL,
  n     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tag, route)
) WITHOUT ROWID;

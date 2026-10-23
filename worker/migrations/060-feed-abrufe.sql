-- Tageszähler der Feed-Abrufe (23.10.2026, B5 des Skalierungsplans).
--
-- Je UTC-Tag: Zeile reg = -1 zählt die Abrufe (Summe), Zeilen reg = 0..255 sind die Register eines
-- HyperLogLog über den SHA-256 der Feed-Token (Maximum je Register) und ergeben die Zahl verschiedener
-- Token, ohne einen Token zu speichern. WITHOUT ROWID: eine geschriebene Zeile je Upsert.
-- Vor dem Worker-Deploy ausführen; ohne die Tabelle läuft der Feed weiter, nur ohne Zählung.
CREATE TABLE IF NOT EXISTS feed_abrufe (
  tag  TEXT    NOT NULL,
  reg  INTEGER NOT NULL,
  wert INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tag, reg)
) WITHOUT ROWID;

-- Zurückgestellte Titel je Anbieter (15.11.2026, Netflix-Prüfliste).
--
-- Eine Zeile je Anbieter: `daten` = JSON `{ "<kennung>": { "grund": "...", "bis": <ms seit 1970> } }`, sortiert nach Kennung.
-- Die Erweiterung meldet ihre Zurückstellungen gebündelt (`POST /pruefung?zurueck=1`, höchstens alle 10 Minuten), der
-- Prüfstand (`?stand=1`) zieht sie von `titel` ab. Abgelaufene Einträge filtert der Leser; es gibt keinen Cron.
-- `WITHOUT ROWID`: der Primärschlüssel ist die Tabelle, ein Schreibzugriff zählt 1 Zeile (kein Indexeintrag daneben).
-- **Die Migration muss vor dem Worker laufen:** ohne die Tabelle lehnt die Meldung mit 503 ab, der Prüfstand zieht nichts ab.
CREATE TABLE IF NOT EXISTS pruefung_zurueck (
  plattform TEXT PRIMARY KEY,
  daten TEXT NOT NULL,
  gemeldet_am TEXT NOT NULL
) WITHOUT ROWID;

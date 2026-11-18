-- Erweiterungsversion je Netflix-Meldung (18.11.2026).
--
-- Am 18.11. kamen 152 falsche Umleitungsmeldungen; welche Version der Erweiterung sie erzeugt hatte, war nicht feststellbar.
-- `pruefung.ext_version`: Version der Meldung (NULL bei Meldungen ohne Angabe). `pruefung_zurueck.ext_version`: Version der
-- Erweiterung, die die Zurückstellungen zuletzt geändert hat. Die Titelzeile trägt sie je Folge im Eintrag (Stelle 16, kein Schema).
-- `ADD COLUMN` ohne Vorgabe: ändert nur das Schema, schreibt keine vorhandene Zeile um.
-- **Die Migration muss vor dem Worker laufen:** der neue INSERT in `pruefung` nennt die Spalte, sonst lehnt D1 jede Meldung ab.
ALTER TABLE pruefung ADD COLUMN ext_version TEXT;
ALTER TABLE pruefung_zurueck ADD COLUMN ext_version TEXT;

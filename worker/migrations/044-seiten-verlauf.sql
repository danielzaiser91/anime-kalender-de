-- Verlauf der Wächter-Messungen: site_status hält nur den letzten Wert. Anlass: Westerwald-Pianoservice zeigte am 05.10.2026
-- 2367 ms (07:00) und 1038 ms (11:00), von Daniels Rechner aus 40–140 ms — ohne Verlauf nicht zu sagen, ob Dauerzustand oder Ausreißer.
-- Ein Eintrag je Seite und Lauf (stündlich, 19 Seiten ≈ 460 Zeilen/Tag); ältere als 60 Tage löscht der Lauf selbst.
CREATE TABLE IF NOT EXISTS site_history (
  url         TEXT NOT NULL,
  checked_at  TEXT NOT NULL,
  ok          INTEGER NOT NULL,
  ms          INTEGER NOT NULL,
  PRIMARY KEY (url, checked_at)
);

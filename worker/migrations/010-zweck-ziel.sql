-- Drei Zeilen je Lauf statt einer: Zweck, Ziel, Fortschritt.
--
-- Bis hierher stand in der Anzeige der Workflow-Name und eine Zahl — „Claude —
-- Auftrag abarbeiten · 4 · 4 Dateien offen, 51 Commits". Wer nicht selbst weiß,
-- was dieser Lauf tut, liest daraus nichts. Daniel am 21.08.2026: „Zweck sollte
-- kurz beschreiben wofür dieser lauf ist, zB aktualisiert die crunchy daten für
-- anime-kalender.de. ziel zB 600 serien bei crunchy prüfen, fortschritt zB
-- 233/600."
--
-- Beide Felder sind Freitext und werden vom Lauf selbst gesetzt (Umgebung
-- LAUF_ZWECK / LAUF_ZIEL). Sie stehen fest, während sich der Fortschritt
-- bewegt — deshalb eigene Spalten und nicht ein weiterer Text.
ALTER TABLE lauf_status ADD COLUMN zweck TEXT;
ALTER TABLE lauf_status ADD COLUMN ziel TEXT;

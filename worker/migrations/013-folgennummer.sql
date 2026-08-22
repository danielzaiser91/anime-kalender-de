-- Je Meldung die Folge, auf die sie sich bezieht.
--
-- Bis hierher galt eine Meldung für eine ganze Reihe — und das ging schief,
-- sobald ein Anbieter mehrere unserer Staffeln unter einer Reihe führt: Bei
-- „My Hero Academia" setzte eine einzige Meldung alle sieben Staffeln auf
-- „kein Deutsch", obwohl Staffel 1 und 6 deutsch sind (22.08.2026).
--
-- Daniels Zuschnitt: „melden von 1,3,4,13 müsste reichen, um daraus die infos
-- zu ziehen das 1-3 keine und 4-13 eine synchro haben." Die Auswertung bildet
-- aus den Einzelmeldungen Bereiche; dafür braucht sie die Nummer.
--
-- `staffel` ist die Zählung des Anbieters und nur Beiwerk: Netflix teilt
-- anders ein als AniList. Gerechnet wird mit der durchlaufenden Folgennummer.
ALTER TABLE pruefung ADD COLUMN folge_nr INTEGER;
ALTER TABLE pruefung ADD COLUMN staffel INTEGER;

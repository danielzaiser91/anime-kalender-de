-- Welchen Teil der Anbieter-Liste eine Meldung meint.
--
-- Prime bündelt mehrere Arcs zu einem Eintrag mit durchlaufender Nummerierung:
-- „Captain Tsubasa (2018)" ist eine Liste von 91 Folgen, und unser Eintrag
-- „Staffel 2 — Die Junioren" sind davon die Nummern 53 bis 91 (Daniel,
-- 27.08.2026, mit IMDb-Gegenprobe an den Folgentiteln 89–91).
--
-- Ohne diese Angabe meldet ein Blick auf die Seite 91 Folgen für eine Staffel,
-- die 39 hat — und der deutsche Ton der ersten 52 landet auf dem falschen
-- Eintrag. `folge_nr` beantwortet das nicht: Die Nummer bezieht sich auf eine
-- einzelne Folge, hier geht es um den Ausschnitt, für den die ganze Meldung
-- gilt.
ALTER TABLE pruefung ADD COLUMN teil_von INTEGER;
ALTER TABLE pruefung ADD COLUMN teil_bis INTEGER;

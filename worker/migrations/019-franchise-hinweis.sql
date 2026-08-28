-- „Auch Neues aus gemerkten Reihen" — die Option dazu.
--
-- Daniel am 28.08.2026: „mach außerdem, dass wenn man den haupttitel eines anime
-- oder die letzte staffel eines anime als favorit markiert auch informiert wird
-- wenn eine neue staffel/film oder sonstiges neues zu diesem haupttitel
-- erscheint/angekündigt wird … ich will informiert werden weil ich es sonst evtl
-- verpasse."
--
-- Standard ist an. Gemessen kommen rund 0,2 neue Titel je Tag in den Bestand;
-- eine Flut ist daraus nicht zu erwarten, und der Zweck der Seite ist genau
-- diese Nachricht.
ALTER TABLE subscribers ADD COLUMN franchise_hinweis INTEGER NOT NULL DEFAULT 1;
ALTER TABLE subscribers ADD COLUMN pending_franchise_hinweis INTEGER;

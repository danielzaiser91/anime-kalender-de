-- Wie der Anbieter die Reihe aufteilt, zum Zeitpunkt der Meldung.
--
-- Netflix liefert das beim Abspielen selbst mit — je Staffel die Zahl der
-- Folgen (`/nq/website/memberapi/release/metadata`, gefunden von Daniel am
-- 22.08.2026). Damit lässt sich eine Meldung später einer **unserer** Staffeln
-- zuordnen, auch wenn der Anbieter anders einteilt: Netflix führt „Die
-- Tagebücher der Apothekerin" als eine Staffel mit 24 Folgen, wo AniList zwei
-- mit je zwölf kennt.
--
-- Gespeichert als JSON, weil die Struktur je Anbieter anders aussieht und wir
-- sie nur zum Rechnen brauchen, nicht zum Abfragen.
ALTER TABLE pruefung ADD COLUMN staffeln TEXT;
ALTER TABLE pruefung ADD COLUMN serientitel TEXT;

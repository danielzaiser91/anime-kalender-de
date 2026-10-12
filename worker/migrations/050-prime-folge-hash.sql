-- Eine unveränderte Rohfolge wird nicht neu geschrieben (12.10.2026).
--
-- `hash` ist der SHA-256 über die inhaltlichen Felder einer Rohfolge (ohne `gemeldet_am`, Schlüssel
-- sortiert). Der Worker lädt die offenen Zeilen der Seite (Prime) bzw. je Kennung (Netflix, Disney+)
-- und fasst nur an, was sich geändert hat: Gleicher Hash = stehen lassen, 0 geschriebene Zeilen
-- statt Löschen + Einfügen samt drei Indexen. Alte Zeilen tragen NULL und werden einmal ersetzt.
-- Ohne Index: gelesen wird über `prime_folge_seite` / `prime_folge_gti`, die Spalte kostet keine
-- Indexzeile. Der alte Worker schreibt weiter ohne `hash` (Spalte bleibt NULL) und bricht nicht.
ALTER TABLE prime_folge ADD COLUMN hash TEXT;

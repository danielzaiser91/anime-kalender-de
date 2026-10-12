-- Eine unveränderte Meldung schreibt nichts (11.10.2026).
--
-- `hash` ist der SHA-256 über den normalisierten Rumpf der Meldung (Schlüssel sortiert). Kommt
-- dieselbe Meldung erneut und die offene Zeile derselben Folge trägt denselben Hash, speichert der
-- Worker weder `pruefung` noch `prime_folge` neu: 0 geschriebene Zeilen statt rund 12 je Folge.
-- Ohne Index — gelesen wird über `pruefung_url_zeit` (url), die Spalte kostet keine Indexzeile.
ALTER TABLE pruefung ADD COLUMN hash TEXT;

-- Das Aufräumen der Schnellmessung (`DELETE FROM site_probe WHERE checked_at < …`) lief bei jeder Messung über die ganze Tabelle (Primärschlüssel beginnt mit url).
-- Mit 14 Tagen Verlauf wären das rund 8.000 gelesene Zeilen je Aufruf, alle 5 Minuten (gemessen 06.10.2026: 245 je Aufruf bei 1 Tag Verlauf, ein Drittel der Leselast).
CREATE INDEX IF NOT EXISTS idx_site_probe_zeit ON site_probe (checked_at);

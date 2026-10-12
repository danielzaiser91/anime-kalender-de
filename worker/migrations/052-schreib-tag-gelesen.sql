-- Gelesene Zeilen im Tageszähler der Meldungs-Route (12.10.2026).
--
-- Das Lesekontingent (5 Mio. gelesene Zeilen je UTC-Tag und Konto) war am 12.10.2026 gegen 14:20 MESZ
-- erschöpft; bis 02:00 MESZ waren Status, Meldungen, Board und Durchgänge aus. Die Meldungs-Route
-- addiert `meta.rows_read` ihrer D1-Antworten in dieselbe Zeile wie die geschriebenen und antwortet
-- ab `DECKEL_LESEN` (tagesdeckel.ts) mit 429. Bestehende Zeilen starten bei 0.
-- Vor dem Worker-Deploy ausführen: der neue Worker liest und schreibt die Spalte.
ALTER TABLE schreib_tag ADD COLUMN gelesen INTEGER NOT NULL DEFAULT 0;

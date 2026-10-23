-- Versendete Mails im Tageszähler (23.10.2026).
--
-- Die Free-Stufe des Mail-Anbieters (Resend) erlaubt rund 100 Mails am Tag; bisher zählte sie niemand.
-- `mail-zaehler.ts` addiert die angenommenen Mails in dieselbe Zeile wie die D1-Zeilen, `/health` zeigt
-- sie, `tools/kapazitaet-messen.mjs` bewertet sie. Bestehende Zeilen starten bei 0.
-- Vor dem Worker-Deploy ausführen: der neue Worker liest und schreibt die Spalte.
ALTER TABLE schreib_tag ADD COLUMN mails INTEGER NOT NULL DEFAULT 0;

-- Stufe 1 des neuen Modells (docs/konzept-meldungen-architektur.md, 22.09.2026):
-- Verfügbarkeit und Sprache getrennt, und ob gemessen oder angenommen.
-- `befund` bleibt vorerst und wird vom Worker aus den neuen Feldern abgeleitet — der heutige
-- Einleser liest es, bis Stufe 2 ihn ersetzt.
ALTER TABLE pruefung ADD COLUMN vorhanden TEXT;   -- 'ja' | 'nein'
ALTER TABLE pruefung ADD COLUMN ton_de TEXT;      -- 'ja' | 'nein' | 'unbekannt'
ALTER TABLE pruefung ADD COLUMN art TEXT;         -- 'gemessen' | 'angenommen'

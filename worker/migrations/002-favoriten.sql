-- Nachträgliche Spalten für die Favoriten-Spiegelung.
--
-- `schema.sql` legt Tabellen mit IF NOT EXISTS an und ist damit beliebig oft
-- ausführbar; ein ALTER TABLE ist das nicht. Deshalb liegen nachträgliche
-- Spalten in eigenen Migrationsdateien, die genau einmal laufen.
--
--   wrangler d1 execute anime-kalender --remote --file=./migrations/002-favoriten.sql

ALTER TABLE subscribers ADD COLUMN favorites TEXT NOT NULL DEFAULT '';
ALTER TABLE subscribers ADD COLUMN pref_token TEXT NOT NULL DEFAULT '';
ALTER TABLE subscribers ADD COLUMN favorites_at TEXT;

-- Der Abgleich-Link in den Mails wird kurzlebig.
--
-- Anwenden mit:
--   wrangler d1 execute anime-kalender --file=./migrations/005-kurzlebiger-abgleichlink.sql
--   wrangler d1 execute anime-kalender --remote --file=./migrations/005-kurzlebiger-abgleichlink.sql
--
-- Das Problem: Bisher stand der `pref_token` selbst in jeder Newsletter-Mail
-- (`…/#/newsletter?sync=<pref_token>`), und er gilt unbefristet. Wer jemals
-- eine weitergeleitete Mail sieht oder einen Screenshot davon, kann die
-- gemerkten Titel dieses Abos dauerhaft ändern — Monate später noch. Dieselbe
-- Schwäche wie die am 14.08.2026 geschlossene Übernahme-Lücke, nur leiser.
--
-- Die Lösung ist dieselbe wie bei der Wiederherstellung: Der Dauerschlüssel
-- verlässt den Server nicht mehr. In die Mail kommt ein eigener, befristeter
-- Schlüssel; erst wenn jemand ihn einlöst, bekommt sein Browser den
-- `pref_token`.
--
-- Warum dreißig Tage und nicht dreißig Minuten wie beim Wiederherstellen: Eine
-- Newsletter-Mail wird nicht sofort gelesen. Ein Link, der nach einer halben
-- Stunde tot ist, wäre in der Praxis nie benutzbar. Dreißig Tage decken die
-- Lebensdauer einer Mail ab und lassen eine drei Monate alte Weiterleitung
-- trotzdem ins Leere laufen.

ALTER TABLE subscribers ADD COLUMN sync_token TEXT;
ALTER TABLE subscribers ADD COLUMN sync_expires TEXT;

CREATE INDEX IF NOT EXISTS idx_subscribers_sync ON subscribers (sync_token);

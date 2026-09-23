-- Wohin der Klick auf eine Benachrichtigung führt (23.09.2026).
--
-- Bis dahin öffnete der Service Worker fest `/#/favoriten`. Bei einer einzelnen Meldung ist
-- das eine Station zu viel — gemeint ist genau dieser Titel (Daniel: „klick drauf öffnet
-- nicht clevates detail panel in wochenansicht sondern .../#/favoriten").
--
-- Das Ziel gehört neben den Text: Beide werden beim Push gesetzt und beim Abholen geleert.
ALTER TABLE push_abo ADD COLUMN offen_ziel TEXT;

-- Fortschritt je Lauf, damit die Statusanzeige mehr sagen kann als „läuft seit
-- 54 Minuten".
--
-- Bewusst drei Felder statt eines Prozentwerts: Nicht jeder Lauf hat eine
-- Gesamtzahl. Ein Scraper über 594 Seiten hat eine (`3/594`), ein Deploy hat
-- keine und meldet stattdessen, woran er gerade ist. Die Anzeige zeigt einen
-- Balken, wenn beide Zahlen da sind, und sonst nur den Text.
ALTER TABLE lauf_status ADD COLUMN fortschritt INTEGER;
ALTER TABLE lauf_status ADD COLUMN fortschritt_gesamt INTEGER;
ALTER TABLE lauf_status ADD COLUMN fortschritt_text TEXT;

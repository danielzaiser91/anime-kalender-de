-- Die Seite, auf der die Folgen gelesen wurden (17.09.2026).
--
-- `url` ist die Adresse der Prüfliste. Nach einem Staffelwechsel meldet die
-- Erweiterung Folgen einer anderen Seite unter derselben Adresse: Vinland Saga
-- Staffel 2 landete so unter der Seite von Staffel 1, und das Aufräumen je
-- Adresse löschte die noch offenen Folgen der zuerst gemeldeten Staffel.
-- `pruefung` trägt die Kennung seit Migration 018; hier fehlte sie.

ALTER TABLE prime_folge ADD COLUMN seiten_kennung TEXT;

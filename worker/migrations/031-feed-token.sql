-- Eine eigene Kennung für den persönlichen Kalender-Feed (18.09.2026).
--
-- Der Abgleich-Schlüssel (`pref_token`) öffnet Einstellungen, Favoriten und die
-- Abmeldung und läuft nach `PREF_FRIST_TAGE` ab, wenn er nicht benutzt wird. Eine
-- Feed-Adresse dagegen steht dauerhaft in einem fremden Kalenderdienst und wird von
-- dort abgerufen. Sie bekommt deshalb eine eigene Kennung, die nur lesen kann und die
-- sich neu vergeben lässt, ohne das Abo anzufassen.
ALTER TABLE subscribers ADD COLUMN feed_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_feed_token ON subscribers(feed_token);

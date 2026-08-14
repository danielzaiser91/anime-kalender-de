-- Änderungen an einem AKTIVEN Abo werden vorgemerkt, nicht sofort angewandt.
--
-- Anwenden mit:
--   wrangler d1 execute anime-kalender --file=./migrations/003-vorgemerkte-aenderungen.sql
--   wrangler d1 execute anime-kalender --remote --file=./migrations/003-vorgemerkte-aenderungen.sql
--
-- Warum es diese Spalten gibt (gefunden 14.08.2026, ausgelöst durch Daniels
-- Frage „ich möchte nicht, dass andere meinen Newsletter manipulieren"):
--
-- `/subscribe` machte ein `INSERT … ON CONFLICT(email) DO UPDATE` und
-- überschrieb dabei `frequency`, `platforms` und `favorites` **sofort** — auch
-- bei einem längst bestätigten Abo, dessen Status ausdrücklich auf `active`
-- stehen blieb. Wer eine fremde Adresse in das Anmeldeformular tippte, konnte
-- damit ohne einen einzigen Klick die Einstellungen und die gemerkten Titel
-- eines anderen Menschen ersetzen. Der Betroffene bekam weiter Mails, nur eben
-- die falschen, und die Bestätigungsmail dazu sah aus wie Spam.
--
-- Der Kern des Fehlers war, Anmeldung und Änderung gleich zu behandeln. Eine
-- Anmeldung darf jeder auslösen — sie bewirkt bis zum Klick nichts. Eine
-- Änderung an einem bestehenden Abo darf nur, wer das Postfach lesen kann.
-- Genau dieselbe Grenze, die schon für Bestätigung und Abmeldung gilt.
--
-- Deshalb landen die Wünsche einer erneuten Anmeldung hier und werden erst beim
-- Klick auf den Bestätigungslink übernommen.

ALTER TABLE subscribers ADD COLUMN pending_frequency TEXT;
ALTER TABLE subscribers ADD COLUMN pending_platforms TEXT;
ALTER TABLE subscribers ADD COLUMN pending_favorites TEXT;

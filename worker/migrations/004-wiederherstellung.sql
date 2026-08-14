-- Favoriten per E-Mail-Link wiederherstellen.
--
-- Anwenden mit:
--   wrangler d1 execute anime-kalender --file=./migrations/004-wiederherstellung.sql
--   wrangler d1 execute anime-kalender --remote --file=./migrations/004-wiederherstellung.sql
--
-- Das Problem (Daniel, 14.08.2026): Favoriten liegen im Browser. Wer seine
-- Browserdaten löscht, das Gerät wechselt oder ein neues Handy hat, verliert
-- sie — und bei iOS-Safari räumt die Tracking-Prevention den lokalen Speicher
-- nach sieben Tagen ohne Besuch sogar von allein auf. Für eine Seite, deren
-- Zweck das Warten auf einen Termin in Monaten ist, ist das die schlimmste
-- Variante.
--
-- Serverseitig liegen die Favoriten längst — für jeden Abonnenten. Es fehlte
-- allein der Rückweg.
--
-- Warum kein Konto mit Passwort: Wie setzt man ein vergessenes Passwort zurück?
-- Per Mail ans Postfach. Das Postfach ist also ohnehin die Wurzel des
-- Vertrauens; ein Passwort wäre eine zusätzliche Hürde für den rechtmäßigen
-- Nutzer, kein zusätzlicher Schutz — und brächte Passwortspeicherung,
-- Zurücksetzen-Fluss und mehr Datenschutz-Fläche mit sich.
--
-- Drei Schutzmaßnahmen gehören dazu, sonst wird der Link zur Waffe:
--   1. Einmal-Link mit kurzer Frist (`restore_expires`, 30 Minuten).
--   2. Ratenbegrenzung je Adresse (`restore_sent_at`) und je IP (`rate_limit`)
--      — sonst kann man ein fremdes Postfach damit zumüllen.
--   3. Immer dieselbe Antwort im Formular, egal ob die Adresse existiert.
--      Sonst wäre das Feld ein Werkzeug, um herauszufinden, wer abonniert hat.

ALTER TABLE subscribers ADD COLUMN restore_token TEXT;
ALTER TABLE subscribers ADD COLUMN restore_expires TEXT;
ALTER TABLE subscribers ADD COLUMN restore_sent_at TEXT;

CREATE INDEX IF NOT EXISTS idx_subscribers_restore ON subscribers (restore_token);

-- Zähler je Schlüssel und Zeitfenster. Bewusst allgemein gehalten: Der erste
-- Nutzer ist die Wiederherstellung ("restore-ip:1.2.3.4"), aber jede weitere
-- Stelle, die eine Grenze braucht, kann dieselbe Tabelle benutzen.
CREATE TABLE IF NOT EXISTS rate_limit (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start TEXT NOT NULL
);

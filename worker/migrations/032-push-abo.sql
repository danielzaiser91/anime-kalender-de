-- Web-Push für Favoriten (18.09.2026). Ein Eintrag je Browser-Abo: Endpunkt des
-- Push-Dienstes, die Favoriten dieses Browsers, wann zuletzt geprüft wurde und der Text,
-- den der Service Worker beim nächsten Push abholt. Kein Konto, keine Mailadresse.
CREATE TABLE IF NOT EXISTS push_abo (
  endpoint TEXT PRIMARY KEY,
  favoriten TEXT NOT NULL DEFAULT '',
  erstellt TEXT NOT NULL,
  zuletzt TEXT,
  offen TEXT
);

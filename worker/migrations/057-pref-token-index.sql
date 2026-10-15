-- Index auf den Abgleich-Schlüssel (14.10.2026).
--
-- `/prefs`, `/favorites`, `/feed-token` und `/unsubscribe` (Browser) suchen den Abonnenten über
-- `pref_token`. Ohne Index lief das als Durchlauf über `idx_subscribers_status`: je Aufruf 2·N
-- gelesene Zeilen bei N Abonnenten (lokal gemessen, Zahlen in der PR-Beschreibung). Mit Index sind
-- es 2 Zeilen. Nicht UNIQUE: ältere Zeilen tragen den Standardwert ''.
-- **Die Migration sollte vor dem Worker laufen, ist aber nicht zwingend:** ohne sie arbeitet der Worker
-- wie bisher, nur mit dem vollen Durchlauf. Das Anlegen liest die Tabelle einmal (N Zeilen) und schreibt
-- N Indexzeilen: nach 00:00 UTC ausführen, wenn der Tageszähler frei ist.
CREATE INDEX IF NOT EXISTS idx_subscribers_pref ON subscribers (pref_token);

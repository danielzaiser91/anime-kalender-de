-- Web-Push: welche „Jetzt auch bei X“-Meldungen ein Abo schon bekommen hat (18.09.2026).
-- Die News tragen nur ein Datum, der Versand läuft stündlich — ohne Gedächtnis käme
-- dieselbe Meldung den ganzen Tag über jede Stunde neu. Schlüssel „<titelId>:<Anbieter>“,
-- durch Zeilenumbruch getrennt, die letzten 200.
ALTER TABLE push_abo ADD COLUMN gemeldet TEXT NOT NULL DEFAULT '';

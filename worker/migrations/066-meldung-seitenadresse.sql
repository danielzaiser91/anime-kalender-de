-- Adresse der Seite, auf der eine Meldung entstand (19.11.2026).
--
-- Meldung 27504 meldete „weg“ für Landei II, weil das Panel noch den Titel der vorigen Seite trug; ~70 „weg“-Meldungen ohne
-- Sprachen sind heute nicht prüfbar, weil die Meldung nicht sagt, auf welcher Seite sie entstand. `url` ist die Adresse der
-- Prüfliste, `seiten_kennung` nur die Kennung (bei Prime die ASIN) — die Seite selbst fehlte.
-- `pruefung.seiten_adresse`: Adresse der Seite ohne Suchteil und Anker (NULL bei Meldungen ohne Angabe; sie bleiben gültig).
-- `ADD COLUMN` ohne Vorgabe: ändert nur das Schema, schreibt keine vorhandene Zeile um.
-- **Die Migration muss vor dem Worker laufen:** der neue INSERT in `pruefung` nennt die Spalte, sonst lehnt D1 jede Meldung ab.
ALTER TABLE pruefung ADD COLUMN seiten_adresse TEXT;

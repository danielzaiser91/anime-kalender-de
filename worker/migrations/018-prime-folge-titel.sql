-- Die Titel-Kennung an der Rohfolge.
--
-- Bis dahin trug eine Rohfolge nur ihre Adresse, und `fetch-rohfolgen.ts` suchte
-- den Titel darüber in `titles.streams.url`. Bei einem Titel ohne Verweis steht
-- dort nichts — gemessen am 28.08.2026: **1 von 67 Adressen** ließ sich zuordnen,
-- 66-mal „kein Titel zu dieser Adresse".
--
-- Die Erweiterung weiß es längst: Der Suchauftrag trägt unsere AniList-Kennung.
-- Sie mitzuschicken macht aus einer Suche eine Angabe.
ALTER TABLE prime_folge ADD COLUMN titel_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_prime_folge_titel ON prime_folge (titel_id, uebernommen);

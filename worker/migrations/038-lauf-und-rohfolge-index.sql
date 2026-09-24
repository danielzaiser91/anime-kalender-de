-- Zwei weitere Posten aus `wrangler d1 insights` vom 24.09.2026 (Tag des Kontingent-Ausfalls):
--
-- 1. Status-App, GET /lauf: 2.699 Aufrufe, 886.000 gelesene Zeilen. Die Bedingung „kein späterer
--    erfolgreicher Lauf desselben Workflows" (NOT EXISTS … spaeter.workflow = lauf_status.workflow
--    AND spaeter.zustand = 'ok' AND spaeter.gemeldet_am > …) hatte keinen Index und las je Kandidat
--    die Tabelle. Mit diesem Index ist es je Kandidat ein Sprung.
CREATE INDEX IF NOT EXISTS lauf_status_workflow ON lauf_status (workflow, zustand, gemeldet_am);

-- 2. Meldung von Netflix/Disney+: DELETE FROM prime_folge WHERE url = ?1 AND plattform = ?2 AND
--    uebernommen = 0 AND gti = ?3 — 1.261 Aufrufe, 280.000 Zeilen. Der Index (url, uebernommen)
--    fand alle offenen Rohfolgen der Adresse (~220) und prüfte gti einzeln. Über gti ist es eine.
CREATE INDEX IF NOT EXISTS prime_folge_gti ON prime_folge (gti);

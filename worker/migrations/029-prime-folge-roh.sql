-- Alles Kleine, was die Seite über eine Folge sagt.
--
-- **Der Anlass** (Daniel, 11.09.2026): „alle folgen maximal mögliche infos
-- sammeln, also ep titel sehr wichtig für zuordnung später, besonders wegen
-- ova. auch runtime und release date und original release date, alle infos die
-- möglich sind, sollten gesammelt werden".
--
-- Bei Netflix sind die Feldnamen für Laufzeit und Datum nicht gemessen, und
-- geratene Namen haben das Projekt schon einen Tag gekostet (`seasonSeq`,
-- 31.08.2026). Die Erweiterung schickt deshalb alle kleinen Felder der Folge
-- ungefiltert mit — aus der Folgenliste (`liste`), aus dem Player (`player`)
-- und von der Reihe (`reihe`). Welche davon Laufzeit, Datum und
-- Erstausstrahlung sind, wird an den ersten echten Zeilen abgelesen und dann
-- in `fetch-rohfolgen.ts` gezielt übernommen.
--
-- „Beim Scrapen nichts wegwerfen" (CLAUDE.md): Ein Feld, das heute niemand
-- liest, kostet hier ein paar hundert Zeichen; eines, das fehlt, kostet einen
-- zweiten Durchlauf durch Daniels Hand.

ALTER TABLE prime_folge ADD COLUMN roh TEXT;

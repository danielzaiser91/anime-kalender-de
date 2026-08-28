-- Eine Zeile je gemeldeter Folge — die Rohdaten, aus denen die Zuordnung später
-- ihre Antwort zieht.
--
-- Bis hierher meldete die Erweiterung ein **Urteil**: `dub: true|false`, eine
-- Folgenzahl, ein Sprachbündel. Die Grundlage dafür — welche Folge wie heißt,
-- wann sie lief, wie lang sie ist — las sie zwar aus, warf sie aber weg. Jede
-- spätere Frage („ist das dieselbe Folge?", „gehört diese Staffel zu unserem
-- Eintrag?") war damit unbeantwortbar, und genau deshalb musste die Erweiterung
-- sie im Browser beantworten. Das hat am 27.08.2026 neununddreißig Fassungen an
-- einem Abend gekostet.
--
-- Hier steht deshalb, was die Seite hergibt, ohne Deutung. Was daraus folgt,
-- entscheidet der Bau — dort liegen die Folgentitel und Erstausstrahlungsdaten
-- aus TMDB, gegen die sich das abgleichen lässt.
--
-- `meldung_id` verweist auf die Meldung, zu der die Folge gehört; ohne sie wäre
-- nicht mehr feststellbar, aus welchem Abruf eine Zeile stammt.
CREATE TABLE IF NOT EXISTS prime_folge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meldung_id INTEGER,
  -- Die Adresse, unter der gemeldet wurde. Sie ist der Schlüssel zu unserem
  -- Bestand, nicht die ASIN: Eine Suchadresse hat gar keine.
  url TEXT NOT NULL,
  -- Amazons eigene Kennungen. `gti` ist stabiler als die ASIN und überlebt
  -- einen Staffelwechsel.
  asin TEXT,
  gti TEXT,
  -- Was Amazon anzeigt, unverändert. Die Nummer ist bewusst nicht eindeutig:
  -- Bei InuYasha Staffel 4 stehen 26, 27, 28 und 105 nebeneinander.
  nummer INTEGER,
  titel TEXT,
  erschienen TEXT,
  dauer_sek INTEGER,
  -- Tonspuren und Untertitel als JSON-Listen, so wie die Antwort sie führt.
  sprachen TEXT,
  untertitel TEXT,
  -- Die Staffel, wie die Seite sie nennt — Beschriftung und Position getrennt,
  -- weil Amazon „Inuyasha: The Final Act" für Staffel 2 schreibt.
  staffel_text TEXT,
  staffel_nr INTEGER,
  gemeldet_am TEXT NOT NULL,
  -- Wurde die Zeile schon in den Bestand übernommen?
  uebernommen INTEGER NOT NULL DEFAULT 0
);

-- Der Bau holt sich alles zu einer Adresse; die Erweiterung fragt nie.
CREATE INDEX IF NOT EXISTS prime_folge_url ON prime_folge (url, uebernommen);
CREATE INDEX IF NOT EXISTS prime_folge_offen ON prime_folge (uebernommen, gemeldet_am);

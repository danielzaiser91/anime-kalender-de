-- Was der Erweiterung auffällt, ohne dass jemand die Konsole öffnet.
--
-- **Der Anlass** (Daniel, 10.09.2026): „info bringt nix, du liest nix aus der
-- console aus, ich lese auch nix aus. denk darüber nach auch bezüglich allen
-- anderen derartigen logs, du musst informiert werden über issues."
--
-- Er hat recht, und der Punkt geht weiter als das eine Log. Die Erweiterung
-- schreibt seit Monaten Diagnosen in die Browserkonsole — „keine Tonspur
-- gelesen", „Folge gehört zu fremder Reihe", „Durchlauf abgebrochen bei M7111".
-- Gelesen hat sie nie jemand: Daniel schaut dort nicht hin, und ich komme gar
-- nicht daran. Die Information existierte nur, wenn er zufällig hinsah und ein
-- Bildschirmfoto schickte.
--
-- **Der Weg ist derselbe wie bei den Prüfungen**, und genau deshalb ist er
-- richtig: Die Erweiterung meldet an den Worker, ein Datenlauf holt es ab und
-- legt es unter `daniel-zum-abarbeiten/` — dort, wo ich es beim nächsten
-- Durchgang ohnehin lese.
--
-- **Was hier nicht landet:** der normale Ablauf. Ein Vorfall ist etwas, das
-- anders lief als vorgesehen — nicht jede geprüfte Folge.

CREATE TABLE IF NOT EXISTS vorfall (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Woher: netflix | primevideo | disneyplus
  plattform   TEXT NOT NULL,
  -- Was: ohne_tonspur | fremde_reihe | stoerung | melden_fehlgeschlagen | ausnahme
  art         TEXT NOT NULL,
  -- Die Seite, auf der es passierte — ohne Parameter, gekappt.
  url         TEXT,
  -- Die Reihe des Anbieters, soweit die Erweiterung sie kannte.
  reihe       TEXT,
  -- Folge und Staffel, wo es um eine einzelne geht.
  folge_nr    INTEGER,
  staffel     INTEGER,
  -- Kurzer Klartext für den Bericht — kein Stapelabzug, keine Kontodaten.
  text        TEXT,
  -- Welche Fassung der Erweiterung: Ohne sie ist ein Vorfall nicht einzuordnen.
  version     TEXT,
  gemeldet_am TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vorfall_zeit ON vorfall (gemeldet_am DESC);

-- Derselbe Vorfall zur selben Folge bringt nichts Neues. Der Index ist bewusst
-- nicht eindeutig: Ein Vorfall, der sich nach einer Woche wiederholt, ist eine
-- Auskunft — einer, der sich in derselben Minute zwanzigmal wiederholt, ist
-- Rauschen, und den fängt die Erweiterung selbst ab.
CREATE INDEX IF NOT EXISTS idx_vorfall_art ON vorfall (art, plattform);

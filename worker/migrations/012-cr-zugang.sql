-- Das Crunchyroll-Zugangspaket, damit ein Lauf in der Cloud den deutschen
-- Katalog lesen kann.
--
-- Warum es hier liegt: Crunchyroll leitet die Region aus der IP des Abrufs ab.
-- GitHub-Runner stehen in den USA und bekommen den US-Katalog; ein Paket von
-- einer deutschen Leitung gilt dagegen überall, weil die CloudFront-Signatur
-- nur eine Zeitbedingung trägt (gemessen 22.08.2026,
-- docs/messung-crunchyroll-region.md).
--
-- Der Worker läuft dort, wo die eingehende Anfrage ankommt. Ruft Daniels
-- Statusanzeige ihn auf — sie tut das ohnehin alle paar Sekunden, sie startet
-- bei ihm mit dem Anmelden —, dann läuft er in Europa und bekommt `DE`.
-- Genau diesen Moment nutzt er, um sich ein frisches Paket zu holen.
--
-- Es gilt 24 Stunden. Gespeichert wird nur, was `country: DE` trägt: Ein Paket
-- aus der falschen Region wäre schlimmer als keins.
CREATE TABLE IF NOT EXISTS cr_zugang (
  -- Nur eine Zeile, immer dieselbe.
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  land      TEXT NOT NULL,
  -- Das vollständige Paket als JSON: bucket, policy, signature, key_pair_id.
  paket     TEXT NOT NULL,
  geholt_am TEXT NOT NULL,
  -- Ablauf laut Signatur, ISO.
  gilt_bis  TEXT NOT NULL,
  -- Wo der Worker stand, als er es holte. Für die Fehlersuche.
  colo      TEXT
);

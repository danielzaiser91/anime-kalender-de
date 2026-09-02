-- Welche Ausgaben gehören zu einem Suchauftrag — vom Menschen bestätigt.
--
-- Prime führt denselben Anime regelmäßig zweimal: über einen Kanal (aniverse,
-- Crunchyroll) und als Kauftitel. Welche Karten dasselbe Werk meinen, sieht nur
-- ein Mensch; der Bau kennt höchstens eine Adresse.
--
-- Daniel kreuzt sie deshalb auf der Trefferliste an und bestätigt. Der erste
-- Anlauf legte das in `sessionStorage` ab — und damit an genau der Stelle, die
-- seine Regel vom 28.08.2026 ausschließt: „kein localstorage dafür … single
-- source of truth". Am 02.09.2026 hat sich das prompt gerächt: Nach einem
-- Neuladen war die Bestätigung weg, weil eine andere Stelle denselben Schlüssel
-- ohne `erwartet` überschrieb.
--
-- Eine Erwartung ist kein Sitzungszustand. Sie gilt, bis alle Ausgaben gemeldet
-- sind — über Neuladen, Browser und Geräte hinweg.
CREATE TABLE IF NOT EXISTS such_erwartung (
  such_url   TEXT PRIMARY KEY,
  kennungen  TEXT NOT NULL,
  gesetzt_am TEXT NOT NULL
);

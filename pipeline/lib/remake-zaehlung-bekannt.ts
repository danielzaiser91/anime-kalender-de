/**
 * Die am 03.11.2026 noch gemessenen doppelten Staffelnummern in Reihen ohne Neuverfilmung (Schlüssel `Reihe|Nummer`, `doppelteNummern`),
 * nachdem die Spin-offs aus `data/spinoff-von-hand.yaml` aus der Zählung genommen sind (18 der ursprünglich 37 Fälle gelöst). Die übrigen
 * 19 sind keine Spin-offs: ein Teil nennt „Staffel 2" im eigenen Namen, während die Position diese Nummer schon vergeben hat (Baki, Pokémon,
 * Tokyo Ghoul, Spy × Family), eine Unterreihe zählt neu (Ghost in the Shell: SAC_2045, The King’s Avatar), eine Neuverfilmung fehlt in den
 * Remake-Daten (Urusei Yatsura 2022) oder die deutsche Staffelangabe kollidiert mit der Position (Seven Deadly Sins, Bleach). Neue Schlüssel
 * meldet `check-remake-zaehlung-bestand.ts` namentlich; die Liste darf nur schrumpfen.
 */
export const BEKANNT_DOPPELT_OHNE_REMAKE: readonly string[] = [
  'Bakemonogatari|2/-',
  'Bakemonogatari|3/-',
  'Baki — the Grappler|2/-',
  'Baki — the Grappler|3/-',
  'Baki — the Grappler|4/-',
  'Baki — the Grappler|5/-',
  'Berserk|2/-',
  'Bleach|3/-',
  'Fate/Stay Night|2/-',
  'Ghost in the Shell: Stand Alone Complex|2/-',
  'Ghost in the Shell: Stand Alone Complex|3/-',
  'Pokémon|2/-',
  'Pokémon|3/-',
  'Pokémon|4/-',
  'Spy × Family|2/-',
  'The King’s Avatar|3/-',
  'The Seven Deadly Sins|4/-',
  'Tokyo Ghoul|2/-',
  'Urusei Yatsura|2/-',
]

/**
 * Zusicherungen für `neinUeberholt()` (`lib/cr-nein-ueberholt.ts`): Wann ein altes Nein aus `crunchyroll-offene.json`
 * vom Dub-Bestand überholt ist. Die Fälle sind wörtlich aus den Daten vom 25.10.2026 (Namen, Stände, Folgenzahlen).
 *
 * Aufruf: npx tsx pipeline/check-cr-nein-ueberholt.ts
 */
import type { CrSerie } from './lib/crunchyroll-dub.ts'
import { gleicherBlock, neinUeberholt, serienNachKennung, type OffenerBefund } from './lib/cr-nein-ueberholt.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown): void {
  if (bedingung) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const serie = (seriesId: string, geprueftAm: string, bloecke: [string, number, number][]): CrSerie =>
  ({
    url: `https://www.crunchyroll.com/de/series/${seriesId}/x`,
    seriesId,
    katalog: 'de',
    geprueftAm,
    staffeln: bloecke.map(([name, deutsch, folgen]) => ({ name, deutsch, folgen })),
  }) as unknown as CrSerie

const nein = (seriesId: string, titel: string, geprueftAm: string): OffenerBefund => ({
  herkunft: 'katalog',
  dub: false,
  seriesId,
  titel,
  geprueftAm,
})

const bestand = serienNachKennung([
  serie('GT00361955', '2026-10-25', [['Staffel 1', 12, 12], ['Staffel 2', 2, 5]]),
  serie('G3KHEVDJ7', '2026-10-24', [['Die Tagebücher der Apothekerin', 24, 24], ['Die Tagebücher der Apothekerin Staffel 2', 24, 24], ['Die Tagebücher der Apothekerin Staffel 3', 1, 4]]),
  serie('G6ZJMGEXY', '2026-10-12', [['Fruits Basket (2019)', 0, 25], ['Fruits Basket Staffel 2', 25, 25], ['Fruits Basket: The Final Season', 13, 13]]),
  serie('GYVD2K1WY', '2026-10-12', [['The Promised Neverland: Season 1', 12, 12], ['The Promised Neverland: Season 2', 0, 12]]),
  serie('GRE50KV36', '2026-10-12', [['Season 1 Part 1', 51, 51], ['Staffel 2', 0, 2]]),
  serie('GW4HM7NZX', '2026-10-05', [['Genocidal Organ', 0, 1], ['Genocidal Organ (German Dub)', 1, 1]]),
  serie('GT00371893', '2026-09-21', [['Season 1', 0, 13], ['Season 2', 11, 11]]),
])

/* Die beiden echten Widersprüche: das Nein ist älter als die Messung, die deutsche Folgen führt. */
pruefe('Last Boss: „Season 2“ (28.09.) ist durch „Staffel 2“ mit 2 deutschen Folgen (25.10.) überholt', neinUeberholt(nein('GT00361955', 'Season 2', '2026-09-28'), bestand))
pruefe('Apothekerin: Nein für Staffel 3 (19.10.) ist durch die Messung vom 24.10. überholt', neinUeberholt(nein('G3KHEVDJ7', 'Die Tagebücher der Apothekerin Staffel 3', '2026-10-19'), bestand))

/* Gegenproben: das Nein meint einen anderen Block oder der Block hat keine deutsche Folge. */
pruefe('Fruits Basket: das Nein gilt dem Block ohne deutsche Folge (2019), nicht Staffel 2', !neinUeberholt(nein('G6ZJMGEXY', 'Fruits Basket (2019)', '2026-09-10'), bestand))
pruefe('Promised Neverland: Staffel 2 hat 0 deutsche Folgen, das Nein bleibt', !neinUeberholt(nein('GYVD2K1WY', 'THE PROMISED NEVERLAND Staffel 2', '2026-09-09'), bestand))
pruefe('Black Clover: „Staffel 2“ mit 0 deutschen Folgen, das Nein bleibt', !neinUeberholt(nein('GRE50KV36', 'Staffel 2', '2026-10-12'), bestand))
pruefe('Genocidal Organ: das Nein gilt der OmU-Fassung, die deutsche ist ein anderer Block', !neinUeberholt(nein('GW4HM7NZX', '(OmU) Genocidal Organ', '2026-10-12'), bestand))
pruefe('Dorohedoro: „Caiman“ (Videotitel) passt zu keinem Block', !neinUeberholt(nein('GT00371893', 'Caiman', '2026-10-19'), bestand))

/* Grenzen der Regel. */
pruefe('gleicher Tag ist nicht neuer', !neinUeberholt(nein('GT00361955', 'Season 2', '2026-10-25'), bestand))
pruefe('ein Tag Abstand reicht', neinUeberholt(nein('GT00361955', 'Season 2', '2026-10-24'), bestand))
pruefe('Nein jünger als der Bestand bleibt', !neinUeberholt(nein('GT00361955', 'Season 2', '2026-10-26'), bestand))
pruefe('ein Ja wird nie überholt', !neinUeberholt({ ...nein('GT00361955', 'Season 2', '2026-09-28'), dub: true }, bestand))
pruefe('ein Befund ohne Urteil wird nie überholt', !neinUeberholt({ ...nein('GT00361955', 'Season 2', '2026-09-28'), dub: undefined }, bestand))
pruefe('ohne Serienkennung nichts zu vergleichen', !neinUeberholt({ ...nein('GT00361955', 'Season 2', '2026-09-28'), seriesId: undefined }, bestand))
pruefe('unbekannte Serie nichts zu vergleichen', !neinUeberholt(nein('GXXXXXXXX', 'Season 2', '2026-09-28'), bestand))
pruefe('ohne Titel nichts zu vergleichen', !neinUeberholt({ ...nein('GT00361955', 'Season 2', '2026-09-28'), titel: undefined }, bestand))
pruefe('ohne Prüfdatum des Neins nichts zu vergleichen', !neinUeberholt({ ...nein('GT00361955', 'Season 2', '2026-09-28'), geprueftAm: undefined }, bestand))
pruefe('ohne Befund', !neinUeberholt(undefined, bestand))
const ohneDatum = serienNachKennung([{ ...serie('GT00361955', '2026-10-25', [['Staffel 2', 2, 5]]), geprueftAm: undefined } as unknown as CrSerie])
pruefe('Serie ohne Prüfdatum überholt nichts', !neinUeberholt(nein('GT00361955', 'Season 2', '2026-09-28'), ohneDatum))
const nurEinsDeutsch = serienNachKennung([serie('GT00361955', '2026-10-25', [['Staffel 2', 1, 5]])])
pruefe('genau 1 deutsche Folge genügt', neinUeberholt(nein('GT00361955', 'Season 2', '2026-09-28'), nurEinsDeutsch))

/* Namensabgleich einzeln. */
pruefe('Season N ≙ Staffel N', gleicherBlock('Season 2', 'Staffel 2'))
pruefe('Serienname-Präfix wird ignoriert', gleicherBlock('Season 3', 'Die Tagebücher der Apothekerin Staffel 3'))
pruefe('andere Nummer ist ein anderer Block', !gleicherBlock('Season 2', 'Staffel 3'))
pruefe('Nummer gegen keine Nummer ist ein anderer Block', !gleicherBlock('Fruits Basket (2019)', 'Fruits Basket Staffel 2'))
pruefe('ohne Nummer muss der ganze Name gleich sein', gleicherBlock('Genocidal Organ (German Dub)', 'genocidal organ german dub') && !gleicherBlock('(OmU) Genocidal Organ', 'Genocidal Organ (German Dub)'))
pruefe('zwei verschiedene Serien mit gleicher Nummer sind kein Treffer', !gleicherBlock('Rascal Season 2', 'Dorohedoro Staffel 2'))

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)

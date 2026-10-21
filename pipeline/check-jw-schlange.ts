/**
 * Ablauftest der Warteschlange des JustWatch-Abrufs (`lib/jw-schlange.ts`): Reihenfolge und Auswahl mit Kulisse. Der vorgezogene Titel
 * (Flagge am Befund, 25 Tage alt) steht in der Mitte der Eingabe, davor ein älterer ohne Anlass, danach ein dringender ohne Flagge.
 * Läuft in `check:logic`.
 */
import type { Title } from '../shared/types.ts'
import type { JwBefund } from './lib/jw-vertrauen.ts'
import { warteschlange } from './lib/jw-schlange.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${JSON.stringify(info)}`)
}

const HEUTE = '2026-10-12'
const GRENZE = '2026-09-14'
const amazon = (n: number) => `https://watch.amazon.de/detail?gti=amzn1.dv.gti.3004ad12-53d7-4c50-856c-e55711247c${String(n).padStart(2, '0')}`
const weg = (n: number, rest: object = {}) => ({ platform: 'primevideo', url: amazon(n), ...rest })
const titel = (id: number, streams: object[], rest: object = {}) => ({ id, fsk: 12, streams, ...rest }) as unknown as Title
const befund = (tag: string, seite: number, audio: string[], rest: object = {}): JwBefund => ({
  geprueftAm: tag,
  jwId: `tm${seite}${tag}`,
  jwPfad: '/de/Film/x',
  angebote: [{ anbieter: 'Amazon', art: 'FLATRATE', audio, url: amazon(seite) }],
  ...rest,
})

const titles = [
  titel(1, [weg(1, { dub: true })], { tmdbId: 101 }),
  titel(2, [weg(2)], { tmdbId: 102 }),
  titel(3, [weg(3, { dub: true }), weg(9), weg(3, { dub: true })], { tmdbId: 103 }),
  titel(4, [weg(4, { dub: true })], { tmdbId: 104 }),
  titel(5, [weg(5, { dub: true })], { tmdbId: 105 }),
  titel(6, [weg(6, { dub: true })]),
  titel(7, [weg(7, { dub: true })], { tmdbId: 107 }),
  titel(8, [weg(8, { dub: true })], { tmdbId: 108 }),
  titel(9, [weg(9, { dub: true })], { tmdbId: 109 }),
  titel(10, [weg(10, { dub: true })], { tmdbId: 110 }),
]
const bestand = {
  '1': befund('2026-08-01', 1, ['de']),
  '2': befund('2026-09-17', 2, ['de']),
  '3': befund('2026-09-10', 3, ['en']),
  '4': befund('2026-10-01', 4, ['de'], { tmdbId: 999 }),
  '5': befund('2026-10-10', 5, ['de'], { tmdbId: 105 }),
  '6': befund('2026-08-01', 6, ['de']),
  '7': { geprueftAm: '2026-10-10', ohneTreffer: true, angebote: [] },
  '8': befund('2026-09-14', 8, ['de']),
  '9': befund('2026-09-13', 9, ['de']),
  '10': { geprueftAm: '2026-10-10', ohneTreffer: true, tmdbId: 110, angebote: [] },
}
const ids = (t: Title[]) => t.map((x) => x.id).join()
const lauf = (z: Title[], b: Record<string, JwBefund> = bestand, heute = HEUTE) =>
  warteschlange({ titles: z, bestand: b, tmdb: {}, grenze: GRENZE, heute, cartoonIds: new Set() })

pruefe('Reihenfolge: berichtigte Kennung, vorgezogen, dringend, ältester; Fehlschlag ohne Kennung zuletzt; Befund genau an der Grenze nicht fällig', ids(lauf(titles)) === '4,2,3,1,9,7', ids(lauf(titles)))
pruefe('ein Titel ohne TMDB-Kennung (6), frische (5, 10) und Grenze (8) bleiben draußen', [5, 6, 8, 10].every((id) => !lauf(titles).some((t) => t.id === id)))
pruefe('ohne Flagge steht der 25 Tage alte Befund (2) nicht in der Schlange', !ids(lauf(titles.filter((t) => t.id !== 2).concat(titel(2, [weg(2, { dub: true })], { tmdbId: 102 })))).includes('2'))
pruefe('Wiedervorlage ist Vorlauf, nicht Dauerzustand: mit 20 Tagen nicht dabei', !ids(lauf(titles, { ...bestand, '2': befund('2026-09-22', 2, ['de']) })).includes('2'))
pruefe('Kennung über die Tabelle `tmdb` zählt wie die am Titel', ids(warteschlange({ titles: [titel(1, [weg(1, { dub: true })])], bestand, tmdb: { '1': { tmdbId: 5 } }, grenze: GRENZE, heute: HEUTE, cartoonIds: new Set() })) === '1')

/* Dringend-Zweige einzeln: je ein fälliger Titel mit genau einer Lücke steht in der Mitte vor dem älteren ohne Anlass. */
const aelter = titel(1, [weg(1, { dub: true })], { tmdbId: 101 })
const juenger = titel(9, [weg(9, { dub: true })], { tmdbId: 109 })
const dringendBestand = { '1': bestand['1'], '9': bestand['9'], '11': befund('2026-09-12', 11, ['de']), '12': befund('2026-09-12', 12, ['de']) }
const ohneWeg = titel(11, [], { tmdbId: 111 })
const nurTmdb = titel(12, [weg(12, { dub: true })], { tmdbId: 112, watchLinks: [{ url: 'https://www.crunchyroll.com/x' }, { url: 'https://www.themoviedb.org/movie/5/watch' }, { url: 'https://example.org/y' }] })
const ohneStreamsMitLinks = titel(13, [], { tmdbId: 113, watchLinks: [{ url: 'https://www.crunchyroll.com/x' }, { url: 'https://www.netflix.com/title/1' }, { url: 'https://example.org/y' }] })
const bestand13 = { ...dringendBestand, '13': befund('2026-09-12', 13, ['de']) }
pruefe('Titel ohne streams, aber mit Anbieter-Links (kein TMDB), ist nicht dringend: steht nicht vor dem älteren ohne Anlass', ids(lauf([aelter, ohneStreamsMitLinks, juenger], bestand13)) === '1,13,9', ids(lauf([aelter, ohneStreamsMitLinks, juenger], bestand13)))
pruefe('Titel ganz ohne Weg ist dringend: steht vor dem älteren ohne Anlass', ids(lauf([aelter, ohneWeg, juenger], dringendBestand)) === '11,1,9', ids(lauf([aelter, ohneWeg, juenger], dringendBestand)))
pruefe('Weg nur auf die TMDB-Übersicht ist dringend: steht vor dem älteren ohne Anlass', ids(lauf([aelter, nurTmdb, juenger], dringendBestand)) === '12,1,9', ids(lauf([aelter, nurTmdb, juenger], dringendBestand)))

/* Cartoons: `cartoonIds` kommt bis `titelMitJwFlagge` an. Serien-Grund (zwei eigene Staffeln) bringt im Bau keine Flagge, ein Cartoon-Film schon. */
const seriePfad = { jwPfad: '/de/Serie/x', staffeln: [{ nr: 1, angebote: [] }] }
const cartoonSerie = titel(-5, [weg(5)], { tmdbId: 205, staffeln: [{ nr: 1 }, { nr: 2 }] })
const cartoonFilm = titel(-6, [weg(6)], { tmdbId: 206 })
const cartoonBestand = { '1': bestand['1'], '9': bestand['9'], '-5': befund('2026-09-17', 5, ['de'], seriePfad), '-6': befund('2026-09-17', 6, ['de']) }
const cartoonLauf = (z: Title[], cartoons: number[]) =>
  warteschlange({ titles: z, bestand: cartoonBestand, tmdb: {}, grenze: GRENZE, heute: HEUTE, cartoonIds: new Set(cartoons) })
const cartoonEingabe = [aelter, cartoonSerie, juenger]
pruefe('Cartoon-Serie mit Serien-Grund bleibt in der Schlange draußen', ids(cartoonLauf(cartoonEingabe, [-5])) === '1,9', ids(cartoonLauf(cartoonEingabe, [-5])))
pruefe('… dieselbe Serie ohne Cartoon-Kennung (Anime) steht vorn', ids(cartoonLauf(cartoonEingabe, [])) === '-5,1,9', ids(cartoonLauf(cartoonEingabe, [])))
pruefe('Cartoon-Film in `cartoonIds` bleibt vorgezogen', ids(cartoonLauf([aelter, cartoonFilm, juenger], [-6])) === '-6,1,9', ids(cartoonLauf([aelter, cartoonFilm, juenger], [-6])))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-schlange: ok')

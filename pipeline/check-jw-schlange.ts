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

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-schlange: ok')

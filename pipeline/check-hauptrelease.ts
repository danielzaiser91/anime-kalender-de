/**
 * Wächter zum Hauptrelease einer Titelseite (13.11.2026, Yaiba: Samurai Legend): Die Link-Vorschau zeigte „Vol. 1 · Fr, 04.12. im Handel“,
 * obwohl der Titel täglich im TV lief und danach bei Joyn kommt — die Auswahl nahm das erste Release mit Starttermin ab heute (die Disc).
 * Feste Daten, kein echter Titel. Läuft in `check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { hauptRang, hauptRelease } from './lib/haupt-release.ts'
import { head } from './lib/termin-seite.ts'
import type { Umfeld } from './lib/titel-umfeld.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const HEUTE = '2026-11-13'

function release(slug: string, platform: string, releaseType: string, erste: string, letzte: string, name = 'Yaiba: Samurai Legend'): Release {
  return {
    slug,
    titleId: 177476,
    name,
    platform,
    releaseType,
    schedule: { firstEpisodeDate: erste, lastEpisodeDate: letzte, episodeCount: 2, observed: { 1: erste, 2: letzte } },
    sources: [],
  } as unknown as Release
}

const joyn = release('yaiba-joyn', 'joyn', 'weekly', '2026-11-05', '2026-11-20')
const tv = release('yaiba-tv', 'tv', 'weekly', '2026-11-05', '2026-11-20')
const disc = release('yaiba-disc', 'disc', 'disc', '2026-12-04', '2026-12-04', 'Yaiba: Samurai Legend – Vol. 1')
const wahl = (rs: Release[], heute = HEUTE) => hauptRelease(rs, heute)?.slug

pruefe('Yaiba: laufender Stream gewinnt gegen künftige Disc', wahl([disc, tv, joyn]) === 'yaiba-joyn', wahl([disc, tv, joyn]))
pruefe('Ohne Stream gewinnt die laufende TV-Ausstrahlung gegen die Disc', wahl([disc, tv]) === 'yaiba-tv', wahl([disc, tv]))
pruefe('Rangfolge: Stream < TV < Disc', hauptRang(joyn) < hauptRang(tv) && hauptRang(tv) < hauptRang(disc))

const crunchy = release('c', 'crunchyroll', 'weekly', '2026-12-01', '2026-12-08')
pruefe('Gleicher Rang: der früheste nächste Termin gewinnt', wahl([crunchy, joyn]) === 'yaiba-joyn', wahl([crunchy, joyn]))

const vorbei = release('alt', 'joyn', 'weekly', '2026-10-01', '2026-10-08')
pruefe('Gegenprobe: abgelaufener Stream verdrängt keine künftige Disc', wahl([vorbei, disc]) === 'yaiba-disc', wahl([vorbei, disc]))
pruefe('Ohne künftigen Termin: das zuletzt gestartete Release (bisheriges Verhalten)', wahl([vorbei, release('neuer', 'joyn', 'weekly', '2026-10-15', '2026-10-22')]) === 'neuer')
pruefe('Ohne Releases: nichts', wahl([]) === undefined)

/* Vorschau-Titel: Hat der Titel mehrere Releases, steht sein Name da, nicht „… – Vol. 1“. */
const umfeld = { aehnlichHtml: '', krumenJsonLd: '' } as unknown as Umfeld
const titel = { id: 177476, slug: 'yaiba', titleRomaji: 'Yaiba', titleDe: 'Yaiba: Samurai Legend', genres: [], streams: [] } as unknown as Title
const kopf = (r: Release, mehrere: boolean) => head(r, titel, HEUTE, 177476, 'yaiba-177476', umfeld, mehrere)
pruefe('og:title nennt den Titel statt „Vol. 1“, wenn der Titel mehrere Releases hat', !/og:title" content="[^"]*Vol\./.test(kopf(disc, true)) && /og:title" content="Yaiba: Samurai Legend/.test(kopf(disc, true)))
pruefe('Gegenprobe: mit nur einem Release bleibt dessen Name', /og:title" content="Yaiba: Samurai Legend – Vol\. 1/.test(kopf(disc, false)))
pruefe('Seite trägt Bild des Hauptreleases', kopf(joyn, true).includes('/og/yaiba-joyn.jpg'))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('Hauptrelease: alle Zusicherungen erfüllt')
